from __future__ import annotations

import argparse
import json
import re
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


def enrich_company_extra_formatter(routes_source: str) -> str:
    pattern = r"function formatCompanyExtra\(mainData: any\): string \{.*?\n\}\n\nfunction formatEntrepreneurExtra"
    replacement = """function formatCompanyExtra(mainData: any): string {
  const support = Array.isArray(mainData?.ПоддержМСП) ? mainData.ПоддержМСП : [];
  const sanctionsCountries = Array.isArray(mainData?.СанкцииСтраны) ? mainData.СанкцииСтраны : [];
  const badSupplierRecords = Array.isArray(mainData?.НедобПостЗап) ? mainData.НедобПостЗап : [];
  const efrsbRecords = Array.isArray(mainData?.ЕФРСБ) ? mainData.ЕФРСБ : [];

  const supportWithIssues = support.filter((item: any) => Boolean(item?.Наруш)).length;
  const supportTotal = support.reduce((sum: number, item: any) => sum + Number(item?.Размер || 0), 0);

  const lines = ["➕ Дополнительно", ""];
  lines.push(`Наименование на английском: ${trimText(mainData?.НаимАнгл) || "не найдено"}`);
  lines.push(`Товарные знаки: ${Array.isArray(mainData?.ТоварЗнак) ? mainData.ТоварЗнак.length : 0}`);
  lines.push(`Среднесписочная численность (СЧР, 2024): ${firstDefined(mainData?.СЧР, mainData?.СрЧисл) ?? "данные не найдены"}`);
  lines.push(`МСП с господдержкой: ${support.length ? `да (${support.length})` : "нет"}`);

  if (support.length) {
    lines.push(`Поддержка с нарушениями: ${supportWithIssues}`);
    lines.push(`Суммарный размер поддержки: ${supportTotal > 0 ? formatMoney(supportTotal) : "данные не найдены"}`);
    const firstSupport = support[0];
    const org = trimText(firstSupport?.НаимОрг) || trimText(firstSupport?.Наименование);
    const inn = trimText(firstSupport?.ИНН);
    if (org || inn) {
      lines.push(`Первая запись поддержки: ${[org, inn ? `ИНН ${inn}` : ""].filter(Boolean).join(" · ")}`);
    }
  }

  lines.push(`Недобросовестный поставщик: ${mainData?.НедобПост ? "да" : "нет"}`);
  if (badSupplierRecords.length) {
    lines.push(`Записей в РНП: ${badSupplierRecords.length}`);
    const firstBadSupplier = badSupplierRecords[0];
    const contractNo = trimText(firstBadSupplier?.ЗакупНомер);
    const registryNo = trimText(firstBadSupplier?.РеестрНомер);
    if (registryNo || contractNo) {
      lines.push(`Первая запись РНП: ${[registryNo ? `реестр ${registryNo}` : "", contractNo ? `закупка ${contractNo}` : ""].filter(Boolean).join(" · ")}`);
    }
  }

  lines.push(`Дисквалифицированные лица: ${mainData?.ДисквЛица ? "да" : "нет"}`);
  lines.push(`Массовый руководитель: ${mainData?.МассРуковод ? "да" : "нет"}`);
  lines.push(`Массовый учредитель: ${mainData?.МассУчред ? "да" : "нет"}`);
  lines.push(`Нелегальная деятельность на финрынке: ${mainData?.НелегалФин ? "выявлено" : "не выявлено"}`);
  if (trimText(mainData?.НелегалФинСтатус)) {
    lines.push(`Статус нелегальной деятельности: ${trimText(mainData?.НелегалФинСтатус)}`);
  }

  lines.push(`Санкции: ${mainData?.Санкции ? "да" : "нет"}`);
  if (sanctionsCountries.length) lines.push(`Страны санкций: ${sanctionsCountries.join(", ")}`);
  lines.push(`Санкции по правилу 50%: ${mainData?.СанкцУчр ? "да" : "нет"}`);

  if (mainData?.ТекФНС) {
    lines.push(`Текущая ФНС: ${trimText(mainData.ТекФНС.НаимОрг) || trimText(mainData.ТекФНС.КодОрг) || "—"}`);
  }

  lines.push(`ЕФРСБ: ${efrsbRecords.length}`);
  if (efrsbRecords.length) {
    const firstEfrsb = efrsbRecords[0];
    const type = trimText(firstEfrsb?.Тип);
    const date = formatDate(firstEfrsb?.Дата);
    const caseNo = trimText(firstEfrsb?.Дело);
    if (type || date !== "дата не указана" || caseNo) {
      lines.push(`Первая запись ЕФРСБ: ${[type, date !== "дата не указана" ? date : "", caseNo ? `дело ${caseNo}` : ""].filter(Boolean).join(" · ")}`);
    }
  }

  return lines.join("\\n");
}

function formatEntrepreneurExtra"""
    return re.sub(pattern, lambda _: replacement, routes_source, flags=re.S)


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
        patched = enrich_company_extra_formatter(patched)
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
