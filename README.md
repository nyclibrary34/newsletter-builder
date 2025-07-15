# GrapesJS Newsletter Editor

A comprehensive newsletter/email template editing application built with GrapesJS, featuring advanced image processing tools and HTML-to-PDF conversion capabilities. Designed for both development and production deployment on Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/grapesjs-newsletter-editor)

## 🚀 Features

### Newsletter Editor
- **Visual Newsletter Builder**: Drag-and-drop interface powered by GrapesJS
- **Rich Text Editing**: CKEditor integration for advanced text formatting
- **Template Management**: Save, load, and organize newsletter templates via Cloudinary
- **Real-time Preview**: Live preview with instant feedback using SweetAlert2
- **Export Options**: Download as complete HTML files with embedded styles

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
- **Cloudinary**: Cloud-based file storage and management
- **Playwright**: HTML-to-PDF conversion engine
- **Pillow (PIL)**: Advanced image processing library

### Deployment
- **Vercel**: Serverless deployment platform
- **Python 3.11**: Runtime environment

## 📋 Prerequisites

- Python 3.11 or higher
- Node.js (for Vercel CLI)
- Cloudinary account for file storage
- Browserless.io account (optional, for enhanced PDF conversion)

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/grapesjs-newsletter-editor.git
cd grapesjs-newsletter-editor
```

### 2. Install Dependencies
```bash
# Install Python dependencies
pip install -r api/requirements.txt
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
# Cloudinary Configuration (Required)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Flask Configuration (Required)
FLASK_SECRET_KEY=your_generated_secret_key_here

# Optional Services
BROWSERLESS_TOKEN=your_browserless_token_here
FLASK_ENV=development
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
# http://localhost:5002
```

### Local Testing
1. Navigate to `http://localhost:5002`
2. Access the Newsletter Builder from the sidebar
3. Upload images for processing via Image Adjustment tool
4. Test HTML-to-PDF conversion with sample files

## 🌐 Deployment

### Vercel Deployment

#### Method 1: One-Click Deploy
Click the "Deploy with Vercel" button above for instant deployment.

#### Method 2: Manual Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

#### Environment Variables for Vercel
Configure these in your Vercel dashboard:

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name | ✅ |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key | ✅ |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret | ✅ |
| `FLASK_SECRET_KEY` | Flask session security key | ✅ |
| `BROWSERLESS_TOKEN` | Browserless.io API token | ❌ |
| `FLASK_ENV` | Set to `production` | ✅ |

### Alternative Deployment Platforms

The application can also be deployed on:
- **Heroku**: Add `Procfile` with `web: python api/index.py`
- **Railway**: Configure build command and environment variables
- **Google Cloud Run**: Use Docker with Python 3.11 base image
- **AWS Lambda**: Use Zappa for serverless deployment

## 📖 Usage Guide

### Newsletter Editor
1. **Access Editor**: Click "Newsletter Builder" in the sidebar
2. **Upload Template**: Upload existing HTML files or start from scratch
3. **Edit Content**: Use the visual editor to modify layouts and content
4. **Rich Text**: Double-click text elements to access CKEditor
5. **Save Project**: Use the save button to store templates in Cloudinary
6. **Export**: Download complete HTML files with embedded styles

### Image Processing
1. **Upload Images**: Select up to 10 images (5MB total limit for Vercel)
2. **Auto-Enhancement**: Toggle automatic enhancement for optimal quality
3. **Manual Adjustment**: Use sliders for precise control over image properties
4. **Batch Processing**: Process multiple images simultaneously
5. **Download Results**: Individual or batch download of enhanced images

### File Conversion
1. **HTML to PDF**: Upload HTML files for PDF conversion
2. **HTML Compression**: Minify HTML files for better performance
3. **JPG Compression**: Compress JPEG images with quality control

## 🔧 Configuration

### Cloudinary Setup
1. Create account at [cloudinary.com](https://cloudinary.com)
2. Navigate to Dashboard to find your credentials
3. Add credentials to environment variables
4. Configure upload presets if needed

### Browserless.io Setup (Optional)
1. Create account at [browserless.io](https://www.browserless.io)
2. Generate API token
3. Add token to environment variables
4. Fallback to local Playwright if not configured

### Flask Configuration
The application supports multiple environments:
- **Development**: Debug mode enabled, detailed error messages
- **Production**: Optimized performance, secure error handling

## 🛡️ Security Features

- **Input Validation**: File type and size restrictions
- **Secure File Serving**: Flask-routed downloads prevent mixed content
- **Environment Variables**: Sensitive data stored securely
- **CSRF Protection**: Flask-WTF integration for form security
- **Content Security**: Cloudinary integration for secure file storage

## 🎨 Customization

### Adding New Tools
1. Create new route in `routes/tools.py`
2. Add template in `templates/` directory
3. Update navigation in `templates/base.html`
4. Implement processing logic with proper error handling

### Styling Modifications
- **CSS**: Modify styles in template files or add to `static/stylesheets/`
- **Bootstrap**: Customize Bootstrap variables for consistent theming
- **JavaScript**: Extend functionality in template-specific script blocks

### GrapesJS Extensions
- **Plugins**: Add new GrapesJS plugins via CDN or local files
- **Components**: Create custom components for newsletter elements
- **Commands**: Implement additional editor commands and buttons

## 📊 Performance Optimization

### Client-Side
- **Web Workers**: Background image processing to prevent UI blocking
- **Debounced Updates**: Optimized real-time preview rendering
- **Progressive Loading**: Lazy loading for large image sets
- **Compression**: Intelligent file size optimization

### Server-Side
- **Cloudinary CDN**: Global content delivery for fast file access
- **Caching**: Browser and server-side caching strategies
- **Compression**: Gzip compression for static assets
- **Error Handling**: Graceful degradation for service failures

## 🐛 Troubleshooting

### Common Issues

#### Import Errors
```bash
# Ensure all dependencies are installed
pip install -r api/requirements.txt

# Check Python version
python --version  # Should be 3.11+
```

#### Cloudinary Connection Issues
```bash
# Verify credentials in .env file
# Check Cloudinary dashboard for quota limits
# Ensure API credentials have proper permissions
```

#### PDF Conversion Failures
```bash
# Install Playwright browsers (if using local conversion)
playwright install

# Verify Browserless token if using cloud service
# Check file size limits (5MB for Vercel)
```

#### Mixed Content Warnings
- Ensure files are served through Flask routes, not direct Cloudinary URLs
- Check HTTPS configuration in production
- Verify CDN resources use HTTPS

### Debug Mode
Enable detailed logging:
```bash
export FLASK_ENV=development
python api/index.py
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with proper documentation
4. Add tests for new functionality
5. Commit changes: `git commit -m 'Add feature description'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

### Development Guidelines
- **Code Style**: Follow PEP 8 for Python, use meaningful variable names
- **Documentation**: Update README and CLAUDE.md for significant changes
- **Testing**: Add unit tests for new features
- **Comments**: Document complex algorithms and business logic

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **GrapesJS**: Amazing visual page builder framework
- **Cloudinary**: Robust cloud-based media management
- **Bootstrap**: Comprehensive CSS framework
- **SweetAlert2**: Beautiful alert system
- **Flask**: Lightweight and flexible Python web framework
- **Vercel**: Seamless deployment platform

## 📞 Support

For support and questions:
- **Issues**: Use GitHub Issues for bug reports
- **Discussions**: Use GitHub Discussions for general questions
- **Documentation**: Refer to CLAUDE.md for detailed technical information
- **Email**: [your-email@example.com](mailto:your-email@example.com)

## 🔄 Changelog

### Version 2.0.0
- Restructured for Vercel deployment
- Added comprehensive template documentation
- Implemented SweetAlert2 integration
- Enhanced security with Flask-served downloads
- Improved error handling and user feedback

### Version 1.0.0
- Initial release with GrapesJS newsletter editor
- Basic image processing tools
- HTML-to-PDF conversion
- Cloudinary integration

---

**Built with ❤️ for the developer community**