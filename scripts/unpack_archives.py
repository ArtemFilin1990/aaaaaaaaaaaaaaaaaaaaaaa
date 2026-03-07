from __future__ import annotations

import argparse
import hashlib
import pathlib
import re
import shutil
import subprocess
from datetime import datetime, timezone

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


def safe_name(name: str) -> str:
    return re.sub(r"[^\w.() А-Яа-яЁё-]+", "_", name)


def extract_archive(archive_path: pathlib.Path, target_dir: pathlib.Path) -> int:
    result = subprocess.run(
        ["7z", "x", "-y", f"-o{target_dir}", str(archive_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    (target_dir / "_extract.log").write_text(result.stdout + "\n" + result.stderr)
    return result.returncode


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
    args = parser.parse_args()

    root = pathlib.Path(args.root).resolve()
    output_dir = root / args.output
    report_path = root / args.report

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)

    processed: set[pathlib.Path] = set()
    archive_queue = [
        path
        for path in sorted(root.iterdir())
        if path.is_file() and path.suffix.lower() in ARCHIVE_EXTENSIONS
    ]

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

    report: list[str] = [
        "# ARCHIVE CONTENT INDEX",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        f"Total extracted files: {len(files)}",
        f"Archive containers processed (including nested): {len(processed)}",
        "",
        "## Processed archives",
    ]

    for index, archive in enumerate(sorted(processed), start=1):
        report.append(f"{index}. `{archive.relative_to(root)}`")

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
