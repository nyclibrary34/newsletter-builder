"""Regression tests for editor runtime asset loading."""

import importlib


def create_test_app(monkeypatch):
    monkeypatch.setenv("FLASK_ENV", "testing")
    index = importlib.import_module("api.index")
    return index.create_app("testing")


def test_editor_page_versions_mutable_editor_scripts(monkeypatch):
    app = create_test_app(monkeypatch)
    client = app.test_client()

    response = client.get("/edit/newsletters/2026/june/sample.html")

    assert response.status_code == 200
    assert b"js/html-processor.js?v=" in response.data
    assert b"js/editor-load-prep.js?v=" in response.data


def test_mutable_editor_scripts_are_not_long_cached(monkeypatch):
    app = create_test_app(monkeypatch)
    client = app.test_client()

    response = client.get("/static/js/editor-load-prep.js")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-cache, no-store, must-revalidate"
    assert response.headers["Pragma"] == "no-cache"
    assert response.headers["Expires"] == "0"
