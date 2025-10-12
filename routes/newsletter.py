from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, Response
import cloudinary
import cloudinary.uploader
import cloudinary.api
import os
import requests
from urllib.parse import unquote
from datetime import datetime
from utils.storage import StorageManager, sanitize_filename

newsletter_bp = Blueprint('newsletter', __name__)

@newsletter_bp.route('/')
def index():
    """Redirect to newsletter upload"""
    return redirect(url_for('newsletter.upload'))

@newsletter_bp.route('/newsletter-upload')
def upload():
    """Main newsletter upload page"""
    storage = StorageManager()
    files = storage.list_files("newsletters/")
    return render_template('upload.html', files=files)

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
            storage = StorageManager()
            result = storage.upload(file, file.filename)
            
            if result['success']:
                flash('File successfully uploaded')
            else:
                flash(f"Upload failed: {result.get('error', 'Unknown error')}")
            
            return redirect(url_for('newsletter.upload'))
        except Exception as e:
            flash(f"An error occurred: {e}")
            return redirect(request.url)

@newsletter_bp.route('/edit/<path:file_id>')
def edit_file(file_id):
    """Edit a newsletter file in the editor"""
    cloud_name = current_app.config['CLOUDINARY_CLOUD_NAME']
    storage_type = current_app.config['STORAGE_TYPE']

    # Extract and sanitize filename for display
    display_filename = file_id.split('/')[-1]
    display_filename = sanitize_filename(display_filename)

    return render_template('editor.html',
                         file_id=file_id,
                         display_filename=display_filename,
                         cloud_name=cloud_name,
                         storage_type=storage_type)

@newsletter_bp.route('/content/<path:file_id>')
def get_file_content(file_id):
    """Get file content for editing (supports both local and cloud storage)"""
    try:
        storage = StorageManager()
        content = storage.download(file_id)
        
        # Return content as plain text for the editor
        return Response(
            content,
            mimetype='text/html',
            headers={
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        )
    except FileNotFoundError:
        return "File not found", 404
    except Exception as e:
        return f"Error loading file: {str(e)}", 500

@newsletter_bp.route('/delete/<path:file_id>')
def delete_file(file_id):
    """Delete a newsletter file"""
    try:
        storage = StorageManager()
        if storage.delete(file_id):
            flash('File successfully deleted')
        else:
            flash('Failed to delete file')
    except Exception as e:
        flash(f"An error occurred: {e}")
    return redirect(url_for('newsletter.upload'))

@newsletter_bp.route('/download/<path:file_id>')
def download_file(file_id):
    """Download a newsletter file"""
    try:
        storage = StorageManager()
        content = storage.download(file_id)
        
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
        
        return Response(
            content,
            mimetype=content_type,
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': content_type,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        )
        
    except FileNotFoundError:
        flash("File not found")
        return redirect(url_for('newsletter.upload'))
    except Exception as e:
        flash(f"An error occurred: {str(e)}")
        return redirect(url_for('newsletter.upload'))

@newsletter_bp.route('/save/<path:file_id>', methods=['POST'])
def save_file(file_id):
    """Save newsletter file content"""
    try:
        data = request.data
        storage = StorageManager()
        
        if storage.save(file_id, data):
            return "File saved successfully", 200
        else:
            return "Failed to save file", 500
    except Exception as e:
        return str(e), 500

# Legacy route for backward compatibility
@newsletter_bp.route('/upload')
def upload_form():
    return redirect(url_for('newsletter.upload'))

@newsletter_bp.route('/upload', methods=['POST'])
def upload_file_legacy():
    return upload_file()
