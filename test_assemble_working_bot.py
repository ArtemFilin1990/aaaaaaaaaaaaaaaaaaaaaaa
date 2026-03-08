from __future__ import annotations

import json
from pathlib import Path
from zipfile import ZipFile

import pytest

from scripts.assemble_working_bot import (
    enrich_company_extra_formatter,
    enrich_dashboard_validation,
    enrich_main_entity_data_extractor,
    enrich_routes_runtime_fixes,
    enrich_storage_runtime_fixes,
    extract_bot_archive,
)


@pytest.fixture
def bot_archive(tmp_path: Path) -> Path:
    archive = tmp_path / "bot.zip"
    with ZipFile(archive, "w") as zip_file:
        zip_file.writestr("final_bot/package.json", "{}")
        zip_file.writestr("final_bot/server/index.ts", "console.log('ok')")
        zip_file.writestr(
            "final_bot/server/routes.ts",
            """
function getMainEntityData(payload: any): any {
  if (!payload || typeof payload !== "object") return undefined;
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload.company) return payload.company;
  if (payload.entrepreneur) return payload.entrepreneur;
  if (payload.person) return payload.person;
  return payload;
}

function hasEntityContent(entityType: string, data: any): boolean {
  return Boolean(data);
}

function formatCompanyExtra(mainData: any): string {
  const lines = ["➕ Дополнительно", ""];
  return lines.join("\\n");
}

function formatEntrepreneurExtra(mainData: any): string {
  const lines = ["ok"];
  return lines.join("\\n");
}

const queryA = { actual: true };
""",
        )
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

    routes_text = (output / "server" / "routes.ts").read_text()
    assert "actual: true" not in routes_text
    assert "actual: 1" in routes_text
    assert "Среднесписочная численность (СЧР, 2024)" in routes_text
    assert "Поддержка с нарушениями" in routes_text
    assert "Записей в РНП" in routes_text
    assert "Санкции по правилу 50%" in routes_text
    assert "candidate.main_data" in routes_text


def test_enrich_company_extra_formatter_no_op_when_function_is_missing() -> None:
    source = "function foo() { return 'bar'; }"
    assert enrich_company_extra_formatter(source) == source


def test_enrich_main_entity_data_extractor_no_op_when_function_is_missing() -> None:
    source = "function foo() { return 'bar'; }"
    assert enrich_main_entity_data_extractor(source) == source


def test_enrich_storage_runtime_fixes_updates_persist_update_config_and_created_at() -> None:
    source = """
private async persist(): Promise<void> {
  const snapshot = this.state ?? { ...defaultState };
  const body = JSON.stringify(snapshot, null, 2);
  this.writeQueue = this.writeQueue.then(() => fs.writeFile(DATA_FILE, body, "utf8"));
  await this.writeQueue;
}

const state = {
  logs: Array.isArray(parsed.logs) ? parsed.logs : [],
};

async updateConfig(id: number, updates: Partial<InsertBotConfig>): Promise<BotConfig> {
  const state = await this.ensureLoaded();
  if (!state.config || state.config.id !== id) {
    throw new Error("Config not found");
  }

  state.config = {
    ...state.config,
    ...updates,
    dadataSecretKey: updates.dadataSecretKey ?? state.config.dadataSecretKey,
    checkoApiKey: updates.checkoApiKey ?? state.config.checkoApiKey,
  };

  await this.persist();
  return state.config;
}

const created = {
  createdAt: new Date(),
};
"""
    patched = enrich_storage_runtime_fixes(source)
    assert "const writeTask = this.writeQueue.then" in patched
    assert 'if ("dadataSecretKey" in updates)' in patched
    assert 'if ("checkoApiKey" in updates)' in patched
    assert "createdAt: new Date()" in patched
    assert "createdAt: new Date(String(item?.createdAt" in patched


def test_enrich_routes_runtime_fixes_adds_ttl_safe_suggest_and_session_helpers() -> None:
    source = """
const sessions = new Map<string, SessionState>();

function getKeyboardByEntityType(entityType: EntityType) {
  return {};
}

async function dadataSuggestParty(query: string, apiKey: string) {
  const data = await dadataRequest("suggest/party", apiKey, { query: query.trim(), count: 5 });
  return data?.suggestions?.[0] ?? null;
}

async function handleSection(chatId: string | number, text: string, config: BotConfig): Promise<string> {
  const session = sessions.get(String(chatId));
  return session ? "ok" : "none";
}

async function handleIncomingText(chatId: string | number, username: string, text: string, config: BotConfig) {
  const activeSession = sessions.get(String(chatId));
  const session = { entityType: "company" } as any;
  sessions.set(String(chatId), session);
  return activeSession;
}
"""
    patched = enrich_routes_runtime_fixes(source)
    assert "const sessionTouchedAt = new Map<string, number>();" in patched
    assert "const SESSION_TTL_MS = 30 * 60 * 1000;" in patched
    assert "const MAX_SESSIONS = 500;" in patched
    assert "function getSession(chatId: string | number): SessionState | undefined" in patched
    assert "function setSession(chatId: string | number, session: SessionState): void" in patched
    assert "const session = getSession(chatId);" in patched
    assert "const activeSession = getSession(chatId);" in patched
    assert "setSession(chatId, session);" in patched
    assert "async function dadataSuggestParty(query: string, apiKey: string)" in patched
    assert "} catch {" in patched


def test_enrich_dashboard_validation_adds_inline_messages() -> None:
    source = """
              <div className="ios-row">
                <KeyRound className="w-5 h-5 text-[#007AFF] mr-3" />
                <input
                  type="password"
                  placeholder="Токен Telegram"
                  className="ios-input"
                  {...form.register("tgToken")}
                />
              </div>
              <div className="ios-row">
                <Database className="w-5 h-5 text-[#5856D6] mr-3" />
                <input
                  type="password"
                  placeholder="API-ключ Dadata"
                  className="ios-input"
                  {...form.register("dadataApiKey")}
                />
              </div>
"""
    patched = enrich_dashboard_validation(source)
    assert "form.formState.errors.tgToken" in patched
    assert "form.formState.errors.dadataApiKey" in patched


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
