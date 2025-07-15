from flask import Blueprint, render_template, redirect, url_for

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """Main index route - redirect to newsletter upload"""
    return redirect(url_for('newsletter.upload'))

@main_bp.route('/tool-preview/<tool_name>')
def tool_preview(tool_name):
    """Renders a preview page for a given tool."""
    tool_titles = {
        'html-to-pdf': 'Html To Pdf',
        # Add other tools here
    }
    tool_title = tool_titles.get(tool_name, 'Tool Preview')
    return render_template('tool_preview.html', tool_title=tool_title)