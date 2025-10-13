"""
Application configuration management with type safety and validation.
"""

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def _get_int_env(name: str, default: int) -> int:
    """Safely parse integer environment values with fallback."""
    value = os.environ.get(name, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _get_float_env(name: str, default: float) -> float:
    """Safely parse float environment values with fallback."""
    value = os.environ.get(name, default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


class Config:
    """Base configuration class with type hints and validation."""
    
    # Flask Core Configuration
    SECRET_KEY: str = os.environ.get('FLASK_SECRET_KEY', 'dev-key-change-in-production')
    DEBUG: bool = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    PORT: int = int(os.environ.get('FLASK_PORT', 5000))
    
    # Cloudinary Configuration (optional)
    CLOUDINARY_CLOUD_NAME: Optional[str] = os.environ.get('CLOUDINARY_CLOUD_NAME')
    CLOUDINARY_API_KEY: Optional[str] = os.environ.get('CLOUDINARY_API_KEY')
    CLOUDINARY_API_SECRET: Optional[str] = os.environ.get('CLOUDINARY_API_SECRET')
    
    # Storage Configuration
    STORAGE_TYPE: str = os.environ.get('STORAGE_TYPE', 'cloudinary')  # 'local' or 'cloudinary'
    LOCAL_STORAGE_PATH: str = os.environ.get('LOCAL_STORAGE_PATH', 'static/files')
    
    # External Services (optional)
    BROWSERLESS_TOKEN: Optional[str] = os.environ.get('BROWSERLESS_TOKEN')
    
    # Performance Tuning
    STATIC_CACHE_TIMEOUT: int = _get_int_env('STATIC_CACHE_TIMEOUT', 604800)  # 7 days
    STORAGE_CACHE_TTL: int = _get_int_env('STORAGE_CACHE_TTL', 120)  # 2 minutes
    ENABLE_COMPRESSION: bool = os.environ.get('ENABLE_COMPRESSION', 'True').lower() == 'true'
    
    # Monitoring Configuration (optional)
    SENTRY_DSN: Optional[str] = os.environ.get('SENTRY_DSN')
    ENABLE_SENTRY: bool = os.environ.get('ENABLE_SENTRY', 'False').lower() == 'true'
    SENTRY_TRACES_SAMPLE_RATE: float = _get_float_env('SENTRY_TRACES_SAMPLE_RATE', 0.1)
    
    # Security Configuration
    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_ALLOWED_EXTENSIONS: set = {'html', 'htm', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'}
    
    @staticmethod
    def init_app(app) -> None:
        """Initialize application with configuration validation."""
        # Validate Cloudinary credentials if using cloudinary storage
        storage_type = app.config.get('STORAGE_TYPE', 'cloudinary').lower()
        if storage_type == 'cloudinary':
            missing_credentials = []
            if not app.config.get('CLOUDINARY_CLOUD_NAME'):
                missing_credentials.append('CLOUDINARY_CLOUD_NAME')
            if not app.config.get('CLOUDINARY_API_KEY'):
                missing_credentials.append('CLOUDINARY_API_KEY')
            if not app.config.get('CLOUDINARY_API_SECRET'):
                missing_credentials.append('CLOUDINARY_API_SECRET')
            
            if missing_credentials:
                raise ValueError(
                    f"Missing required Cloudinary credentials for cloudinary storage: {', '.join(missing_credentials)}. "
                    f"Either set these environment variables or change STORAGE_TYPE to 'local' in your .env file."
                )


class DevelopmentConfig(Config):
    """Development environment configuration."""
    DEBUG = True
    ENABLE_SENTRY = True  # Enable Sentry in development if DSN is provided


class ProductionConfig(Config):
    """Production environment configuration."""
    DEBUG = False
    # Sentry enabled only if explicitly configured
    

class TestingConfig(Config):
    """Testing environment configuration."""
    TESTING = True
    DEBUG = True
    STORAGE_TYPE = 'local'  # Use local storage for testing
    LOCAL_STORAGE_PATH = 'test_files'


# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config(env: Optional[str] = None) -> Config:
    """Get configuration class for the specified environment."""
    if env is None:
        env = os.environ.get('FLASK_ENV', 'development')
    return config.get(env, config['default'])
