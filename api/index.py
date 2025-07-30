"""
Newsletter Builder - Vercel Entry Point
Enhanced with proper configuration management and optional monitoring.
"""

from flask import Flask
import cloudinary
import os
import sys
from datetime import datetime
from typing import Optional

# Add parent directory to path BEFORE importing local modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import enhanced configuration
from app.config.settings import get_config

# Import routes
from routes.main import main_bp
from routes.newsletter import newsletter_bp
from routes.tools import tools_bp


def init_sentry(app: Flask) -> None:
    """Initialize Sentry monitoring if configured."""
    sentry_enabled = app.config.get('ENABLE_SENTRY')
    sentry_dsn = app.config.get('SENTRY_DSN')
    
    print(f"🔍 SENTRY STATUS CHECK:")
    print(f"   ENABLE_SENTRY: {sentry_enabled}")
    print(f"   SENTRY_DSN configured: {'Yes' if sentry_dsn else 'No'}")
    
    if sentry_enabled and sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.flask import FlaskIntegration
            
            sentry_sdk.init(
                dsn=sentry_dsn,
                integrations=[FlaskIntegration()],
                traces_sample_rate=0.1,  # Adjust based on needs
                environment=os.environ.get('FLASK_ENV', 'development')
            )
            print("✅ SENTRY: ON - Monitoring initialized successfully")
            app.logger.info("Sentry monitoring initialized")
        except ImportError:
            print("❌ SENTRY: OFF - SDK not available")
            app.logger.warning("Sentry SDK not available - monitoring disabled")
        except Exception as e:
            print(f"❌ SENTRY: FAILED - {str(e)}")
            app.logger.error(f"Failed to initialize Sentry: {str(e)}")
    else:
        print("❌ SENTRY: OFF - Not configured or disabled")
        if not sentry_enabled:
            print("   Reason: ENABLE_SENTRY is false or not set")
        if not sentry_dsn:
            print("   Reason: SENTRY_DSN is not configured")


def create_app(config_name: Optional[str] = None) -> Flask:
    """
    Enhanced application factory function with proper error handling.
    
    Args:
        config_name: Configuration environment name
        
    Returns:
        Configured Flask application instance
    """
    # Get the parent directory path for templates and static folders
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_folder = os.path.join(parent_dir, 'templates')
    static_folder = os.path.join(parent_dir, 'static')

    app = Flask(__name__, 
                template_folder=template_folder,
                static_folder=static_folder)

    # Load enhanced configuration
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    config_class = get_config(config_name)
    app.config.from_object(config_class)
    
    # Initialize configuration validation
    config_class.init_app(app)
    
    # Initialize Sentry monitoring (optional)
    init_sentry(app)

    # Initialize Cloudinary only if using cloudinary storage
    if app.config.get('STORAGE_TYPE', 'cloudinary').lower() == 'cloudinary':
        try:
            cloudinary.config(
                cloud_name=app.config['CLOUDINARY_CLOUD_NAME'],
                api_key=app.config['CLOUDINARY_API_KEY'],
                api_secret=app.config['CLOUDINARY_API_SECRET']
            )
            app.logger.info("Cloudinary initialized successfully")
        except Exception as e:
            app.logger.error(f"Failed to initialize Cloudinary: {str(e)}")
            raise

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(newsletter_bp)
    app.register_blueprint(tools_bp, url_prefix='/tools')

    # Security headers middleware
    @app.after_request
    def add_security_headers(response):
        """Add security headers to all responses."""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        return response

    # Custom Jinja2 filter for date formatting
    @app.template_filter('format_datetime')
    def format_datetime(date_string: str) -> str:
        """Format ISO date string to user-friendly format with time."""
        try:
            # Parse the ISO date string
            dt = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
            # Format as "Jul 13, 2025 at 8:31 PM"
            return dt.strftime("%b %d, %Y at %I:%M %p")
        except (ValueError, AttributeError):
            return date_string

    # Health check endpoint
    @app.route('/health')
    def health_check():
        """Health check endpoint for monitoring."""
        return {'status': 'healthy', 'version': '1.0.0'}

    app.logger.info(f"Application initialized successfully in {config_name} mode")
    return app


# Create application instance for Vercel
app = create_app()

if __name__ == '__main__':
    app.run(debug=app.config['DEBUG'], port=app.config['PORT'])
