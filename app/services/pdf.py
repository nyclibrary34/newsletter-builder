"""
PDF conversion services for turning HTML content into single-page PDFs.

The implementation renders HTML with Playwright, captures a high-resolution
full-page screenshot, and composites that image onto a single PDF page. This
approach guarantees that newsletters remain on a single page without introducing
pagination breaks while preserving visual fidelity similar to the editor.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import mimetypes
import os
import re
from io import BytesIO
from typing import Any, Dict, Iterable, Optional, Tuple
from urllib.parse import urlparse, parse_qs

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


# Realistic desktop Chrome UA. nyc.gov's WAF returns 403 to the default
# HeadlessChrome user-agent, which silently breaks every image in the PDF.
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

_SAFELINKS_RE = re.compile(
    r'https://[a-z0-9.-]*safelinks\.protection\.outlook\.com/\?[^"\'\s>]+',
    re.IGNORECASE,
)

_IMG_SRC_RE = re.compile(
    r'(<img\b[^>]*?\bsrc=["\'])(https?://[^"\']+)(["\'])',
    re.IGNORECASE,
)

MAX_EMBED_IMAGE_BYTES = 8 * 1024 * 1024


def normalize_image_sources(html: str) -> str:
    """Unwrap Outlook SafeLinks URLs and rewrite legacy nyc.gov hosts.

    Exported newsletters that round-tripped through Outlook carry image srcs
    wrapped by SafeLinks; those URLs fail in a clean browser session.
    """
    def _unwrap(match: "re.Match") -> str:
        wrapped = match.group(0).replace("&amp;", "&")
        query = parse_qs(urlparse(wrapped).query)
        target = query.get("url", [None])[0]

        # Only accept unwrapped URL if it starts with http:// or https://
        if target and target.lower().startswith(("http://", "https://")):
            return target
        return match.group(0)

    html = _SAFELINKS_RE.sub(_unwrap, html)
    html = html.replace("https://www1.nyc.gov/", "https://www.nyc.gov/")
    return html


def embed_remote_images(html: str) -> str:
    """Inline every remote <img> as a base64 data URI.

    Headless renderers get blocked by WAFs (nyc.gov 403s HeadlessChrome),
    so we fetch with a real-browser UA here and ship self-contained HTML.
    Failures leave the original URL in place.
    """
    cache: Dict[str, Optional[str]] = {}

    def _fetch(url: str) -> Optional[str]:
        if url in cache:
            return cache[url]
        data_uri: Optional[str] = None
        try:
            resp = requests.get(url, headers={"User-Agent": BROWSER_UA}, timeout=10)
            if resp.ok and resp.content and len(resp.content) <= MAX_EMBED_IMAGE_BYTES:
                content_type = resp.headers.get("Content-Type", "").split(";")[0].strip()
                if not content_type.startswith("image/"):
                    content_type = mimetypes.guess_type(url)[0] or "image/png"
                encoded = base64.b64encode(resp.content).decode("ascii")
                data_uri = f"data:{content_type};base64,{encoded}"
            else:
                logging.warning("Image fetch for PDF embed not usable: %s", url)
        except Exception as exc:
            logging.warning("Failed to fetch image for PDF embed %s: %s", url, exc)
        cache[url] = data_uri
        return data_uri

    def _replace(match: "re.Match") -> str:
        data_uri = _fetch(match.group(2))
        return f"{match.group(1)}{data_uri or match.group(2)}{match.group(3)}"

    return _IMG_SRC_RE.sub(_replace, html)


class PDFService:
    """Service responsible for rendering single-page PDF documents."""

    DEFAULT_PAGE_WIDTH_IN = 8.5
    DEFAULT_PAGE_HEIGHT_IN = 11.0
    DEFAULT_MARGIN_IN = 0.25
    DEFAULT_DPI = 150
    DEFAULT_MAX_SCALE = 2.0

    MIN_VIEWPORT_WIDTH = 768
    MAX_VIEWPORT_WIDTH = 1600
    DEFAULT_VIEWPORT_HEIGHT = 1200
    RENDER_DELAY_MS = 250  # small settle buffer; image readiness is awaited explicitly
    BROWSERLESS_VIEWPORT_WIDTH = 880
    BROWSERLESS_DEVICE_SCALE_FACTOR = 2
    PDF_LINK_SCHEMES = ("http://", "https://", "mailto:", "tel:")

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

    BROWSERLESS_RENDER_FUNCTION = """
export default async function ({ page, context }) {
  const viewportWidth = context.viewportWidth || 880;
  const viewportHeight = context.viewportHeight || 1200;
  const deviceScaleFactor = context.deviceScaleFactor || 2;

  await page.setViewport({
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor,
  });

  await page.setContent(context.html, {
    waitUntil: 'networkidle2',
    timeout: 15000,
  });

  await page.waitForFunction(
    () => Array.from(document.images).every((img) => img.complete),
    { timeout: 5000 }
  ).catch(() => {});

  await new Promise((resolve) => setTimeout(resolve, 250));

  const metrics = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    const width = Math.max(
      body.scrollWidth || 0,
      body.offsetWidth || 0,
      html.clientWidth || 0,
      html.scrollWidth || 0,
      html.offsetWidth || 0,
      window.innerWidth || 0
    );
    const height = Math.max(
      body.scrollHeight || 0,
      body.offsetHeight || 0,
      html.clientHeight || 0,
      html.scrollHeight || 0,
      html.offsetHeight || 0,
      window.innerHeight || 0
    );
    const links = Array.from(document.querySelectorAll('a[href]')).flatMap((anchor) => {
      const href = anchor.href;
      if (!/^(https?:|mailto:|tel:)/i.test(href)) {
        return [];
      }
      return Array.from(anchor.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          href,
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
        }));
    });
    return { width, height, links };
  });

  const screenshot = await page.screenshot({
    type: 'png',
    fullPage: true,
    omitBackground: false,
    encoding: 'base64',
  });

  return {
    data: {
      screenshot,
      links: metrics.links,
      captureWidth: metrics.width,
      captureHeight: metrics.height,
    },
    type: 'application/json',
  };
}
    """.strip()

    BROWSERLESS_PDF_FUNCTION = """
export default async function ({ page, context }) {
  const viewportWidth = context.viewportWidth || 880;
  const viewportHeight = context.viewportHeight || 1200;
  const deviceScaleFactor = context.deviceScaleFactor || 2;

  await page.setViewport({
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor,
  });

  await page.emulateMediaType('screen');

  await page.setContent(context.html, {
    waitUntil: 'networkidle2',
    timeout: 15000,
  });

  await page.waitForFunction(
    () => Array.from(document.images).every((img) => img.complete),
    { timeout: 5000 }
  ).catch(() => {});

  await page.addStyleTag({
    content: `
      :root {
        --pdf-paragraph-side-inset: 12px;
      }

      html, body, * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      p:not(:empty) {
        padding-left: var(--pdf-paragraph-side-inset) !important;
        padding-right: var(--pdf-paragraph-side-inset) !important;
      }
    `,
  });

  await new Promise((resolve) => setTimeout(resolve, 250));

  const metrics = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    let maxBottom = 0;
    document.querySelectorAll('*').forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        maxBottom = Math.max(maxBottom, rect.bottom + window.scrollY);
      }
    });
    return {
      width: Math.max(
        body.scrollWidth || 0,
        body.offsetWidth || 0,
        html.clientWidth || 0,
        html.scrollWidth || 0,
        html.offsetWidth || 0,
        window.innerWidth || 0
      ),
      height: Math.max(maxBottom, 1),
    };
  });

  const cssPxPerIn = 96;
  const pageWidthIn = Math.max(1, Number(context.pageWidthIn || 8.5));
  const marginIn = Math.max(0, Number(context.marginIn || 0));
  const contentWidthIn = Math.max(0.1, pageWidthIn - marginIn * 2);
  const renderedWidthIn = Math.max(0.1, metrics.width / cssPxPerIn);
  const fitWidthScale = contentWidthIn / renderedWidthIn;
  const manualScale = Math.max(0.1, Number(context.manualScale || 1));
  const maxScale = Math.max(0.1, Number(context.maxScale || 2));
  const allowScaleUp = context.allowScaleUp !== false;
  const manualScaleSupplied = context.manualScaleSupplied === true;

  const maxAllowedScale = allowScaleUp
    ? Math.min(fitWidthScale, maxScale)
    : Math.min(fitWidthScale, 1);

  let desiredScale = manualScaleSupplied
    ? manualScale
    : (fitWidthScale >= 1 && allowScaleUp ? Math.min(fitWidthScale, maxScale) : fitWidthScale);

  desiredScale = Math.max(0.1, desiredScale);
  desiredScale = allowScaleUp ? Math.min(desiredScale, maxScale) : Math.min(desiredScale, 1);

  const pdfScale = Math.max(0.1, Math.min(maxAllowedScale, desiredScale));
  const contentHeightIn = Math.max(0.1, (metrics.height / cssPxPerIn) * pdfScale);
  const pdfHeightIn = marginIn * 2 + contentHeightIn;

  return await page.pdf({
    width: `${pageWidthIn}in`,
    height: `${pdfHeightIn}in`,
    margin: {
      top: `${marginIn}in`,
      right: `${marginIn}in`,
      bottom: `${marginIn}in`,
      left: `${marginIn}in`,
    },
    printBackground: true,
    displayHeaderFooter: false,
    preferCSSPageSize: false,
    scale: pdfScale,
  });
}
    """.strip()

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
        scale_supplied = "scale" in options

        margin_in = self._parse_margin(options)
        background_color = self._parse_color(options.get("background") or options.get("background_color"))

        # CRITICAL: Inject CSS BEFORE sending to any rendering engine
        # This ensures inline-styled HTML gets proper base styles
        prepared_html = self._inject_single_page_css(html_content)

        # Normalize image URLs (unwrap SafeLinks, fix legacy www1.nyc.gov)
        prepared_html = normalize_image_sources(prepared_html)
        # Embed remote images as data URIs to bypass WAF blocks on HeadlessChrome UA
        prepared_html = await asyncio.to_thread(embed_remote_images, prepared_html)

        # Use Browserless if token is available (required for Vercel, optional for local)
        screenshot: Optional[bytes] = None
        link_rects: Iterable[Dict[str, Any]] = []
        capture_width: Optional[float] = None
        capture_height: Optional[float] = None

        if self.browserless_token:
            native_pdf = await self._pdf_via_browserless(
                prepared_html,
                page_width_in=page_width_in,
                page_height_in=page_height_in,
                margin_in=margin_in,
                manual_scale=manual_scale,
                manual_scale_supplied=scale_supplied,
                allow_scale_up=allow_scale_up,
                max_scale=max_scale,
            )
            if native_pdf:
                return self._apply_pdf_view_preferences(native_pdf)

            logging.warning(
                "Browserless native PDF render failed; falling back to screenshot PDF without selectable text"
            )
            render_result = await self._render_via_browserless(prepared_html)
            if render_result:
                screenshot = render_result["screenshot"]
                link_rects = render_result.get("links") or []
                capture_width = render_result.get("capture_width")
                capture_height = render_result.get("capture_height")
            else:
                screenshot = await self._screenshot_via_browserless(prepared_html)
                if screenshot is not None:
                    logging.warning(
                        "Browserless function render failed; generated PDF will not include clickable links"
                    )
            if screenshot is None:
                logging.error("Browserless render request failed - check token validity and API status")
        
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
                    try:
                        await page.wait_for_function(
                            "Array.from(document.images).every(img => img.complete)",
                            timeout=5000,
                        )
                    except Exception:
                        logging.warning("Timed out waiting for images to load; rendering anyway")
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
            manual_scale_supplied=scale_supplied,
            allow_scale_up=allow_scale_up,
            max_scale=max_scale,
            background_color=background_color,
            link_rects=link_rects,
            capture_width=capture_width,
            capture_height=capture_height,
        )

    async def _pdf_via_browserless(
        self,
        html: str,
        *,
        page_width_in: float,
        page_height_in: float,
        margin_in: float,
        manual_scale: float,
        manual_scale_supplied: bool,
        allow_scale_up: bool,
        max_scale: float,
    ) -> Optional[bytes]:
        """Render a native Chromium PDF so text remains selectable and links remain real."""
        if not self.browserless_token:
            return None

        url = f"https://production-sfo.browserless.io/function?token={self.browserless_token}"
        payload: Dict[str, Any] = {
            "code": self.BROWSERLESS_PDF_FUNCTION,
            "context": {
                "html": html,
                "viewportWidth": self.BROWSERLESS_VIEWPORT_WIDTH,
                "viewportHeight": self.DEFAULT_VIEWPORT_HEIGHT,
                "deviceScaleFactor": self.BROWSERLESS_DEVICE_SCALE_FACTOR,
                "pageWidthIn": page_width_in,
                "pageHeightIn": page_height_in,
                "marginIn": margin_in,
                "manualScale": manual_scale,
                "manualScaleSupplied": manual_scale_supplied,
                "allowScaleUp": allow_scale_up,
                "maxScale": max_scale,
            },
        }

        def _post_request() -> Optional[bytes]:
            try:
                response = requests.post(url, json=payload, timeout=60)

                if not response.ok:
                    error_text = response.text[:200] if response.text else "No response body"
                    logging.error(
                        "Browserless native PDF request returned %s: %s",
                        response.status_code,
                        error_text,
                    )
                    return None

                response_headers = getattr(response, "headers", {})
                response_content = getattr(response, "content", b"")
                content_type = response_headers.get("Content-Type", "").split(";")[0].lower()
                if response_content.startswith(b"%PDF") or content_type == "application/pdf":
                    logging.info("Browserless native PDF render successful: %s bytes", len(response_content))
                    return response_content

                body = response.json()
                data = body.get("data") if isinstance(body, dict) else None
                if not isinstance(data, dict):
                    data = body if isinstance(body, dict) else {}

                pdf_b64 = data.get("pdf")
                if not isinstance(pdf_b64, str):
                    logging.error("Browserless native PDF response did not include PDF data")
                    return None

                pdf_bytes = base64.b64decode(pdf_b64)
                logging.info("Browserless native PDF render successful: %s bytes", len(pdf_bytes))
                return pdf_bytes
            except Exception as exc:
                logging.error("Browserless native PDF request failed: %s", exc, exc_info=True)
                return None

        return await asyncio.to_thread(_post_request)

    async def _render_via_browserless(self, html: str) -> Optional[Dict[str, Any]]:
        """Render HTML with Browserless and return screenshot bytes plus link metadata."""
        if not self.browserless_token:
            return None

        url = f"https://production-sfo.browserless.io/function?token={self.browserless_token}"
        payload: Dict[str, Any] = {
            "code": self.BROWSERLESS_RENDER_FUNCTION,
            "context": {
                "html": html,
                "viewportWidth": self.BROWSERLESS_VIEWPORT_WIDTH,
                "viewportHeight": self.DEFAULT_VIEWPORT_HEIGHT,
                "deviceScaleFactor": self.BROWSERLESS_DEVICE_SCALE_FACTOR,
            },
        }

        def _post_request() -> Optional[Dict[str, Any]]:
            try:
                response = requests.post(url, json=payload, timeout=60)

                if not response.ok:
                    error_text = response.text[:200] if response.text else "No response body"
                    logging.error(
                        "Browserless function request returned %s: %s",
                        response.status_code,
                        error_text,
                    )
                    return None

                body = response.json()
                data = body.get("data") if isinstance(body, dict) else None
                if not isinstance(data, dict):
                    data = body if isinstance(body, dict) else {}

                screenshot_b64 = data.get("screenshot")
                if not isinstance(screenshot_b64, str):
                    logging.error("Browserless function response did not include screenshot data")
                    return None

                screenshot_bytes = base64.b64decode(screenshot_b64)
                logging.info(
                    "Browserless function render successful: %s bytes, %s link rectangles",
                    len(screenshot_bytes),
                    len(data.get("links") or []),
                )
                return {
                    "screenshot": screenshot_bytes,
                    "links": data.get("links") or [],
                    "capture_width": data.get("captureWidth"),
                    "capture_height": data.get("captureHeight"),
                }

            except Exception as exc:
                logging.error("Browserless function request failed: %s", exc, exc_info=True)
                return None

        return await asyncio.to_thread(_post_request)

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
                "width": self.BROWSERLESS_VIEWPORT_WIDTH,
                "height": self.DEFAULT_VIEWPORT_HEIGHT,
                "deviceScaleFactor": self.BROWSERLESS_DEVICE_SCALE_FACTOR,
            },
            "waitForFunction": {
                "fn": "() => Array.from(document.images).every(img => img.complete)",
                "timeout": 5000,
            },
            "waitForTimeout": 250,
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
                context = await browser.new_context(user_agent=BROWSER_UA)
                return browser, context, True
            except Exception as exc:
                logging.warning(
                    "Browserless connection failed (%s). Falling back to local Chromium.",
                    exc,
                )

        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(device_scale_factor=1, user_agent=BROWSER_UA)
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
        manual_scale_supplied: bool,
        allow_scale_up: bool,
        max_scale: float,
        background_color: Tuple[int, int, int],
        link_rects: Optional[Iterable[Dict[str, Any]]] = None,
        capture_width: Optional[float] = None,
        capture_height: Optional[float] = None,
    ) -> bytes:
        """Composite the rendered image onto a single PDF page."""
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        original_width, original_height = image.size

        page_width_px = max(1, int(page_width_in * dpi))
        page_height_px = max(1, int(page_height_in * dpi))
        margin_px = max(0, int(margin_in * dpi))

        content_width = max(10, page_width_px - margin_px * 2)
        width_ratio = max(0.01, content_width / image.width)

        if allow_scale_up:
            max_allowed = min(width_ratio, max_scale)
        else:
            max_allowed = min(width_ratio, 1.0)

        if manual_scale_supplied:
            desired_ratio = manual_scale
        elif width_ratio >= 1.0 and allow_scale_up:
            desired_ratio = min(width_ratio, max_scale)
        else:
            desired_ratio = width_ratio

        desired_ratio = max(0.01, desired_ratio)
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
        pdf_bytes = output.read()
        pdf_bytes = self._apply_pdf_links(
            pdf_bytes,
            link_rects=link_rects or [],
            capture_width=capture_width or original_width,
            capture_height=capture_height or original_height,
            image_width=original_width,
            image_height=original_height,
            page_width_px=page_width_px,
            page_height_px=page_height_px,
            offset_x=offset_x,
            offset_y=offset_y,
            scale_ratio=scale_ratio,
            dpi=dpi,
        )
        return self._apply_pdf_view_preferences(pdf_bytes)

    def _apply_pdf_links(
        self,
        pdf_bytes: bytes,
        *,
        link_rects: Iterable[Dict[str, Any]],
        capture_width: float,
        capture_height: float,
        image_width: int,
        image_height: int,
        page_width_px: int,
        page_height_px: int,
        offset_x: int,
        offset_y: int,
        scale_ratio: float,
        dpi: int,
    ) -> bytes:
        """Overlay invisible PDF link annotations over rendered anchor rectangles."""
        try:
            from pypdf import PdfReader, PdfWriter
            from pypdf.generic import (
                ArrayObject,
                DictionaryObject,
                FloatObject,
                NameObject,
                NumberObject,
                TextStringObject,
            )
        except ImportError:
            return pdf_bytes

        valid_rects = list(link_rects or [])
        try:
            capture_width = float(capture_width)
            capture_height = float(capture_height)
        except (TypeError, ValueError):
            return pdf_bytes

        if not valid_rects or capture_width <= 0 or capture_height <= 0:
            return pdf_bytes

        try:
            reader = PdfReader(BytesIO(pdf_bytes))
            writer = PdfWriter()
            writer.clone_document_from_reader(reader)
            page = writer.pages[0]

            annots = page.get("/Annots")

            capture_to_image_x = image_width / capture_width
            capture_to_image_y = image_height / capture_height
            px_to_pt = 72.0 / dpi
            page_width_pt = page_width_px * px_to_pt
            page_height_pt = page_height_px * px_to_pt

            for rect in valid_rects:
                href = str(rect.get("href") or "").strip()
                if not self._is_pdf_link_href(href):
                    continue

                try:
                    x = float(rect.get("x", 0))
                    y = float(rect.get("y", 0))
                    width = float(rect.get("width", 0))
                    height = float(rect.get("height", 0))
                except (TypeError, ValueError):
                    continue

                if width <= 0 or height <= 0:
                    continue

                left_px = offset_x + x * capture_to_image_x * scale_ratio
                top_px = offset_y + y * capture_to_image_y * scale_ratio
                right_px = offset_x + (x + width) * capture_to_image_x * scale_ratio
                bottom_px = offset_y + (y + height) * capture_to_image_y * scale_ratio

                left = max(0.0, min(page_width_pt, left_px * px_to_pt))
                right = max(0.0, min(page_width_pt, right_px * px_to_pt))
                top = max(0.0, min(page_height_pt, page_height_pt - top_px * px_to_pt))
                bottom = max(0.0, min(page_height_pt, page_height_pt - bottom_px * px_to_pt))

                if right <= left or top <= bottom:
                    continue

                annotation = DictionaryObject({
                    NameObject("/Type"): NameObject("/Annot"),
                    NameObject("/Subtype"): NameObject("/Link"),
                    NameObject("/Rect"): ArrayObject([
                        FloatObject(left),
                        FloatObject(bottom),
                        FloatObject(right),
                        FloatObject(top),
                    ]),
                    NameObject("/Border"): ArrayObject([
                        NumberObject(0),
                        NumberObject(0),
                        NumberObject(0),
                    ]),
                    NameObject("/A"): DictionaryObject({
                        NameObject("/S"): NameObject("/URI"),
                        NameObject("/URI"): TextStringObject(href),
                    }),
                })
                if annots is None:
                    annots = ArrayObject()
                    page[NameObject("/Annots")] = annots
                annots.append(writer._add_object(annotation))

            buffer = BytesIO()
            writer.write(buffer)
            buffer.seek(0)
            return buffer.read()
        except Exception:
            logging.debug("Unable to apply PDF link annotations", exc_info=True)
            return pdf_bytes

    def _apply_pdf_view_preferences(self, pdf_bytes: bytes) -> bytes:
        """
        Ensure generated PDFs open using a width-based zoom for readability.

        Some PDF viewers default to "Fit Page", which renders tall single-page PDFs
        at unreadably small scales. By setting the open action to FitH we hint that
        viewers should fit the width instead, so the newsletter remains legible.
        """
        try:
            from pypdf import PdfReader, PdfWriter
            from pypdf.generic import Destination, Fit
        except ImportError:
            return pdf_bytes

        try:
            reader = PdfReader(BytesIO(pdf_bytes))
            writer = PdfWriter()
            writer.clone_document_from_reader(reader)

            page = writer.pages[0]
            fit_destination = Destination(
                "OpenAction",
                page,
                Fit.fit_horizontally(top=page.mediabox.top),
            )
            writer.open_destination = fit_destination

            buffer = BytesIO()
            writer.write(buffer)
            buffer.seek(0)
            return buffer.read()
        except Exception:
            logging.debug("Unable to apply PDF view preferences", exc_info=True)
            return pdf_bytes

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

    @classmethod
    def _is_pdf_link_href(cls, href: str) -> bool:
        return href.lower().startswith(cls.PDF_LINK_SCHEMES)
