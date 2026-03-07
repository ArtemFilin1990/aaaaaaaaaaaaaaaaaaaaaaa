from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

REQUIRED_FILES = {
    "package.json",
    "server/index.ts",
    "server/routes.ts",
    "client/src/main.tsx",
}


def _safe_relative_path(member_name: str, prefix: str) -> Path | None:
    member = PurePosixPath(member_name)
    clean_prefix = prefix.rstrip("/")

    if clean_prefix:
        prefix_path = PurePosixPath(clean_prefix)
        if member == prefix_path:
            return None
        if prefix_path not in member.parents:
            return None
        member = member.relative_to(prefix_path)

    if not member.parts:
        return None

    if member.is_absolute() or ".." in member.parts:
        raise ValueError(f"Unsafe archive member path: {member_name}")

    return Path(*member.parts)


def extract_bot_archive(archive: Path, output_dir: Path, prefix: str, force: bool = False) -> None:
    if not archive.exists():
        raise FileNotFoundError(f"Archive not found: {archive}")

    if output_dir.exists():
        if not force:
            raise FileExistsError(
                f"Output directory already exists: {output_dir}. Use --force to overwrite."
            )
        shutil.rmtree(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)

    found_files: set[str] = set()

    with ZipFile(archive) as zip_file:
        for member_name in zip_file.namelist():
            relative_path = _safe_relative_path(member_name, prefix)
            if relative_path is None:
                continue

            destination = output_dir / relative_path

            if member_name.endswith("/"):
                destination.mkdir(parents=True, exist_ok=True)
                continue

            destination.parent.mkdir(parents=True, exist_ok=True)
            with zip_file.open(member_name) as source, destination.open("wb") as target:
                shutil.copyfileobj(source, target)

            normalized = relative_path.as_posix()
            for required in REQUIRED_FILES:
                if normalized == required:
                    found_files.add(required)

    missing = REQUIRED_FILES - found_files
    if missing:
        raise RuntimeError(
            "Archive extracted, but required bot files were not found: "
            + ", ".join(sorted(missing))
        )

    apply_compatibility_fixes(output_dir)


def apply_compatibility_fixes(output_dir: Path) -> None:
    tsconfig_path = output_dir / "tsconfig.json"
    if tsconfig_path.exists():
        data = json.loads(tsconfig_path.read_text())
        compiler_options = data.setdefault("compilerOptions", {})
        compiler_options.setdefault("target", "ES2020")
        tsconfig_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

    routes_path = output_dir / "server" / "routes.ts"
    if routes_path.exists():
        routes = routes_path.read_text()
        patched = routes.replace("actual: true", "actual: 1")
        if patched != routes:
            routes_path.write_text(patched)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract the bundled Telegram bot project from Dadata-Bot-working.zip"
    )
    parser.add_argument(
        "--archive",
        type=Path,
        default=Path("Dadata-Bot-working.zip"),
        help="Path to source archive (default: Dadata-Bot-working.zip)",
    )
    parser.add_argument(
        "--prefix",
        default="final_bot",
        help="Path prefix inside zip with bot files (default: final_bot)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("working-bot"),
        help="Destination directory (default: working-bot)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite destination directory if it exists",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    extract_bot_archive(
        archive=args.archive,
        output_dir=args.output,
        prefix=args.prefix,
        force=args.force,
    )
    print(f"✅ Bot project extracted to: {args.output}")
    print("Next steps:")
    print(f"  cd {args.output}")
    print("  npm install")
    print("  npm run dev")


if __name__ == "__main__":
    main()
