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
            
            # Create folder path: newsletters/YYYY/MMMM/
            folder_path = f"newsletters/{year}/{month}"
            
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
            month = current_date.strftime('%B')
            
            # Create folder path: newsletters/YYYY/MMMM/
            folder_path = f"newsletters/{year}/{month}"
            full_folder_path = os.path.join(self.full_path, folder_path)
            
            # Ensure directory exists
            os.makedirs(full_folder_path, exist_ok=True)
            
            # Save file
            file_path = os.path.join(full_folder_path, filename)
            file.seek(0)  # Reset file pointer
            with open(file_path, 'wb') as f:
                shutil.copyfileobj(file, f)
            
            # Get file stats
            stat = os.stat(file_path)
            file_id = f"{folder_path}/{filename}"
            
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
            file_path = os.path.join(self.full_path, file_id)
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
        return self.storage.upload(file, filename)
    
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