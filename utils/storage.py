import os
import shutil
from abc import ABC, abstractmethod
from typing import List, Dict, Any, IO
from datetime import datetime
from urllib.parse import unquote
from flask import current_app, url_for
import cloudinary
import cloudinary.uploader
import cloudinary.api
import cloudinary.utils
import requests
from werkzeug.utils import secure_filename
from cloudinary.exceptions import Error as CloudinaryError
import time
from threading import RLock


def _build_storage_candidate_paths(file_id: str) -> List[str]:
    """Generate potential storage paths for legacy and normalized structures."""
    decoded_id = unquote(file_id).strip('/')

    def add_candidate(candidates: List[str], candidate: str) -> None:
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    def generate_variations(path: str) -> List[str]:
        segments = path.split('/')
        if len(segments) < 3:
            return [path]

        has_base = segments[0] == 'newsletters'
        year_index = 1 if has_base else 0
        month_index = year_index + 1
        if len(segments) <= month_index:
            return [path]

        filename_index = len(segments) - 1
        filename = segments[filename_index]
        month = segments[month_index]

        month_variants = {month}
        month_lower = month.lower()
        if month_lower != month:
            month_variants.add(month_lower)

        filename_variants = {filename}
        sanitized_filename = secure_filename(filename)
        if sanitized_filename and sanitized_filename != filename:
            filename_variants.add(sanitized_filename)

        variations = []
        for month_value in month_variants:
            for filename_value in filename_variants:
                updated_segments = segments[:]
                updated_segments[month_index] = month_value
                updated_segments[filename_index] = filename_value
                variations.append('/'.join(updated_segments))
        return variations

    candidate_paths: List[str] = []
    add_candidate(candidate_paths, decoded_id)
    if decoded_id and not decoded_id.startswith('newsletters/'):
        add_candidate(candidate_paths, f"newsletters/{decoded_id}")

    for path in candidate_paths[:]:
        for variant in generate_variations(path):
            add_candidate(candidate_paths, variant)

    return candidate_paths


class StorageInterface(ABC):
    """Abstract base class for storage implementations"""
    
    @abstractmethod
    def upload(self, file: IO, filename: str) -> Dict[str, Any]:
        """Upload a file and return upload result with metadata"""
        pass
    
    @abstractmethod
    def download(self, file_id: str) -> bytes:
        """Download file content by file ID"""
        pass
    
    @abstractmethod
    def delete(self, file_id: str) -> bool:
        """Delete a file by file ID"""
        pass
    
    @abstractmethod
    def save(self, file_id: str, content: bytes) -> bool:
        """Save/overwrite file content"""
        pass
    
    @abstractmethod
    def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """List files with optional prefix filter"""
        pass
    
    @abstractmethod
    def get_file_url(self, file_id: str) -> str:
        """Get public URL or access URL for a file"""
        pass


class CloudinaryStorage(StorageInterface):
    """Cloudinary cloud storage implementation"""
    
    def upload(self, file: IO, filename: str) -> Dict[str, Any]:
        """Upload file to Cloudinary with date-based folder structure"""
        try:
            # Get current date for folder structure
            current_date = datetime.now()
            year = current_date.strftime('%Y')
            month = current_date.strftime('%B').lower()

            base_folder = "newsletters"
            folder_path = f"{base_folder}/{year}/{month}"

            # Ensure Cloudinary folder hierarchy exists
            for folder in (base_folder, f"{base_folder}/{year}", folder_path):
                try:
                    cloudinary.api.create_folder(folder)
                except CloudinaryError as err:
                    if "already exists" not in str(err).lower():
                        raise

            sanitized_filename = secure_filename(filename)
            if not sanitized_filename:
                sanitized_filename = f"file-{current_date.strftime('%H%M%S%f')}"

            file.seek(0)
            result = cloudinary.uploader.upload(
                file,
                resource_type="raw",
                public_id=f"{folder_path}/{sanitized_filename}",
                overwrite=True,
                unique_filename=False,
            )

            return {
                'success': True,
                'file_id': result['public_id'],
                'url': result['secure_url'],
                'size': result.get('bytes', 0),
                'created_at': result.get('created_at', ''),
                'format': result.get('format', '')
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def download(self, file_id: str) -> bytes:
        """Download file content from Cloudinary"""
        url = cloudinary.utils.cloudinary_url(file_id, resource_type="raw")[0]
        response = requests.get(url, stream=True)
        response.raise_for_status()
        return response.content
    
    def delete(self, file_id: str) -> bool:
        """Delete file from Cloudinary"""
        candidate_paths = _build_storage_candidate_paths(file_id)

        for candidate in candidate_paths:
            try:
                result = cloudinary.uploader.destroy(candidate, resource_type="raw")
            except CloudinaryError as err:
                if 'not found' in str(err).lower():
                    continue
                return False
            except Exception:
                return False

            outcome = (result or {}).get('result')
            if outcome == 'ok':
                return True
            if outcome == 'not found':
                continue

        return False
    
    def save(self, file_id: str, content: bytes) -> bool:
        """Save/overwrite file content in Cloudinary"""
        try:
            cloudinary.uploader.upload(
                content,
                public_id=file_id,
                resource_type="raw",
                overwrite=True,
                invalidate=True
            )
            return True
        except Exception:
            return False
    
    def list_files(self, prefix: str = "newsletters/") -> List[Dict[str, Any]]:
        """List files from Cloudinary with prefix filter"""
        try:
            result = cloudinary.api.resources(
                type="upload",
                resource_type="raw",
                prefix=prefix,
                max_results=500
            )
            
            files = []
            for resource in result.get('resources', []):
                files.append({
                    'public_id': resource['public_id'],
                    'filename': resource['public_id'].split('/')[-1],
                    'size': resource.get('bytes', 0),
                    'created_at': resource.get('created_at', ''),
                    'format': resource.get('format', ''),
                    'secure_url': resource.get('secure_url', '')
                })
            
            return files
        except Exception:
            return []
    
    def get_file_url(self, file_id: str) -> str:
        """Get Cloudinary URL for file"""
        return cloudinary.utils.cloudinary_url(file_id, resource_type="raw")[0]


class LocalStorage(StorageInterface):
    """Local file system storage implementation"""
    
    def __init__(self, base_path: str = "static/files"):
        self.base_path = base_path
        self.full_path = os.path.join(os.getcwd(), base_path)
        
        # Ensure base directory exists
        os.makedirs(self.full_path, exist_ok=True)
    
    def upload(self, file: IO, filename: str) -> Dict[str, Any]:
        """Upload file to local storage with date-based folder structure"""
        try:
            # Get current date for folder structure
            current_date = datetime.now()
            year = current_date.strftime('%Y')
            month = current_date.strftime('%B').lower()

            # Create folder path: newsletters/YYYY/MMMM/
            folder_path = f"newsletters/{year}/{month}"
            full_folder_path = os.path.join(self.full_path, folder_path)
            
            # Ensure directory exists
            os.makedirs(full_folder_path, exist_ok=True)
            
            sanitized_filename = secure_filename(filename)
            if not sanitized_filename:
                sanitized_filename = f"file-{current_date.strftime('%H%M%S%f')}"

            # Save file
            file_path = os.path.join(full_folder_path, sanitized_filename)
            file.seek(0)  # Reset file pointer
            with open(file_path, 'wb') as f:
                shutil.copyfileobj(file, f)
            
            # Get file stats
            stat = os.stat(file_path)
            file_id = f"{folder_path}/{sanitized_filename}"
            
            return {
                'success': True,
                'file_id': file_id,
                'url': self.get_file_url(file_id),
                'size': stat.st_size,
                'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                'format': os.path.splitext(filename)[1][1:] if '.' in filename else ''
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def download(self, file_id: str) -> bytes:
        """Download file content from local storage"""
        file_path = os.path.join(self.full_path, file_id)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_id}")
        
        with open(file_path, 'rb') as f:
            return f.read()
    
    def delete(self, file_id: str) -> bool:
        """Delete file from local storage"""
        try:
            for candidate in _build_storage_candidate_paths(file_id):
                file_path = os.path.join(self.full_path, candidate)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    
                    # Clean up empty directories
                    dir_path = os.path.dirname(file_path)
                    try:
                        os.removedirs(dir_path)
                    except OSError:
                        pass  # Directory not empty, which is fine
                    
                    return True
            return False
        except Exception:
            return False
    
    def save(self, file_id: str, content: bytes) -> bool:
        """Save/overwrite file content in local storage"""
        try:
            file_path = os.path.join(self.full_path, file_id)
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, 'wb') as f:
                f.write(content)
            return True
        except Exception:
            return False
    
    def list_files(self, prefix: str = "newsletters/") -> List[Dict[str, Any]]:
        """List files from local storage with prefix filter"""
        try:
            files = []
            search_path = os.path.join(self.full_path, prefix)
            
            if not os.path.exists(search_path):
                return files
            
            for root, dirs, filenames in os.walk(search_path):
                for filename in filenames:
                    file_path = os.path.join(root, filename)
                    relative_path = os.path.relpath(file_path, self.full_path)
                    relative_path = relative_path.replace(os.sep, '/')  # Normalize path separators
                    
                    stat = os.stat(file_path)
                    
                    files.append({
                        'public_id': relative_path,
                        'filename': filename,
                        'size': stat.st_size,
                        'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        'format': os.path.splitext(filename)[1][1:] if '.' in filename else '',
                        'secure_url': self.get_file_url(relative_path)
                    })
            
            # Sort by creation time (newest first)
            files.sort(key=lambda x: x['created_at'], reverse=True)
            return files
        except Exception:
            return []
    
    def get_file_url(self, file_id: str) -> str:
        """Get Flask static URL for local file"""
        return url_for('static', filename=f"files/{file_id}")


class StorageManager:
    """Factory and manager class for storage implementations"""
    
    _list_cache: Dict[str, Dict[str, Any]] = {}
    _cache_lock: RLock = RLock()
    
    def __init__(self, storage_type: str = None, local_path: str = None):
        if storage_type is None:
            storage_type = current_app.config.get('STORAGE_TYPE', 'cloudinary')
        
        if local_path is None:
            local_path = current_app.config.get('LOCAL_STORAGE_PATH', 'static/files')

        normalized_type = storage_type.lower()

        if normalized_type == 'local':
            self.storage = LocalStorage(local_path)
        elif normalized_type == 'cloudinary':
            self.storage = CloudinaryStorage()
        else:
            raise ValueError(f"Unsupported storage type: {storage_type}")

        self.storage_type = normalized_type
    
    def upload(self, file: IO, filename: str) -> Dict[str, Any]:
        """Upload a file using the configured storage backend"""
        result = self.storage.upload(file, filename)
        if result.get('success'):
            self._invalidate_cache()
        return result
    
    def download(self, file_id: str) -> bytes:
        """Download file content using the configured storage backend"""
        return self.storage.download(file_id)
    
    def delete(self, file_id: str) -> bool:
        """Delete a file using the configured storage backend"""
        deleted = self.storage.delete(file_id)
        if deleted:
            self._invalidate_cache()
        return deleted
    
    def save(self, file_id: str, content: bytes) -> bool:
        """Save/overwrite file content using the configured storage backend"""
        saved = self.storage.save(file_id, content)
        if saved:
            self._invalidate_cache()
        return saved

    def _cache_key(self, prefix: str) -> str:
        return f"{self.storage_type}:{prefix or '__root__'}"

    def _get_cache_ttl(self) -> int:
        ttl = current_app.config.get('STORAGE_CACHE_TTL', 120)
        try:
            ttl = int(ttl)
        except (TypeError, ValueError):
            ttl = 120
        return max(ttl, 0)

    def _invalidate_cache(self) -> None:
        ttl = self._get_cache_ttl()
        if ttl <= 0:
            return
        cache_prefix = f"{self.storage_type}:"
        with self._cache_lock:
            keys_to_delete = [key for key in self._list_cache if key.startswith(cache_prefix)]
            for key in keys_to_delete:
                self._list_cache.pop(key, None)
    
    def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """List files using the configured storage backend"""
        ttl = self._get_cache_ttl()
        cache_key = self._cache_key(prefix)

        if ttl > 0:
            with self._cache_lock:
                cached_entry = self._list_cache.get(cache_key)
                if cached_entry and (time.time() - cached_entry['timestamp'] < ttl):
                    return cached_entry['data']
    
        files = self.storage.list_files(prefix)

        if ttl > 0:
            with self._cache_lock:
                self._list_cache[cache_key] = {
                    'timestamp': time.time(),
                    'data': files
                }

        return files

    def get_file_url(self, file_id: str) -> str:
        """Get file URL using the configured storage backend"""
        return self.storage.get_file_url(file_id)
