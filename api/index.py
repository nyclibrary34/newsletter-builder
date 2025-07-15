from flask import Flask
import cloudinary
import os
import sys
from datetime import datetime

# Add parent directory to path BEFORE importing local modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now import local modules
from config import config
from routes.main import main_bp
from routes.newsletter import newsletter_bp
from routes.tools import tools_bp


def create_app():
    """Application factory function"""
    # Get the parent directory path for templates and static folders
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_folder = os.path.join(parent_dir, 'templates')
    static_folder = os.path.join(parent_dir, 'static')

    app = Flask(__name__, template_folder=template_folder,
                static_folder=static_folder)

    # Load configuration
    env = os.environ.get('FLASK_ENV', 'development')
    app.config.from_object(config[env])

    # Initialize Cloudinary
    cloudinary.config(
        cloud_name=app.config['CLOUDINARY_CLOUD_NAME'],
        api_key=app.config['CLOUDINARY_API_KEY'],
        api_secret=app.config['CLOUDINARY_API_SECRET']
    )

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(newsletter_bp)
    app.register_blueprint(tools_bp, url_prefix='/tools')

    # Custom Jinja2 filter for date formatting
    @app.template_filter('format_datetime')
    def format_datetime(date_string):
        """Format ISO date string to user-friendly format with time"""
        try:
            # Parse the ISO date string
            dt = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
            # Format as "Jul 13, 2025 at 8:31 PM"
            return dt.strftime("%b %d, %Y at %I:%M %p")
        except (ValueError, AttributeError):
            return date_string

    return app


# Create application instance
app = create_app()

if __name__ == '__main__':
    app.run(debug=app.config['DEBUG'], port=app.config['PORT'])
