"""Unit tests for image URL normalization and embedding in the PDF service."""
import pytest

from app.services.pdf import normalize_image_sources


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
