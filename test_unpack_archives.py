from __future__ import annotations

from pathlib import Path
from zipfile import ZipFile

import pytest

from scripts.unpack_archives import discover_archives, extract_archive, load_sql_files


def test_discover_archives_recursive_includes_nested(tmp_path: Path) -> None:
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "inner.zip").write_bytes(b"x")
    (tmp_path / "root.zip").write_bytes(b"x")

    found = discover_archives(tmp_path, recursive=True)

    assert [path.name for path in found] == ["inner.zip", "root.zip"]


def test_extract_archive_zip_fallback_when_7z_missing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr("scripts.unpack_archives.shutil.which", lambda _: None)

    archive = tmp_path / "sample.zip"
    with ZipFile(archive, "w") as zip_file:
        zip_file.writestr("folder/file.txt", "hello")

    target = tmp_path / "out"
    target.mkdir()

    code = extract_archive(archive, target)

    assert code == 0
    assert (target / "folder" / "file.txt").read_text() == "hello"
    assert "fallback" in (target / "_extract.log").read_text().lower()


def test_extract_archive_rejects_zip_slip(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr("scripts.unpack_archives.shutil.which", lambda _: None)

    archive = tmp_path / "unsafe.zip"
    with ZipFile(archive, "w") as zip_file:
        zip_file.writestr("../evil.txt", "nope")

    target = tmp_path / "out"
    target.mkdir()

    code = extract_archive(archive, target)

    assert code == 1
    log_text = (target / "_extract.log").read_text()
    assert "unsafe archive member path" in log_text.lower()
    assert not (tmp_path / "evil.txt").exists()


def test_extract_archive_reports_unsupported_without_7z(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr("scripts.unpack_archives.shutil.which", lambda _: None)

    archive = tmp_path / "data.rar"
    archive.write_bytes(b"not-a-real-rar")

    target = tmp_path / "out"
    target.mkdir()

    code = extract_archive(archive, target)

    assert code == 1
    assert "no fallback extractor" in (target / "_extract.log").read_text().lower()


def test_load_sql_files_reports_missing_psql(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr("scripts.unpack_archives.shutil.which", lambda _: None)

    sql_file = tmp_path / "data.sql"
    sql_file.write_text("select 1;")

    loaded, errors = load_sql_files([sql_file], "postgresql://example")

    assert loaded == 0
    assert errors and "psql is not installed" in errors[0].lower()
