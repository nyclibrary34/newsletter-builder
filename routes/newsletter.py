from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, Response
import cloudinary
import cloudinary.uploader
import cloudinary.api
import os
import requests
from urllib.parse import unquote
from datetime import datetime

newsletter_bp = Blueprint('newsletter', __name__)

@newsletter_bp.route('/')
def index():
    """Redirect to newsletter upload"""
    return redirect(url_for('newsletter.upload'))

@newsletter_bp.route('/newsletter-upload')
def upload():
    """Main newsletter upload page"""
    files = cloudinary.api.resources(
        type="upload", resource_type="raw", prefix="newsletters/")
    return render_template('upload.html', files=files['resources'])

@newsletter_bp.route('/newsletter-upload', methods=['POST'])
def upload_file():
    """Handle newsletter file upload"""
    if 'file' not in request.files:
        flash('No file part')
        return redirect(request.url)
    file = request.files['file']
    if file.filename == '':
        flash('No selected file')
        return redirect(request.url)
    if file:
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
                public_id=f"{folder_path}/{file.filename}"
            )
            flash('File successfully uploaded')
            return redirect(url_for('newsletter.upload'))
        except Exception as e:
            flash(f"An error occurred: {e}")
            return redirect(request.url)

@newsletter_bp.route('/edit/<path:file_id>')
def edit_file(file_id):
    """Edit a newsletter file in the editor"""
    cloud_name = current_app.config['CLOUDINARY_CLOUD_NAME']
    return render_template('editor.html', file_id=file_id, cloud_name=cloud_name)

@newsletter_bp.route('/delete/<path:file_id>')
def delete_file(file_id):
    """Delete a newsletter file"""
    try:
        cloudinary.uploader.destroy(file_id, resource_type="raw")
        flash('File successfully deleted')
    except Exception as e:
        flash(f"An error occurred: {e}")
    return redirect(url_for('newsletter.upload'))

@newsletter_bp.route('/download/<path:file_id>')
def download_file(file_id):
    """Download a newsletter file"""
    try:
        # Get the Cloudinary URL
        url = cloudinary.utils.cloudinary_url(file_id, resource_type="raw")[0]
        
        # Fetch the file from Cloudinary
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Extract filename from file_id
        filename = file_id.split('/')[-1]
        filename = unquote(filename)  # Decode URL-encoded characters
        
        # Determine content type based on file extension
        content_type = 'application/octet-stream'  # Default
        if filename.lower().endswith('.html'):
            content_type = 'text/html'
        elif filename.lower().endswith('.txt'):
            content_type = 'text/plain'
        elif filename.lower().endswith('.json'):
            content_type = 'application/json'
        elif filename.lower().endswith('.xml'):
            content_type = 'application/xml'
        elif filename.lower().endswith('.css'):
            content_type = 'text/css'
        elif filename.lower().endswith('.js'):
            content_type = 'application/javascript'
        
        # Create a Flask response with proper headers
        def generate():
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk
        
        return Response(
            generate(),
            mimetype=content_type,
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': content_type,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        )
        
    except requests.RequestException as e:
        flash(f"Error downloading file: {str(e)}")
        return redirect(url_for('newsletter.upload'))
    except Exception as e:
        flash(f"An error occurred: {str(e)}")
        return redirect(url_for('newsletter.upload'))

@newsletter_bp.route('/save/<path:file_id>', methods=['POST'])
def save_file(file_id):
    """Save newsletter file content"""
    try:
        data = request.data
        cloudinary.uploader.upload(
            data,
            public_id=file_id,
            resource_type="raw",
            overwrite=True,
            invalidate=True
        )
        return "File saved successfully", 200
    except Exception as e:
        return str(e), 500

# Legacy route for backward compatibility
@newsletter_bp.route('/upload')
def upload_form():
    return redirect(url_for('newsletter.upload'))

@newsletter_bp.route('/upload', methods=['POST'])
def upload_file_legacy():
    return upload_file()
