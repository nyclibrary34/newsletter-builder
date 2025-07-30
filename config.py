import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Base configuration class"""
    # Flask configuration
    SECRET_KEY = os.environ.get('FLASK_SECRET_KEY', 'a_default_secret_key')
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    PORT = int(os.environ.get('FLASK_PORT', 5000))

    # Cloudinary configuration (only required if using cloudinary storage)
    CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME')
    CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY')
    CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET')

    # Browserless configuration (optional)
    BROWSERLESS_TOKEN = os.environ.get('BROWSERLESS_TOKEN')

    # Storage configuration
    STORAGE_TYPE = os.environ.get('STORAGE_TYPE', 'cloudinary')  # 'local' or 'cloudinary'
    LOCAL_STORAGE_PATH = os.environ.get('LOCAL_STORAGE_PATH', 'static/files')

    # Sentry configuration (development/staging only)
    SENTRY_DSN = os.environ.get('SENTRY_DSN')
    ENABLE_SENTRY = os.environ.get('ENABLE_SENTRY', 'false').lower() == 'true'

    @staticmethod
    def init_app(app):
        """Initialize application with configuration"""
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
    """Development configuration"""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False


# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
