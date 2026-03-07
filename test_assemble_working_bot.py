from __future__ import annotations

import json
from pathlib import Path
from zipfile import ZipFile

import pytest

from scripts.assemble_working_bot import extract_bot_archive


@pytest.fixture
def bot_archive(tmp_path: Path) -> Path:
    archive = tmp_path / "bot.zip"
    with ZipFile(archive, "w") as zip_file:
        zip_file.writestr("final_bot/package.json", "{}")
        zip_file.writestr("final_bot/server/index.ts", "console.log('ok')")
        zip_file.writestr("final_bot/server/routes.ts", "const q = { actual: true };\n")
        zip_file.writestr("final_bot/client/src/main.tsx", "export {}")
        zip_file.writestr("final_bot/tsconfig.json", '{"compilerOptions": {}}')
    return archive


def test_extract_bot_archive_success(bot_archive: Path, tmp_path: Path) -> None:
    output = tmp_path / "working-bot"
    extract_bot_archive(bot_archive, output, prefix="final_bot")

    assert (output / "package.json").exists()
    assert (output / "server" / "index.ts").exists()
    assert (output / "server" / "routes.ts").exists()
    assert (output / "client" / "src" / "main.tsx").exists()


def test_extract_bot_archive_applies_compatibility_fixes(bot_archive: Path, tmp_path: Path) -> None:
    output = tmp_path / "working-bot"
    extract_bot_archive(bot_archive, output, prefix="final_bot")

    tsconfig = json.loads((output / "tsconfig.json").read_text())
    assert tsconfig["compilerOptions"]["target"] == "ES2020"
    assert "actual: true" not in (output / "server" / "routes.ts").read_text()


def test_extract_bot_archive_requires_core_files(tmp_path: Path) -> None:
    archive = tmp_path / "broken.zip"
    with ZipFile(archive, "w") as zip_file:
        zip_file.writestr("final_bot/package.json", "{}")

    with pytest.raises(RuntimeError, match="required bot files"):
        extract_bot_archive(archive, tmp_path / "working-bot", prefix="final_bot")


def test_extract_bot_archive_rejects_path_traversal(tmp_path: Path) -> None:
    archive = tmp_path / "unsafe.zip"
    with ZipFile(archive, "w") as zip_file:
        zip_file.writestr("final_bot/package.json", "{}")
        zip_file.writestr("final_bot/server/index.ts", "")
        zip_file.writestr("final_bot/server/routes.ts", "")
        zip_file.writestr("final_bot/client/src/main.tsx", "")
        zip_file.writestr("final_bot/../../evil.txt", "oops")

    with pytest.raises(ValueError, match="Unsafe archive member path"):
        extract_bot_archive(archive, tmp_path / "working-bot", prefix="final_bot")
