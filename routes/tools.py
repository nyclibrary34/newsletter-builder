from flask import Blueprint, render_template, request, jsonify, send_file
import logging
from io import BytesIO
import os
import json
import asyncio
import tempfile
from playwright.async_api import async_playwright

tools_bp = Blueprint('tools', __name__, template_folder='templates')

# === IMAGE PROCESSING ===


@tools_bp.route('/image-adjustment')
def image_adjustment():
    """Image adjustment tools page"""
    return render_template('image_adjustment.html')


@tools_bp.route('/image-info', methods=['POST'])
def image_info():
    """Image processing configuration endpoint"""
    try:
        data = request.get_json()
        # Return processing limits and capabilities
        return jsonify({
            'status': 'success',
            'message': 'Image processing ready',
            'max_images': 10,
            'max_size_mb': 5
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400


@tools_bp.route('/adjust-image', methods=['POST'])
def adjust_image():
    """Adjust image brightness, contrast, saturation, etc."""
    try:
        from PIL import Image, ImageEnhance

        image_file = request.files.get(
            'image_file') or request.files.get('file')

        if not image_file:
            return jsonify({'error': 'No image file provided'}), 400

        if image_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Validate file type
        allowed_extensions = {'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'}
        if not image_file.filename.lower().split('.')[-1] in allowed_extensions:
            return jsonify({'error': 'Invalid file type. Supported: JPG, PNG, GIF, BMP, WebP'}), 400

        brightness = float(request.form.get('brightness', 1.0))
        contrast = float(request.form.get('contrast', 1.0))
        saturation = float(request.form.get('saturation', 1.0))
        sharpness = float(request.form.get('sharpness', 1.0))

        image = Image.open(image_file)

        # Apply enhancement adjustments
        if brightness != 1.0:
            enhancer = ImageEnhance.Brightness(image)
            image = enhancer.enhance(brightness)

        if contrast != 1.0:
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(contrast)

        if saturation != 1.0:
            enhancer = ImageEnhance.Color(image)
            image = enhancer.enhance(saturation)

        if sharpness != 1.0:
            enhancer = ImageEnhance.Sharpness(image)
            image = enhancer.enhance(sharpness)

        # Prepare output
        output = BytesIO()
        image_format = image.format if image.format else 'PNG'
        image.save(output, format=image_format)
        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name=f"adjusted_{image_file.filename}",
            mimetype=f'image/{image_format.lower()}'
        )

    except Exception as e:
        logging.error(f"Image adjustment error: {str(e)}")
        return jsonify({'error': f'Image adjustment failed: {str(e)}'}), 500


@tools_bp.route('/resize-image', methods=['POST'])
def resize_image():
    """Resize image to specified dimensions"""
    try:
        from PIL import Image

        image_file = request.files.get(
            'image_file') or request.files.get('file')

        if not image_file:
            return jsonify({'error': 'No image file provided'}), 400

        if image_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        width = int(request.form.get('width', 0))
        height = int(request.form.get('height', 0))
        maintain_aspect = request.form.get(
            'maintain_aspect', 'true').lower() == 'true'

        if width <= 0 and height <= 0:
            return jsonify({'error': 'Please specify at least width or height'}), 400

        image = Image.open(image_file)
        original_width, original_height = image.size

        # Calculate new dimensions with optional aspect ratio preservation
        if maintain_aspect:
            if width > 0 and height > 0:
                ratio = min(width / original_width, height / original_height)
                new_width = int(original_width * ratio)
                new_height = int(original_height * ratio)
            elif width > 0:
                ratio = width / original_width
                new_width = width
                new_height = int(original_height * ratio)
            else:
                ratio = height / original_height
                new_width = int(original_width * ratio)
                new_height = height
        else:
            new_width = width if width > 0 else original_width
            new_height = height if height > 0 else original_height

        resized_image = image.resize(
            (new_width, new_height), Image.Resampling.LANCZOS)

        # Prepare output
        output = BytesIO()
        image_format = image.format if image.format else 'PNG'
        resized_image.save(output, format=image_format)
        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name=f"resized_{image_file.filename}",
            mimetype=f'image/{image_format.lower()}'
        )

    except Exception as e:
        logging.error(f"Image resize error: {str(e)}")
        return jsonify({'error': f'Image resize failed: {str(e)}'}), 500


# === PDF CONVERSION ===

@tools_bp.route('/convert/html-to-pdf', methods=['POST'])
def convert_html_to_pdf():
    """Convert HTML to single-page PDF using Playwright"""
    try:
        html_file = request.files.get('html_file') or request.files.get('file')

        if not html_file:
            return jsonify({'error': 'No HTML file provided'}), 400

        if html_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not html_file.filename.lower().endswith('.html'):
            return jsonify({'error': 'Invalid file type. Please upload an HTML file.'}), 400

        options_str = request.form.get('options', '{}')
        options = json.loads(options_str) if options_str else {}
        html_content = html_file.read().decode('utf-8')

        pdf_bytes = asyncio.run(create_single_page_pdf(html_content, options))

        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
            temp_pdf.write(pdf_bytes)
            temp_pdf_path = temp_pdf.name

        try:
            return send_file(
                temp_pdf_path,
                as_attachment=True,
                download_name=f"{os.path.splitext(html_file.filename)[0]}.pdf",
                mimetype='application/pdf'
            )
        finally:
            try:
                os.unlink(temp_pdf_path)
            except:
                pass

    except Exception as e:
        logging.error(f"PDF conversion error: {str(e)}")
        return jsonify({'error': f'PDF conversion failed: {str(e)}'}), 500


async def create_single_page_pdf(html_content, options):
    """Create single-page PDF using Browserless or local browser"""
    BROWSERLESS_WS = f"wss://production-sfo.browserless.io?token={os.environ.get('BROWSERLESS_TOKEN')}"

    async with async_playwright() as p:
        # Try Browserless first, fallback to local browser
        try:
            browser = await p.chromium.connect_over_cdp(BROWSERLESS_WS)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = await context.new_page()
        except Exception as e:
            print(f"Browserless failed: {e}. Using local browser.")
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

        # CSS to force single-page layout
        single_page_css = """<style>
        @page { size: auto; margin: 0mm; }
        * {
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid !important;
            break-before: avoid !important;
            break-inside: avoid !important;
        }
        html, body {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        body {
            width: max-content !important;
            min-height: 100vh !important;
        }
        body * {
            orphans: 9999 !important;
            widows: 9999 !important;
        }
        </style>"""

        # Inject CSS into HTML
        if '<head>' in html_content:
            html_content = html_content.replace(
                '<head>', f'<head>{single_page_css}')
        elif '<html>' in html_content:
            html_content = html_content.replace(
                '<html>', f'<html><head>{single_page_css}</head>')
        else:
            html_content = f'<html><head>{single_page_css}</head><body>{html_content}</body></html>'

        await page.set_viewport_size({"width": 2000, "height": 2000})
        await page.set_content(html_content, wait_until='networkidle')
        await page.wait_for_timeout(3000)

        # Calculate content dimensions
        dimensions = await page.evaluate("""
            () => {
                document.body.offsetHeight;  // Force layout
                const body = document.body;
                const html = document.documentElement;
                
                const width = Math.max(
                    body.scrollWidth, body.offsetWidth,
                    html.clientWidth, html.scrollWidth, html.offsetWidth,
                    window.innerWidth
                );
                
                const height = Math.max(
                    body.scrollHeight, body.offsetHeight,
                    html.clientHeight, html.scrollHeight, html.offsetHeight,
                    window.innerHeight
                );
                
                return { width, height };
            }
        """)

        # Calculate PDF dimensions and generate
        scale = float(options.get('scale', 100)) / 100.0
        margin = options.get('margin', 5)
        margin_str = f"{margin}mm"

        content_width = max(dimensions['width'], 800)
        content_height = max(dimensions['height'], 600)
        pdf_width = content_width + 20
        pdf_height = content_height + 20

        pdf_bytes = await page.pdf(
            width=f"{pdf_width}px",
            height=f"{pdf_height}px",
            margin={'top': margin_str, 'bottom': margin_str,
                    'left': margin_str, 'right': margin_str},
            print_background=True,
            prefer_css_page_size=False,
            scale=scale,
            page_ranges='1'
        )

        await browser.close()
        return pdf_bytes
