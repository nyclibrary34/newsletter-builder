"""Security regression tests for newsletter routes."""

import importlib


def test_content_endpoint_serves_saved_html_as_plain_text(tmp_path, monkeypatch):
    monkeypatch.setenv("FLASK_ENV", "testing")

    index = importlib.import_module("api.index")
    app = index.create_app("testing")
    app.config["LOCAL_STORAGE_PATH"] = str(tmp_path / "files")

    stored_file = tmp_path / "files" / "newsletters" / "2026" / "june" / "xss.html"
    stored_file.parent.mkdir(parents=True)
    stored_file.write_text("<script>alert(1)</script>", encoding="utf-8")

    client = app.test_client()
    response = client.get("/content/newsletters/2026/june/xss.html")

    assert response.status_code == 200
    assert response.mimetype == "text/plain"
    assert response.text == "<script>alert(1)</script>"
