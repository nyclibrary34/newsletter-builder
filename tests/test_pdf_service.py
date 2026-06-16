"""Unit tests for image URL normalization, embedding, and PDF links."""
import asyncio
import base64
from io import BytesIO

import pytest
from PIL import Image
from pypdf import PdfReader

from app.services.pdf import PDFService, normalize_image_sources, embed_remote_images


class TestNormalizeImageSources:
    def test_unwraps_safelinks_url(self):
        html = (
            '<img src="https://gcc02.safelinks.protection.outlook.com/'
            '?url=https%3A%2F%2Fwww.nyc.gov%2Fassets%2Fimage_9.jpg'
            '&amp;data=05%7C02%7Cx&amp;reserved=0">'
        )
        out = normalize_image_sources(html)
        assert 'safelinks' not in out
        assert 'https://www.nyc.gov/assets/image_9.jpg' in out

    def test_rewrites_www1_host(self):
        html = '<img src="https://www1.nyc.gov/assets/records/images/content/header/logo.png">'
        out = normalize_image_sources(html)
        assert 'https://www.nyc.gov/assets/records/images/content/header/logo.png' in out
        assert 'www1.nyc.gov' not in out

    def test_leaves_normal_urls_untouched(self):
        html = '<img src="https://www.nyc.gov/assets/a.jpg">'
        assert normalize_image_sources(html) == html

    def test_safelinks_without_url_param_left_alone(self):
        html = '<img src="https://gcc02.safelinks.protection.outlook.com/?data=05">'
        assert 'safelinks' in normalize_image_sources(html)

    def test_safelinks_with_malicious_url_param_not_unwrapped(self):
        """SafeLinks URL with javascript: payload in url param must not be unwrapped."""
        html = (
            '<img src="https://gcc02.safelinks.protection.outlook.com/'
            '?url=javascript%3Aalert%281%29'
            '&amp;data=05">'
        )
        out = normalize_image_sources(html)
        # The original SafeLinks URL should remain unchanged
        assert 'safelinks' in out
        assert 'javascript:alert(1)' not in out


class _FakeResponse:
    def __init__(self, ok=True, content=b"\x89PNGfake", content_type="image/png"):
        self.ok = ok
        self.content = content
        self.headers = {"Content-Type": content_type}


class TestEmbedRemoteImages:
    def test_embeds_image_as_data_uri(self, monkeypatch):
        import app.services.pdf as pdf_mod
        monkeypatch.setattr(
            pdf_mod.requests, "get",
            lambda url, headers=None, timeout=None: _FakeResponse(),
        )
        out = embed_remote_images('<img src="https://www.nyc.gov/a.png">')
        assert 'src="data:image/png;base64,' in out

    def test_keeps_original_src_on_failure(self, monkeypatch):
        import app.services.pdf as pdf_mod

        def _boom(url, headers=None, timeout=None):
            raise pdf_mod.requests.RequestException("boom")

        monkeypatch.setattr(pdf_mod.requests, "get", _boom)
        html = '<img src="https://www.nyc.gov/a.png">'
        assert embed_remote_images(html) == html

    def test_fetches_each_unique_url_once(self, monkeypatch):
        import app.services.pdf as pdf_mod
        calls = []

        def _get(url, headers=None, timeout=None):
            calls.append(url)
            return _FakeResponse()

        monkeypatch.setattr(pdf_mod.requests, "get", _get)
        html = '<img src="https://x.test/a.png"><img src="https://x.test/a.png">'
        embed_remote_images(html)
        assert len(calls) == 1

    def test_sends_browser_user_agent(self, monkeypatch):
        import app.services.pdf as pdf_mod
        seen = {}

        def _get(url, headers=None, timeout=None):
            seen.update(headers or {})
            return _FakeResponse()

        monkeypatch.setattr(pdf_mod.requests, "get", _get)
        embed_remote_images('<img src="https://x.test/a.png">')
        assert "HeadlessChrome" not in seen.get("User-Agent", "")
        assert seen.get("User-Agent", "").startswith("Mozilla/5.0")


def _png_bytes(width=200, height=100):
    image = Image.new("RGB", (width, height), "white")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class TestPdfLinks:
    def test_browserless_function_response_preserves_link_metadata(self, monkeypatch):
        import app.services.pdf as pdf_mod

        image_bytes = _png_bytes()
        encoded = base64.b64encode(image_bytes).decode("ascii")
        captured = {}

        class _FunctionResponse:
            ok = True

            def json(self):
                return {
                    "data": {
                        "screenshot": encoded,
                        "links": [
                            {
                                "href": "https://example.com",
                                "x": 1,
                                "y": 2,
                                "width": 3,
                                "height": 4,
                            }
                        ],
                        "captureWidth": 200,
                        "captureHeight": 100,
                    }
                }

        def _post(url, json=None, timeout=None):
            captured["url"] = url
            captured["json"] = json
            captured["timeout"] = timeout
            return _FunctionResponse()

        monkeypatch.setattr(pdf_mod.requests, "post", _post)

        service = PDFService(browserless_token="test-token")
        result = asyncio.run(service._render_via_browserless("<a href='https://example.com'>x</a>"))

        assert captured["url"].endswith("/function?token=test-token")
        assert captured["json"]["context"]["html"] == "<a href='https://example.com'>x</a>"
        assert result["screenshot"] == image_bytes
        assert result["links"][0]["href"] == "https://example.com"
        assert result["capture_width"] == 200
        assert result["capture_height"] == 100

    def test_compose_pdf_adds_clickable_url_annotation(self):
        service = PDFService()
        pdf_bytes = service._compose_pdf(
            _png_bytes(),
            page_width_in=2,
            page_height_in=1,
            margin_in=0,
            dpi=100,
            manual_scale=1,
            manual_scale_supplied=True,
            allow_scale_up=True,
            max_scale=2,
            background_color=(255, 255, 255),
            link_rects=[
                {
                    "href": "https://example.com/archive",
                    "x": 10,
                    "y": 20,
                    "width": 50,
                    "height": 10,
                }
            ],
            capture_width=200,
            capture_height=100,
        )

        page = PdfReader(BytesIO(pdf_bytes)).pages[0]
        annotations = page["/Annots"]
        link = annotations[0].get_object()

        assert link["/Subtype"] == "/Link"
        assert link["/A"]["/URI"] == "https://example.com/archive"

    def test_compose_pdf_skips_unsafe_link_annotation_urls(self):
        service = PDFService()
        pdf_bytes = service._compose_pdf(
            _png_bytes(),
            page_width_in=2,
            page_height_in=1,
            margin_in=0,
            dpi=100,
            manual_scale=1,
            manual_scale_supplied=True,
            allow_scale_up=True,
            max_scale=2,
            background_color=(255, 255, 255),
            link_rects=[
                {
                    "href": "javascript:alert(1)",
                    "x": 10,
                    "y": 20,
                    "width": 50,
                    "height": 10,
                }
            ],
            capture_width=200,
            capture_height=100,
        )

        page = PdfReader(BytesIO(pdf_bytes)).pages[0]
        assert "/Annots" not in page
