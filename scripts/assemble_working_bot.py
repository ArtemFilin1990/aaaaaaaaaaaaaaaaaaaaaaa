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


def enrich_main_entity_data_extractor(routes_source: str) -> str:
    pattern = (
        r"function getMainEntityData\(payload: any\): any \{.*?\n\}\n\nfunction hasEntityContent"
    )
    replacement = """function getMainEntityData(payload: any): any {
  if (!payload || typeof payload !== "object") return undefined;

  const candidates = [payload, payload?.data];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    if (candidate.main_data && typeof candidate.main_data === "object" && !Array.isArray(candidate.main_data)) {
      return candidate.main_data;
    }
  }

  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload.company) return payload.company;
  if (payload.entrepreneur) return payload.entrepreneur;
  if (payload.person) return payload.person;
  return payload;
}

function hasEntityContent"""
    return re.sub(pattern, lambda _: replacement, routes_source, flags=re.S)


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


def enrich_routes_runtime_fixes(routes_source: str) -> str:
    updated = routes_source

    updated = updated.replace(
        "const sessions = new Map<string, SessionState>();",
        """const sessions = new Map<string, SessionState>();
const sessionTouchedAt = new Map<string, number>();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 500;""",
    )

    updated = updated.replace(
        "function getKeyboardByEntityType(entityType: EntityType) {",
        """function cleanupSessions(now = Date.now()) {
  for (const [chatId, touchedAt] of sessionTouchedAt.entries()) {
    if (now - touchedAt > SESSION_TTL_MS) {
      sessionTouchedAt.delete(chatId);
      sessions.delete(chatId);
    }
  }

  if (sessions.size <= MAX_SESSIONS) return;

  const ordered = [...sessionTouchedAt.entries()].sort((a, b) => a[1] - b[1]);
  const toDrop = sessions.size - MAX_SESSIONS;
  for (const [chatId] of ordered.slice(0, toDrop)) {
    sessionTouchedAt.delete(chatId);
    sessions.delete(chatId);
  }
}

function getSession(chatId: string | number): SessionState | undefined {
  const key = String(chatId);
  cleanupSessions();
  const session = sessions.get(key);
  if (!session) return undefined;
  sessionTouchedAt.set(key, Date.now());
  return session;
}

function setSession(chatId: string | number, session: SessionState): void {
  const key = String(chatId);
  sessions.set(key, session);
  sessionTouchedAt.set(key, Date.now());
  cleanupSessions();
}

function getKeyboardByEntityType(entityType: EntityType) {""",
    )

    updated = re.sub(
        r"async function dadataSuggestParty\(query: string, apiKey: string\) \{.*?\n\}",
        """async function dadataSuggestParty(query: string, apiKey: string) {
  try {
    const data = await dadataRequest("suggest/party", apiKey, { query: query.trim(), count: 5 });
    return data?.suggestions?.[0] ?? null;
  } catch {
    return null;
  }
}""",
        updated,
        flags=re.S,
    )

    updated = updated.replace(
        "const session = sessions.get(String(chatId));",
        "const session = getSession(chatId);",
    )
    updated = updated.replace(
        "const activeSession = sessions.get(String(chatId));",
        "const activeSession = getSession(chatId);",
    )
    updated = updated.replace(
        "sessions.set(String(chatId), session);", "setSession(chatId, session);"
    )

    return updated


def enrich_storage_runtime_fixes(storage_source: str) -> str:
    updated = storage_source
    updated = updated.replace(
        "logs: Array.isArray(parsed.logs) ? parsed.logs : [],",
        """logs: Array.isArray(parsed.logs)
          ? parsed.logs.map((item) => ({
              ...item,
              createdAt: new Date(String(item?.createdAt ?? new Date().toISOString())),
            }))
          : [],""",
    )
    updated = re.sub(
        r"private async persist\(\): Promise<void> \{.*?await this\.writeQueue;\n\s*\}",
        """private async persist(): Promise<void> {
    const snapshot = this.state ?? { ...defaultState };
    const body = JSON.stringify(snapshot, null, 2);
    const writeTask = this.writeQueue.then(() => fs.writeFile(DATA_FILE, body, "utf8"));
    this.writeQueue = writeTask.catch(() => undefined);
    await writeTask;
  }""",
        updated,
        flags=re.S,
    )

    updated = re.sub(
        r"async updateConfig\(id: number, updates: Partial<InsertBotConfig>\): Promise<BotConfig> \{.*?return state\.config;\n\s*\}",
        """async updateConfig(id: number, updates: Partial<InsertBotConfig>): Promise<BotConfig> {
    const state = await this.ensureLoaded();
    if (!state.config || state.config.id !== id) {
      throw new Error("Config not found");
    }

    const nextConfig: BotConfig = {
      ...state.config,
      ...updates,
    };

    if ("dadataSecretKey" in updates) {
      nextConfig.dadataSecretKey = updates.dadataSecretKey ?? null;
    }

    if ("checkoApiKey" in updates) {
      nextConfig.checkoApiKey = updates.checkoApiKey ?? null;
    }

    state.config = nextConfig;

    await this.persist();
    return state.config;
  }""",
        updated,
        flags=re.S,
    )

    updated = updated.replace(
        "createdAt: new Date().toISOString(),",
        "createdAt: new Date(),",
    )
    return updated


def enrich_dashboard_validation(dashboard_source: str) -> str:
    updated = dashboard_source
    updated = updated.replace(
        """              <div className="ios-row">
                <KeyRound className="w-5 h-5 text-[#007AFF] mr-3" />
                <input
                  type="password"
                  placeholder="Токен Telegram"
                  className="ios-input"
                  {...form.register("tgToken")}
                />
              </div>""",
        """              <div className="ios-row">
                <KeyRound className="w-5 h-5 text-[#007AFF] mr-3" />
                <input
                  type="password"
                  placeholder="Токен Telegram"
                  className="ios-input"
                  {...form.register("tgToken")}
                />
              </div>
              {form.formState.errors.tgToken && (
                <div className="px-4 pb-2 text-[12px] text-red-500">
                  {form.formState.errors.tgToken.message}
                </div>
              )}""",
    )

    updated = updated.replace(
        """              <div className="ios-row">
                <Database className="w-5 h-5 text-[#5856D6] mr-3" />
                <input
                  type="password"
                  placeholder="API-ключ Dadata"
                  className="ios-input"
                  {...form.register("dadataApiKey")}
                />
              </div>""",
        """              <div className="ios-row">
                <Database className="w-5 h-5 text-[#5856D6] mr-3" />
                <input
                  type="password"
                  placeholder="API-ключ Dadata"
                  className="ios-input"
                  {...form.register("dadataApiKey")}
                />
              </div>
              {form.formState.errors.dadataApiKey && (
                <div className="px-4 pb-2 text-[12px] text-red-500">
                  {form.formState.errors.dadataApiKey.message}
                </div>
              )}""",
    )
    return updated


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
        patched = enrich_main_entity_data_extractor(patched)
        patched = enrich_company_extra_formatter(patched)
        patched = enrich_routes_runtime_fixes(patched)
        if patched != routes:
            routes_path.write_text(patched)

    storage_path = output_dir / "server" / "storage.ts"
    if storage_path.exists():
        storage = storage_path.read_text()
        patched = enrich_storage_runtime_fixes(storage)
        if patched != storage:
            storage_path.write_text(patched)

    dashboard_path = output_dir / "client" / "src" / "pages" / "Dashboard.tsx"
    if dashboard_path.exists():
        dashboard = dashboard_path.read_text()
        patched = enrich_dashboard_validation(dashboard)
        if patched != dashboard:
            dashboard_path.write_text(patched)


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
