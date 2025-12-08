# Newsletter Builder

A comprehensive newsletter/email template editing application built with GrapesJS, featuring advanced image processing tools and HTML-to-PDF conversion capabilities. Optimized for email client compatibility with smart HTML processing.

## 🚀 Features

### Newsletter Editor

- **Visual Newsletter Builder**: Drag-and-drop interface powered by GrapesJS
- **Rich Text Editing**: CKEditor integration for advanced text formatting
- **Template Management**: Save, load, and organize newsletter templates (local or Cloudinary storage)
- **Real-time Preview**: Live preview with instant feedback using SweetAlert2
- **Smart Email Export**: Client-side HTML processor with automatic email compatibility fixes

### Advanced Image Processing

- **Batch Enhancement**: Process up to 10 images simultaneously with Web Workers
- **Automatic Enhancement**: AI-powered histogram analysis for optimal image quality
- **Manual Controls**: Fine-tune brightness, contrast, saturation, and sharpness
- **Intelligent Compression**: Automatic size optimization while maintaining quality
- **Multiple Formats**: Support for JPG, PNG, WebP, GIF, and BMP files
- **Real-time Preview**: Debounced live preview during manual adjustments

### File Conversion Tools

- **HTML to PDF**: Convert HTML files to single-page PDF documents
- **HTML Compression**: Minify and optimize HTML files
- **JPG Compression**: Quality-based JPEG compression with size targeting
- **Batch Processing**: Handle multiple files with progress tracking

### Email Compatibility

- **Smart HTML Processing**: Client-side CSS inlining and ID cleanup
- **Multi-Client Support**: Optimized for Gmail, Yahoo, Outlook, and Apple Mail
- **Automatic Fixes**: HTTP→HTTPS conversion, MSO properties, bgcolor fallbacks
- **Layout Preservation**: Maintains design integrity while improving compatibility

### User Experience

- **Responsive Design**: Mobile-friendly interface with Bootstrap 5.3
- **Intuitive Feedback**: SweetAlert2 integration for all user interactions
- **Secure Downloads**: Flask-served files to prevent mixed content warnings
- **File Management**: Comprehensive upload, rename, and deletion capabilities

## 🛠️ Technology Stack

### Frontend

- **GrapesJS**: Visual page builder framework
- **Bootstrap 5.3**: Responsive UI framework
- **SweetAlert2**: Beautiful alert system
- **CKEditor**: Rich text editing capabilities
- **Web Workers**: Background image processing

### Backend

- **Flask**: Python web framework
- **Cloudinary**: Cloud-based file storage and management (optional)
- **Playwright**: HTML-to-PDF conversion engine
- **Pillow (PIL)**: Advanced image processing library

## 📦 Dependencies & Packages

### Production Dependencies

These packages are required to run the application:

| Package            | Version | Purpose                                                                 |
| ------------------ | ------- | ----------------------------------------------------------------------- |
| **Flask**          | 3.1.1   | Core web framework for building the API and serving the application     |
| **Cloudinary**     | 1.44.1  | Cloud-based file storage, management, and image delivery service        |
| **python-dotenv**  | 1.1.1   | Loads environment variables from `.env` file for configuration          |
| **requests**       | 2.32.4  | HTTP library for making external API calls and requests                 |
| **Pillow (PIL)**   | 11.3.0  | Image processing library for enhancing, resizing, and converting images |
| **Jinja2**         | 3.1.6   | Template engine for rendering HTML templates on the server              |
| **Werkzeug**       | 3.1.3   | WSGI utility library that powers Flask's request/response handling      |
| **blinker**        | 1.9.0   | Signal support for Flask events and notifications                       |
| **itsdangerous**   | 2.2.0   | Secure signing and verification for Flask session data                  |
| **MarkupSafe**     | 3.0.2   | Safe HTML string handling to prevent XSS vulnerabilities                |
| **click**          | 8.2.1   | Command-line interface creation kit used by Flask                       |
| **Flask-Compress** | 1.15    | Compresses Flask responses (gzip) for smaller file sizes                |

### Development Dependencies

These packages are used during development and testing:

| Package               | Version  | Purpose                                                              |
| --------------------- | -------- | -------------------------------------------------------------------- |
| **sentry-sdk[flask]** | 2.19.2   | Error tracking and performance monitoring via GlitchTip integration  |
| **sentry-cli**        | 2.56.1   | Command-line tool for managing Sentry/GlitchTip releases             |
| **pytest**            | 7.4.0    | Testing framework for writing and running unit tests                 |
| **pytest-flask**      | 1.2.0    | Pytest plugin with fixtures for Flask application testing            |
| **pytest-cov**        | 4.1.0    | Code coverage measurement plugin for pytest                          |
| **black**             | 23.7.0   | Python code formatter ensuring consistent code style                 |
| **flake8**            | 6.0.0    | Linter tool for checking Python code quality and style compliance    |
| **mypy**              | 1.5.0    | Static type checker for Python type hint validation                  |
| **isort**             | 5.12.0   | Python import statement sorter and organizer                         |
| **pre-commit**        | 3.3.0    | Framework for managing git pre-commit hooks                          |
| **types-requests**    | 2.31.0.2 | Type hints for the requests library                                  |
| **types-pillow**      | 10.0.0.3 | Type hints for the Pillow image processing library                   |
| **beautifulsoup4**    | 4.14.2   | HTML/XML parsing library for parsing and manipulating HTML documents |

### How Packages Are Organized

- **Production dependencies** (`api/requirements.txt`): Required for running the application in production
- **Development dependencies** (`requirements-dev.txt`): Used for testing, code quality, and development tools only
- Install both for development: `pip install -r api/requirements.txt -r requirements-dev.txt`
- Install only production dependencies for deployment: `pip install -r api/requirements.txt`

## 📋 Prerequisites

- Python 3.11 or higher
- Cloudinary account for cloud storage (optional - local storage available)
- Browserless.io account (optional, for enhanced PDF conversion)

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/nyclibrary34/newsletter-builder.git
cd newsletter-builder
```

### 2. Install Dependencies

```bash
# Install Python dependencies
pip install -r api/requirements.txt

# Install development dependencies (includes GlitchTip monitoring, testing tools, etc.)
pip install -r requirements-dev.txt
```

### 3. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

Required environment variables:

```bash
# Storage Configuration (Required)
STORAGE_TYPE=cloudinary  # Options: 'local' or 'cloudinary'
LOCAL_STORAGE_PATH=static/files  # Only needed if using local storage

# Cloudinary Configuration (Required if using cloudinary storage)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Flask Configuration (Required)
FLASK_SECRET_KEY=your_generated_secret_key_here

# Flask Application Settings (Configurable)
FLASK_ENV=development  # Options: development, production, testing
FLASK_DEBUG=true       # true for development, false for production
FLASK_PORT=5000        # Default Flask port

# Optional Services
BROWSERLESS_TOKEN=your_browserless_token_here

# Development Only - GlitchTip Error Monitoring
SENTRY_DSN=your_glitchtip_dsn_here  # DSN from GlitchTip
ENABLE_SENTRY=false  # Set to true to activate monitoring
```

### 4. Generate Flask Secret Key

```bash
python -c "import secrets; print('FLASK_SECRET_KEY=' + secrets.token_hex())"
```

## 🚀 Quick Start

### Development Server

```bash
# Start the Flask development server
python api/index.py

# The application will be available at:
# http://localhost:5000
```

### Local Testing

1. Navigate to `http://localhost:5000`
2. Access the Newsletter Builder from the sidebar
3. Upload images for processing via Image Adjustment tool
4. Test HTML-to-PDF conversion with sample files

## ⚙️ Configuration

### Storage Configuration

#### Local Storage (`STORAGE_TYPE=local`)

- Files stored in `static/files/` directory
- Good for development or small deployments
- No external dependencies
- No Cloudinary credentials needed

#### Cloudinary Storage (`STORAGE_TYPE=cloudinary`)

- Files stored in Cloudinary cloud service
- Good for production deployments
- Requires Cloudinary account and API credentials

#### Configuration Examples

```bash
# Local storage configuration
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=static/files

# Cloudinary storage configuration
STORAGE_TYPE=cloudinary
CLOUDINARY_CLOUD_NAME=my-company-cloud
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz-1234567
```

### Cloudinary Setup

1. Create account at [cloudinary.com](https://cloudinary.com/)
2. Go to console: [cloudinary.com/console](https://cloudinary.com/console)
3. Copy your Cloud Name, API Key, and API Secret
4. Add credentials to environment variables

### Browserless.io Setup (Optional)

Browserless.io provides cloud-based browser automation for HTML-to-PDF conversion.

1. Create account at [browserless.io](https://www.browserless.io/)
2. Get your API token from the dashboard
3. Add token to environment variables
4. Fallback to local Playwright if not configured

### GlitchTip Error Monitoring (Development Only)

GlitchTip provides real-time error tracking and performance monitoring for development and staging environments.

**Important**: GlitchTip is a **development dependency only** and should not be deployed to production.

1. Create account at [glitchtip.com](https://glitchtip.com)
2. Create a new Flask project
3. Copy the DSN from your project settings
4. Install development dependencies: `pip install -r requirements-dev.txt`
5. Configure environment variables:
   ```bash
   SENTRY_DSN=your_glitchtip_dsn_here
   ENABLE_SENTRY=true
   ```

**Benefits**:

- Real-time error tracking and alerts
- Performance monitoring and insights
- Release tracking and deployment monitoring
- Self-hosted or cloud options available

**Development vs Production**:

- ✅ Use in development, testing, and staging environments
- ❌ Do not include in production deployments
- ❌ Not included in `api/requirements.txt` (production dependencies)
- ✅ Available in `requirements-dev.txt` (development dependencies)

### Flask Configuration

The application supports multiple environments:

- **Development**: Debug mode enabled, detailed error messages, GlitchTip monitoring
- **Production**: Debug mode disabled, optimized performance, generic error pages
- **Testing**: Special configuration for automated testing

Configure via environment variables:

```bash
# Development environment
FLASK_ENV=development
FLASK_DEBUG=true
ENABLE_SENTRY=true

# Production environment
FLASK_ENV=production
FLASK_DEBUG=false
ENABLE_SENTRY=false
```

## 📖 Usage Guide

### Newsletter Editor

1. **Create New Newsletter**: Click "Newsletter Builder" from the main interface
2. **Design Interface**: Use the drag-and-drop editor to build your newsletter
3. **Add Content**: Insert text, images, buttons, and other components
4. **Save Templates**: Templates can be saved locally or to Cloudinary storage
5. **Export Newsletter**: Use the export button to download optimized HTML

### Image Processing

1. **Upload Images**: Select up to 10 images for batch processing
2. **Auto Enhancement**: Let AI optimize your images automatically
3. **Manual Adjustments**: Fine-tune brightness, contrast, saturation, and sharpness
4. **Download Results**: Get optimized images with intelligent compression

### File Conversion

1. **HTML to PDF**: Upload HTML files for PDF conversion
2. **HTML Compression**: Minify HTML files for optimal performance
3. **JPG Compression**: Compress JPEG images with quality control
4. **Batch Operations**: Process multiple files simultaneously

### Email Compatibility

The newsletter export process automatically:

- Inlines all CSS styles for maximum email client compatibility
- Converts HTTP URLs to HTTPS for security
- Adds MSO properties for Microsoft Outlook support
- Includes bgcolor fallbacks for consistent colors
- Preserves layout integrity while optimizing for email

## 🔧 Troubleshooting

### Common Issues

#### Import Errors

If you encounter import errors, ensure all dependencies are installed:

```bash
pip install -r api/requirements.txt
```

#### Storage Configuration Issues

- **Local Storage**: Ensure the `LOCAL_STORAGE_PATH` directory exists and is writable
- **Cloudinary Storage**: Verify all three Cloudinary credentials are correct

#### File Upload/Download Issues

- Check file permissions in the storage directory
- Ensure Flask has write access to the configured storage path
- Verify Cloudinary credentials if using cloud storage

#### PDF Conversion Failures

- Install Playwright browsers: `playwright install`
- Check Browserless.io token if using cloud service
- Ensure HTML files are properly formatted

### Debug Mode

Enable debug mode for detailed error information:

```bash
FLASK_DEBUG=true
FLASK_ENV=development
```

**Warning**: Never enable debug mode in production environments!

## 🏗️ Development Guidelines

### Environment Setup

1. Use virtual environment: `python -m venv venv`
2. Activate environment: `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows)
3. Install all dependencies: `pip install -r api/requirements.txt -r requirements-dev.txt`
4. Configure environment variables in `.env`
5. Start development server: `python api/index.py`

### Adding New Tools

1. Create tool interface in `templates/`
2. Add route in `routes/tools.py`
3. Implement business logic in `app/services/`
4. Update navigation in `templates/base.html`
