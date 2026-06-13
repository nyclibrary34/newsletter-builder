"""Security regression tests for local storage path handling."""

from pathlib import Path

import pytest

from utils.storage import LocalStorage


def test_local_download_rejects_parent_directory_traversal(tmp_path):
    storage_root = tmp_path / "files"
    storage_root.mkdir()
    secret_file = tmp_path / "secret.txt"
    secret_file.write_bytes(b"do not expose")

    storage = LocalStorage(str(storage_root))

    with pytest.raises(FileNotFoundError):
        storage.download("../secret.txt")


def test_local_save_rejects_parent_directory_traversal(tmp_path):
    storage_root = tmp_path / "files"
    storage_root.mkdir()
    outside_file = tmp_path / "created.txt"

    storage = LocalStorage(str(storage_root))

    assert storage.save("../created.txt", b"owned") is False
    assert not outside_file.exists()


def test_local_delete_rejects_parent_directory_traversal(tmp_path):
    storage_root = tmp_path / "files"
    storage_root.mkdir()
    outside_file = tmp_path / "victim.txt"
    outside_file.write_bytes(b"keep")

    storage = LocalStorage(str(storage_root))

    assert storage.delete("../victim.txt") is False
    assert outside_file.read_bytes() == b"keep"


def test_local_storage_allows_normal_nested_newsletter_path(tmp_path):
    storage_root = tmp_path / "files"
    storage_root.mkdir()

    storage = LocalStorage(str(storage_root))
    assert storage.save("newsletters/2026/june/test.html", b"<p>ok</p>") is True

    saved_path = Path(storage.full_path) / "newsletters" / "2026" / "june" / "test.html"
    assert saved_path.read_bytes() == b"<p>ok</p>"
    assert storage.download("newsletters/2026/june/test.html") == b"<p>ok</p>"
