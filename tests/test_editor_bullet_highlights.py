import re
from pathlib import Path

from bs4 import BeautifulSoup


EDITOR_TEMPLATE = Path(__file__).resolve().parents[1] / "templates" / "editor.html"


def _editor_template() -> str:
    return EDITOR_TEMPLATE.read_text(encoding="utf-8")


def _bullet_highlights_content() -> str:
    match = re.search(
        r"blockManager\.add\('bullet-list-block'[\s\S]*?content:\s*`(?P<content>[\s\S]*?)`,\s*select:\s*true",
        _editor_template(),
    )
    assert match, "Bullet Highlights block content was not found"
    return match.group("content")


def test_bullet_highlights_support_copy_and_list_are_text_components():
    soup = BeautifulSoup(_bullet_highlights_content(), "html.parser")

    paragraph = soup.select_one(".bullet-list-block p")
    highlights = soup.select_one(".bullet-list-block ul")

    assert paragraph is not None
    assert paragraph.get("data-gjs-type") == "text"
    assert paragraph.get_text(strip=True).startswith("Use this section")

    assert highlights is not None
    assert highlights.get("data-gjs-type") == "text"
    assert [item.get_text(strip=True) for item in highlights.select("li")] == [
        "Lead with a concise, action-oriented highlight for readers.",
        "Explain why the update matters or what the next step is.",
        "Offer supporting data, dates, or links where relevant.",
    ]


def test_ckeditor_unsupported_list_elements_use_native_editing_fallback():
    template = _editor_template()

    assert "UNSUPPORTED_CKEDITOR_TEXT_ELEMENTS" in template
    for tag_name in ("UL", "OL", "LI"):
        assert re.search(
            rf"UNSUPPORTED_CKEDITOR_TEXT_ELEMENTS\s*=\s*\[[^\]]*'{tag_name}'",
            template,
            re.DOTALL,
        )

    assert "function isNativeEditableTextElement" in template
    assert "function getCkeditorContent" in template
    assert "return el.innerHTML" in template
    assert "getContent: getCkeditorContent" in template
