from __future__ import annotations

import argparse
import hashlib
import os
import pathlib
import re
import shutil
import subprocess
import zipfile
from datetime import UTC, datetime

ARCHIVE_EXTENSIONS = {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"}
TEXT_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".json",
    ".md",
    ".txt",
    ".sql",
    ".yml",
    ".yaml",
    ".toml",
    ".ini",
    ".cfg",
    ".csv",
    ".xml",
    ".xsd",
    ".html",
    ".css",
    ".sh",
    ".env",
    ".gitignore",
    ".skill",
}
EXCLUDED_DIR_NAMES = {".git", ".venv", "node_modules", "unpacked_archives"}


def safe_name(name: str) -> str:
    return re.sub(r"[^\w.() А-Яа-яЁё-]+", "_", name)


def should_skip_path(path: pathlib.Path) -> bool:
    return any(part in EXCLUDED_DIR_NAMES for part in path.parts)


def discover_archives(root: pathlib.Path, recursive: bool) -> list[pathlib.Path]:
    candidates = root.rglob("*") if recursive else root.iterdir()
    archives: list[pathlib.Path] = []
    for path in sorted(candidates):
        if not path.is_file() or should_skip_path(path):
            continue
        if path.suffix.lower() in ARCHIVE_EXTENSIONS:
            archives.append(path)
    return archives


def _resolve_member_path(target_dir: pathlib.Path, member_name: str) -> pathlib.Path:
    destination = (target_dir / member_name).resolve()
    base = target_dir.resolve()
    if destination != base and base not in destination.parents:
        raise ValueError(f"Unsafe archive member path: {member_name}")
    return destination


def _extract_zip_safely(archive_path: pathlib.Path, target_dir: pathlib.Path) -> None:
    with zipfile.ZipFile(archive_path) as archive:
        for member in archive.infolist():
            _resolve_member_path(target_dir, member.filename)
        archive.extractall(target_dir)


def extract_archive(archive_path: pathlib.Path, target_dir: pathlib.Path) -> int:
    log_path = target_dir / "_extract.log"
    extractor = shutil.which("7z")
    if extractor:
        result = subprocess.run(
            [extractor, "x", "-y", f"-o{target_dir}", str(archive_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        log_path.write_text(result.stdout + "\n" + result.stderr)
        return result.returncode

    if archive_path.suffix.lower() == ".zip":
        try:
            _extract_zip_safely(archive_path, target_dir)
            log_path.write_text("Extracted with Python zipfile fallback (7z not available).\n")
            return 0
        except (zipfile.BadZipFile, ValueError) as exc:
            log_path.write_text(f"Zip extraction failed: {exc}\n")
            return 1

    log_path.write_text(
        "Extraction failed: 7z is not installed and no fallback extractor is available.\n"
    )
    return 1


def load_sql_files(sql_files: list[pathlib.Path], db_url: str) -> tuple[int, list[str]]:
    psql = shutil.which("psql")
    if not psql:
        return 0, ["psql is not installed; SQL files were not loaded."]

    loaded = 0
    errors: list[str] = []
    for sql_file in sql_files:
        result = subprocess.run(
            [psql, db_url, "-v", "ON_ERROR_STOP=1", "-f", str(sql_file)],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            loaded += 1
            continue

        stderr = (result.stderr or "").strip().splitlines()
        first_line = stderr[0] if stderr else "unknown error"
        errors.append(f"{sql_file}: {first_line}")

    return loaded, errors


def preview_file(path: pathlib.Path) -> str:
    raw = path.read_bytes()
    if b"\x00" in raw[:4096]:
        digest = hashlib.sha256(raw[: 1024 * 1024]).hexdigest()[:16]
        return f"Binary file. sha256(first 1MiB): `{digest}`"

    text = raw.decode("utf-8", errors="replace")
    lines = text.splitlines()
    return "```text\n" + "\n".join(lines[:8])[:1200] + "\n```"


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract all archives and generate content index.")
    parser.add_argument("--root", default=".", help="Repository root path")
    parser.add_argument("--output", default="unpacked_archives", help="Extraction output directory")
    parser.add_argument(
        "--report",
        default="ARCHIVE_CONTENT_INDEX.md",
        help="Markdown report with extracted files and previews",
    )
    parser.add_argument(
        "--recursive-scan",
        action="store_true",
        help="Scan for archives recursively in all project folders before extraction.",
    )
    parser.add_argument(
        "--load-sql",
        action="store_true",
        help="Load extracted .sql files into PostgreSQL using psql.",
    )
    parser.add_argument(
        "--db-url",
        default=os.getenv("DATABASE_URL", ""),
        help="PostgreSQL connection URL for --load-sql (defaults to DATABASE_URL env).",
    )
    args = parser.parse_args()

    root = pathlib.Path(args.root).resolve()
    output_dir = root / args.output
    report_path = root / args.report

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)

    processed: set[pathlib.Path] = set()
    archive_queue = discover_archives(root, recursive=args.recursive_scan)

    counter = 0
    while archive_queue:
        archive = archive_queue.pop(0).resolve()
        if archive in processed:
            continue

        processed.add(archive)
        target = output_dir / f"{counter:02d}__{safe_name(archive.name)}"
        counter += 1
        target.mkdir(parents=True, exist_ok=True)

        if extract_archive(archive, target) != 0:
            continue

        for nested in target.rglob("*"):
            if nested.is_file() and nested.suffix.lower() in ARCHIVE_EXTENSIONS:
                archive_queue.append(nested)

    files = sorted(
        path for path in output_dir.rglob("*") if path.is_file() and path.name != "_extract.log"
    )
    sql_files = [path for path in files if path.suffix.lower() == ".sql"]

    sql_loaded_count = 0
    sql_errors: list[str] = []
    if args.load_sql:
        if not args.db_url:
            sql_errors.append(
                "SQL load requested but no DB URL provided (use --db-url or DATABASE_URL)."
            )
        else:
            sql_loaded_count, sql_errors = load_sql_files(sql_files, args.db_url)

    report: list[str] = [
        "# ARCHIVE CONTENT INDEX",
        "",
        f"Generated: {datetime.now(UTC).isoformat()}",
        f"Total extracted files: {len(files)}",
        f"Archive containers processed (including nested): {len(processed)}",
        f"SQL files discovered: {len(sql_files)}",
        f"SQL files loaded: {sql_loaded_count}",
        "",
        "## Processed archives",
    ]

    for index, archive in enumerate(sorted(processed), start=1):
        report.append(f"{index}. `{archive.relative_to(root)}`")

    if args.load_sql:
        report.append("")
        report.append("## SQL load result")
        if sql_errors:
            report.extend(f"- ❌ {error}" for error in sql_errors)
        else:
            report.append("- ✅ SQL load completed without errors")

    report.append("")
    report.append("## File inventory and previews")

    for file_path in files:
        relative = file_path.relative_to(root)
        report.append(f"### `{relative}` ({file_path.stat().st_size} bytes)")

        if file_path.suffix.lower() in TEXT_EXTENSIONS or file_path.stat().st_size < 200_000:
            report.append(preview_file(file_path))
        else:
            digest = hashlib.sha256(file_path.read_bytes()[: 1024 * 1024]).hexdigest()[:16]
            report.append(f"Large/binary file. sha256(first 1MiB): `{digest}`")

        report.append("")

    report_path.write_text("\n".join(report))


if __name__ == "__main__":
    main()
