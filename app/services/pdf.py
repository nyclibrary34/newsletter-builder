"""
PDF conversion services for turning HTML content into single-page PDFs.

The implementation renders HTML with Playwright, captures a high-resolution
full-page screenshot, and composites that image onto a single PDF page. This
approach guarantees that newsletters remain on a single page without introducing
pagination breaks while preserving visual fidelity similar to the editor.
"""

from __future__ import annotations

import asyncio
import logging
import os
from io import BytesIO
from typing import Any, Dict, Iterable, Optional, Tuple

from PIL import Image
import requests

try:
    RESAMPLING_FILTER = Image.Resampling.LANCZOS  # Pillow >= 9.1
except AttributeError:  # pragma: no cover
    RESAMPLING_FILTER = Image.LANCZOS            # Backwards compatibility

# Playwright import is now optional (only for local dev with fallback)
# In production, we use Browserless.io exclusively
try:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    # Define dummy types for type hints
    Browser = None
    BrowserContext = None
    Page = None


class PDFService:
    """Service responsible for rendering single-page PDF documents."""

    DEFAULT_PAGE_WIDTH_IN = 8.5
    DEFAULT_PAGE_HEIGHT_IN = 11.0
    DEFAULT_MARGIN_IN = 0.25
    DEFAULT_DPI = 150
    DEFAULT_MAX_SCALE = 2.0

    MIN_VIEWPORT_WIDTH = 960
    MAX_VIEWPORT_WIDTH = 2400
    DEFAULT_VIEWPORT_HEIGHT = 1200
    RENDER_DELAY_MS = 2000  # Increased for complex inline-styled HTML

    SINGLE_PAGE_CSS = """
        * {
            box-sizing: border-box;
        }

        :root,
        html,
        body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            min-width: 100% !important;
            overflow: visible !important;
        }

        @page {
            size: auto;
            margin: 0;
        }

        body,
        body * {
            break-before: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
        }

        /* Ensure images and media render properly */
        img {
            max-width: 100%;
            height: auto;
            display: block;
        }

        /* Ensure tables render properly */
        table {
            border-collapse: collapse;
            width: 100%;
        }

        /* Force visibility of all content */
        * {
            visibility: visible !important;
            opacity: 1 !important;
        }
    """

    def __init__(self, browserless_token: Optional[str] = None) -> None:
        self.browserless_token = browserless_token or os.environ.get("BROWSERLESS_TOKEN")

    async def generate_single_page_pdf(
        self,
        html_content: str,
        *,
        options: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        """Render HTML content as a single-page PDF."""
        options = options or {}

        page_width_in = self._get_float(options, ["page_width_in", "pageWidth", "pageWidthInches", "page_width"], self.DEFAULT_PAGE_WIDTH_IN)
        page_height_in = self._get_float(options, ["page_height_in", "pageHeight", "pageHeightInches", "page_height"], self.DEFAULT_PAGE_HEIGHT_IN)
        dpi = int(self._get_float(options, ["dpi", "DPI", "resolution"], self.DEFAULT_DPI))
        max_scale = max(0.1, self._get_float(options, ["max_scale", "maxScale"], self.DEFAULT_MAX_SCALE))
        allow_scale_up = self._get_bool(options, ["allow_scale_up", "allowScaleUp"], default=True)

        manual_scale = self._get_float(options, ["scale"], 100.0) / 100.0
        if manual_scale <= 0:
            manual_scale = 1.0

        margin_in = self._parse_margin(options)
        background_color = self._parse_color(options.get("background") or options.get("background_color"))

        # CRITICAL: Inject CSS BEFORE sending to any rendering engine
        # This ensures inline-styled HTML gets proper base styles
        prepared_html = self._inject_single_page_css(html_content)

        # Use Browserless if token is available (required for Vercel, optional for local)
        screenshot: Optional[bytes] = None
        
        if self.browserless_token:
            screenshot = await self._screenshot_via_browserless(prepared_html)
            if screenshot is None:
                logging.error("Browserless screenshot request failed - check token validity and API status")
        
        if screenshot is None:
            # Browserless is REQUIRED - no Playwright fallback
            # This simplifies deployment and ensures consistent rendering
            raise RuntimeError(
                "BROWSERLESS_TOKEN is required for PDF generation. "
                "Please set BROWSERLESS_TOKEN in your environment variables. "
                "Get a free token at: https://www.browserless.io/ (6000 units/month free). "
                f"Current token status: {'Not set' if not self.browserless_token else 'Set but request failed'}"
            )

        # Remove Playwright fallback code entirely
        if False:  # Disabled - we use Browserless exclusively now
            async with async_playwright() as playwright:
                browser: Optional[Browser] = None
                context: Optional[BrowserContext] = None
                remote_session = False
                try:
                    browser, context, remote_session = await self._launch_browser(playwright)

                    page = await context.new_page()
                    await page.emulate_media(media="screen")
                    await page.set_viewport_size({"width": self.MIN_VIEWPORT_WIDTH, "height": self.DEFAULT_VIEWPORT_HEIGHT})

                    await page.set_content(prepared_html, wait_until="domcontentloaded")
                    await page.wait_for_load_state("networkidle", timeout=10000)
                    await page.wait_for_timeout(self.RENDER_DELAY_MS)

                    dimensions = await self._measure_page_dimensions(page)
                    viewport_width = max(self.MIN_VIEWPORT_WIDTH, min(int(dimensions["width"]), self.MAX_VIEWPORT_WIDTH))

                    await page.set_viewport_size({"width": viewport_width, "height": self.DEFAULT_VIEWPORT_HEIGHT})
                    await page.wait_for_timeout(500)  # Wait after viewport resize

                    screenshot = await page.screenshot(type="png", full_page=True)
                finally:
                    if context:
                        try:
                            await context.close()
                        except Exception:
                            logging.debug("Failed to close browser context", exc_info=True)
                    if browser:
                        try:
                            await browser.close()
                        except Exception:
                            if not remote_session:
                                logging.debug("Failed to close browser instance", exc_info=True)

        if not screenshot:
            raise RuntimeError("Unable to capture screenshot for PDF conversion")

        return self._compose_pdf(
            screenshot,
            page_width_in=page_width_in,
            page_height_in=page_height_in,
            margin_in=margin_in,
            dpi=dpi,
            manual_scale=manual_scale,
            allow_scale_up=allow_scale_up,
            max_scale=max_scale,
            background_color=background_color,
        )

    async def _screenshot_via_browserless(self, html: str) -> Optional[bytes]:
        """Capture a PNG screenshot using the Browserless REST API."""
        if not self.browserless_token:
            return None

        # Browserless migrated the REST API away from chrome.browserless.io — use the new production endpoint.
        url = f"https://production-sfo.browserless.io/screenshot?token={self.browserless_token}"
        payload: Dict[str, Any] = {
            "html": html,
            "options": {
                "type": "png",
                "fullPage": True,
                "omitBackground": False,
            },
            "gotoOptions": {
                "waitUntil": "networkidle2",
                "timeout": 15000,  # Allow more time for complex HTML
            },
            "viewport": {
                "width": self.MAX_VIEWPORT_WIDTH,
                "height": self.DEFAULT_VIEWPORT_HEIGHT,
                "deviceScaleFactor": 1,
            },
            "waitForTimeout": 2000,  # Extra render delay; supported top-level per Browserless v2 API
        }

        def _post_request() -> Optional[bytes]:
            try:
                response = requests.post(url, json=payload, timeout=45)
                
                if response.ok:
                    content_length = len(response.content)
                    logging.info(f"Browserless screenshot successful: {content_length} bytes")
                    return response.content
                
                # Log the error with status code and response
                error_text = response.text[:200] if response.text else "No response body"
                logging.error(
                    f"Browserless screenshot request returned {response.status_code}: {error_text}"
                )
                return None
                
            except Exception as e:
                logging.error(f"Browserless screenshot request failed: {e}", exc_info=True)
                return None

        return await asyncio.to_thread(_post_request)

    async def _launch_browser(
        self,
        playwright,
    ) -> Tuple[Browser, BrowserContext, bool]:
        """Launch a browser using Browserless when available, falling back to local Chromium."""
        if self.browserless_token:
            endpoint = f"wss://production-sfo.browserless.io?token={self.browserless_token}"
            try:
                browser = await playwright.chromium.connect_over_cdp(endpoint)
                context = browser.contexts[0] if browser.contexts else await browser.new_context()
                return browser, context, True
            except Exception as exc:
                logging.warning(
                    "Browserless connection failed (%s). Falling back to local Chromium.",
                    exc,
                )

        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(device_scale_factor=1)
        return browser, context, False

    async def _measure_page_dimensions(self, page: Page) -> Dict[str, float]:
        """Measure rendered content dimensions, handling complex nested structures."""
        return await page.evaluate(
            """
            () => {
                // Force layout recalculation
                document.body.offsetHeight;
                
                const body = document.body;
                const html = document.documentElement;
                
                // Check all elements to find true content bounds
                let maxWidth = 0;
                let maxHeight = 0;
                
                // Get dimensions from standard properties
                const standardWidth = Math.max(
                    body.scrollWidth || 0,
                    body.offsetWidth || 0,
                    html.clientWidth || 0,
                    html.scrollWidth || 0,
                    html.offsetWidth || 0,
                    window.innerWidth || 0
                );
                
                const standardHeight = Math.max(
                    body.scrollHeight || 0,
                    body.offsetHeight || 0,
                    html.clientHeight || 0,
                    html.scrollHeight || 0,
                    html.offsetHeight || 0,
                    window.innerHeight || 0
                );
                
                // Check all child elements for actual content bounds
                const allElements = document.querySelectorAll('*');
                allElements.forEach(el => {
                    if (el.offsetWidth > 0 || el.offsetHeight > 0) {
                        const rect = el.getBoundingClientRect();
                        maxWidth = Math.max(maxWidth, rect.right);
                        maxHeight = Math.max(maxHeight, rect.bottom);
                    }
                });
                
                const width = Math.max(standardWidth, maxWidth, 800);
                const height = Math.max(standardHeight, maxHeight, 600);
                
                return { width, height };
            }
            """
        )

    def _compose_pdf(
        self,
        image_bytes: bytes,
        *,
        page_width_in: float,
        page_height_in: float,
        margin_in: float,
        dpi: int,
        manual_scale: float,
        allow_scale_up: bool,
        max_scale: float,
        background_color: Tuple[int, int, int],
    ) -> bytes:
        """Composite the rendered image onto a single PDF page."""
        image = Image.open(BytesIO(image_bytes)).convert("RGB")

        page_width_px = max(1, int(page_width_in * dpi))
        page_height_px = max(1, int(page_height_in * dpi))
        margin_px = max(0, int(margin_in * dpi))

        content_width = max(10, page_width_px - margin_px * 2)
        width_ratio = max(0.01, content_width / image.width)

        if allow_scale_up:
            max_allowed = min(width_ratio, max_scale)
        else:
            max_allowed = min(width_ratio, 1.0)

        desired_ratio = max(0.01, manual_scale)
        if not allow_scale_up:
            desired_ratio = min(desired_ratio, 1.0)
        else:
            desired_ratio = min(desired_ratio, max_scale)

        scale_ratio = max(0.01, min(max_allowed, desired_ratio))

        scaled_size = (
            max(1, int(image.width * scale_ratio)),
            max(1, int(image.height * scale_ratio)),
        )
        image = image.resize(scaled_size, RESAMPLING_FILTER)

        required_height = scaled_size[1] + margin_px * 2
        if required_height > page_height_px:
            page_height_px = required_height

        canvas = Image.new("RGB", (page_width_px, page_height_px), background_color)
        available_width = page_width_px - image.width
        available_height = page_height_px - image.height

        offset_x = margin_px + max(0, available_width // 2 - margin_px)
        offset_y = margin_px + max(0, available_height // 2 - margin_px)
        offset_x = min(offset_x, page_width_px - image.width - margin_px)
        offset_y = min(offset_y, page_height_px - image.height - margin_px)
        offset_x = max(margin_px, offset_x)
        offset_y = max(margin_px, offset_y)

        canvas.paste(image, (offset_x, offset_y))

        output = BytesIO()
        canvas.save(output, format="PDF", resolution=dpi)
        output.seek(0)
        return output.read()

    def _inject_single_page_css(self, html_content: str) -> str:
        """Ensure single-page control CSS is embedded in the HTML document."""
        style_block = f"<style>{self.SINGLE_PAGE_CSS}</style>"
        if "<head" in html_content:
            return html_content.replace("<head>", f"<head>{style_block}", 1)
        if "<html" in html_content:
            return html_content.replace("<html>", f"<html><head>{style_block}</head>", 1)
        return f"<html><head>{style_block}</head><body>{html_content}</body></html>"

    @staticmethod
    def _get_float(options: Dict[str, Any], keys: Iterable[str], default: float) -> float:
        for key in keys:
            if key in options:
                try:
                    return float(options[key])
                except (TypeError, ValueError):
                    continue
        return default

    @staticmethod
    def _get_bool(options: Dict[str, Any], keys: Iterable[str], default: bool = False) -> bool:
        true_values = {"true", "1", "yes", "on"}
        false_values = {"false", "0", "no", "off"}
        for key in keys:
            if key in options:
                value = options[key]
                if isinstance(value, bool):
                    return value
                if isinstance(value, str):
                    value_lower = value.strip().lower()
                    if value_lower in true_values:
                        return True
                    if value_lower in false_values:
                        return False
        return default

    def _parse_margin(self, options: Dict[str, Any]) -> float:
        if "margin" in options:
            try:
                return max(0.0, float(options["margin"]) / 25.4)
            except (TypeError, ValueError):
                pass
        return self._get_float(options, ["margin_in", "marginInches"], self.DEFAULT_MARGIN_IN)

    @staticmethod
    def _parse_color(value: Optional[str]) -> Tuple[int, int, int]:
        if not value:
            return (255, 255, 255)
        value = value.strip()
        if value.startswith("#"):
            value = value[1:]
        if len(value) == 3:
            value = "".join(ch * 2 for ch in value)
        if len(value) == 6:
            try:
                r = int(value[0:2], 16)
                g = int(value[2:4], 16)
                b = int(value[4:6], 16)
                return (r, g, b)
            except ValueError:
                pass
        return (255, 255, 255)
