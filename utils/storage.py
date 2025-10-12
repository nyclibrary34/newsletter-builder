import os
import shutil
import re
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, IO, Optional
from datetime import datetime
from urllib.parse import unquote, quote
from flask import current_app, url_for
import cloudinary
import cloudinary.uploader
import cloudinary.api
import cloudinary.utils
import requests

# Configure logging
logger = logging.getLogger(__name__)

# Filename sanitization patterns
FOLDER_NAME_PATTERN = re.compile(r'[^A-Za-z0-9 _\-]+')
FILENAME_ALLOWED_PATTERN = re.compile(r'[^A-Za-z0-9 _\.\-]+')
DEFAULT_BASENAME = "newsletter"
DEFAULT_EXTENSION = ".html"


def sanitize_filename(filename: str, default_extension: str = DEFAULT_EXTENSION) -> str:
    """Return a filesystem-safe filename with whitespace instead of percent escapes."""
    # Decode URL-encoded characters
    decoded = unquote(filename or "")
    # Replace any remaining percent signs with spaces
    decoded = decoded.replace('%', ' ')
    decoded = decoded.replace('\\', '/')
    decoded = os.path.basename(decoded)
    decoded = decoded.strip()

    if not decoded:
        decoded = f"{DEFAULT_BASENAME}{default_extension}"

    # Split into name and extension
    name, ext = os.path.splitext(decoded)
    if not ext:
        ext = default_extension
    else:
        # Clean extension: only allow alphanumeric
        cleaned_ext = ''.join(ch for ch in ext.lower().lstrip('.') if ch.isalnum())
        ext = f".{cleaned_ext}" if cleaned_ext else default_extension

    # Replace non-allowed characters with spaces
    name = FILENAME_ALLOWED_PATTERN.sub(' ', name)
    # Collapse multiple spaces
    name = re.sub(r'\s+', ' ', name).strip()

    if not name:
        name = DEFAULT_BASENAME

    sanitized = f"{name}{ext}"
    # Remove any double dots
    sanitized = sanitized.replace('..', '.').strip()

    if not sanitized:
        sanitized = f"{DEFAULT_BASENAME}{default_extension}"

    # Limit to 255 characters (filesystem limit)
    return sanitized[:255]


def sanitize_folder_segment(segment: str) -> str:
    """Sanitize a folder name while preserving readable spaces."""
    decoded = unquote(segment or "")
    decoded = decoded.replace('%', ' ')
    decoded = decoded.replace('\\', ' ')
    decoded = decoded.strip()
    cleaned = FOLDER_NAME_PATTERN.sub(' ', decoded)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    if not cleaned:
        cleaned = "folder"
    return cleaned[:120]


def sanitize_relative_path(file_id: str) -> str:
    """Sanitize an entire relative path, cleaning each segment."""
    normalized = (file_id or "").replace('\\', '/')
    parts = [part for part in normalized.split('/') if part]
    if not parts:
        return sanitize_filename('')
    cleaned_parts = []
    for index, part in enumerate(parts):
        if index == len(parts) - 1:
            # Last part is the filename
            cleaned_parts.append(sanitize_filename(part))
        else:
            # Other parts are folder names
            cleaned_parts.append(sanitize_folder_segment(part))
    return '/'.join(cleaned_parts)


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
            month = current_date.strftime('%B')

            # Create folder path: YYYY/MMMM/
            folder_path = f"{year}/{month}"
            # Sanitize filename to remove percent-encoding
            filename = sanitize_filename(filename)

            result = cloudinary.uploader.upload(
                file,
                resource_type="raw",
                public_id=f"{folder_path}/{filename}"
            )

            return {
                'success': True,
                'file_id': result['public_id'],
                'url': result['secure_url'],
                'size': result.get('bytes', 0),
                'display_name': sanitize_filename(result['public_id'].split('/')[-1]),
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
        try:
            cloudinary.uploader.destroy(file_id, resource_type="raw")
            return True
        except Exception:
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
    
    def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
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
                    'display_name': sanitize_filename(resource['public_id'].split('/')[-1]),
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

    def _candidate_ids(self, file_id: str) -> list:
        """Generate list of candidate file paths to check for existence."""
        normalized = (file_id or '').replace('\\', '/')
        candidates = [normalized]

        # Try URL-decoded version
        decoded = unquote(normalized)
        if decoded not in candidates:
            candidates.append(decoded)

        # Try URL-encoded version
        encoded = quote(decoded, safe='/') if decoded else ''
        if encoded and encoded not in candidates:
            candidates.append(encoded)

        # Try sanitized version
        sanitized = sanitize_relative_path(normalized)
        if sanitized not in candidates:
            candidates.append(sanitized)

        # Try sanitized + encoded version
        sanitized_encoded = quote(sanitized, safe='/') if sanitized else ''
        if sanitized_encoded and sanitized_encoded not in candidates:
            candidates.append(sanitized_encoded)

        return candidates

    def _safe_join(self, relative_path: str) -> str:
        """Safely join base path with relative path, preventing directory traversal."""
        absolute_path = os.path.abspath(os.path.join(self.full_path, relative_path))
        try:
            common_path = os.path.commonpath([self.full_path, absolute_path])
        except ValueError as exc:
            raise ValueError(f"Unsafe file path: {relative_path}") from exc
        if common_path != self.full_path:
            raise ValueError(f"Unsafe file path: {relative_path}")
        return absolute_path

    def _find_file_in_directory(self, file_id: str) -> Optional[str]:
        """
        Find a file by scanning the target directory for matching names.
        Handles files with literal percent-encoding in their names.
        """
        try:
            # Extract directory and filename from file_id
            normalized_id = file_id.replace('\\', '/')
            parts = normalized_id.rsplit('/', 1)

            if len(parts) == 2:
                dir_path, target_filename = parts
                search_dir = self._safe_join(dir_path)
            else:
                # No directory, just filename
                target_filename = parts[0]
                search_dir = self.full_path

            if not os.path.exists(search_dir):
                return None

            # Get sanitized version of target filename for comparison
            sanitized_target = sanitize_filename(target_filename)

            # List all files in directory
            for actual_filename in os.listdir(search_dir):
                # Check if this file matches (either exact or sanitized match)
                if actual_filename == target_filename:
                    # Exact match
                    return os.path.join(search_dir, actual_filename)
                elif sanitize_filename(actual_filename) == sanitized_target:
                    # Sanitized match (e.g., "file%20name.html" matches "file name.html")
                    return os.path.join(search_dir, actual_filename)

            return None

        except (ValueError, OSError) as e:
            logger.debug(f"Error finding file in directory: {e}")
            return None

    def _resolve_existing_path(self, file_id: str) -> Optional[str]:
        """Find existing file by trying multiple path candidates."""
        # First try all candidate IDs directly
        for candidate in self._candidate_ids(file_id):
            try:
                path = self._safe_join(candidate)
            except ValueError:
                continue
            if os.path.exists(path):
                return path

        # If no direct match, scan the directory for similar filenames
        directory_match = self._find_file_in_directory(file_id)
        if directory_match:
            return directory_match

        return None

    def __init__(self, base_path: str = "static/files"):
        self.base_path = base_path
        self.full_path = os.path.abspath(os.path.join(os.getcwd(), base_path))

        # Ensure base directory exists
        os.makedirs(self.full_path, exist_ok=True)
    
    def upload(self, file: IO, filename: str) -> Dict[str, Any]:
        """Upload file to local storage with date-based folder structure"""
        try:
            # Get current date for folder structure
            current_date = datetime.now()
            year = current_date.strftime('%Y')
            month = current_date.strftime('%B')

            # Create folder path: YYYY/MMMM/
            folder_path = f"{year}/{month}"
            # Sanitize filename to remove percent-encoding
            filename = sanitize_filename(filename)
            relative_path = f"{folder_path}/{filename}"
            file_path = self._safe_join(relative_path)

            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)

            # Save file
            file.seek(0)  # Reset file pointer
            with open(file_path, 'wb') as f:
                shutil.copyfileobj(file, f)

            # Get file stats
            stat = os.stat(file_path)

            return {
                'success': True,
                'file_id': relative_path,
                'url': self.get_file_url(relative_path),
                'size': stat.st_size,
                'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                'format': os.path.splitext(filename)[1][1:] if '.' in filename else '',
                'display_name': filename,
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def download(self, file_id: str) -> bytes:
        """Download file content from local storage"""
        file_path = self._resolve_existing_path(file_id)
        if not file_path:
            raise FileNotFoundError(f"File not found: {file_id}")

        with open(file_path, 'rb') as f:
            return f.read()
    
    def delete(self, file_id: str) -> bool:
        """Delete file from local storage"""
        try:
            file_path = self._resolve_existing_path(file_id)
            if file_path and os.path.exists(file_path):
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
            # Try to find existing file (including percent-encoded versions)
            existing_path = self._resolve_existing_path(file_id)

            # Always save to sanitized path
            normalized_id = file_id.replace('\\', '/')
            safe_relative = sanitize_relative_path(normalized_id)
            target_path = self._safe_join(safe_relative)

            # Ensure directory exists
            os.makedirs(os.path.dirname(target_path), exist_ok=True)

            # If we found an existing file with a different name (e.g., percent-encoded)
            # and it's different from our target, rename/move it
            if existing_path and os.path.normpath(existing_path) != os.path.normpath(target_path):
                logger.info(f"Renaming file from {existing_path} to {target_path}")
                # Delete old file after we write the new one
                try:
                    os.remove(existing_path)
                    logger.info(f"Removed old file: {existing_path}")
                except OSError as e:
                    logger.warning(f"Could not remove old file {existing_path}: {e}")

            # Write content to the clean filename
            with open(target_path, 'wb') as f:
                f.write(content)

            return True
        except Exception as e:
            logger.error(f"Save failed for {file_id}: {e}")
            return False
    
    def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
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
                        'display_name': sanitize_filename(filename),
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

    def __init__(self, storage_type: str = None, local_path: str = None):
        if storage_type is None:
            storage_type = current_app.config.get('STORAGE_TYPE', 'cloudinary')

        if local_path is None:
            local_path = current_app.config.get('LOCAL_STORAGE_PATH', 'static/files')

        if storage_type.lower() == 'local':
            self.storage = LocalStorage(local_path)
        elif storage_type.lower() == 'cloudinary':
            self.storage = CloudinaryStorage()
        else:
            raise ValueError(f"Unsupported storage type: {storage_type}")

    def upload(self, file: IO, filename: str) -> Dict[str, Any]:
        """Upload a file using the configured storage backend"""
        # Sanitize filename before uploading
        clean_name = sanitize_filename(filename)
        return self.storage.upload(file, clean_name)
    
    def download(self, file_id: str) -> bytes:
        """Download file content using the configured storage backend"""
        return self.storage.download(file_id)
    
    def delete(self, file_id: str) -> bool:
        """Delete a file using the configured storage backend"""
        return self.storage.delete(file_id)
    
    def save(self, file_id: str, content: bytes) -> bool:
        """Save/overwrite file content using the configured storage backend"""
        return self.storage.save(file_id, content)
    
    def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """List files using the configured storage backend"""
        return self.storage.list_files(prefix)
    
    def get_file_url(self, file_id: str) -> str:
        """Get file URL using the configured storage backend"""
        return self.storage.get_file_url(file_id)