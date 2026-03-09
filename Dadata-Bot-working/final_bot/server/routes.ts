import type { Express } from "express";
import type { Server } from "http";
import fetch from "node-fetch";
import { z } from "zod";

import { api } from "@shared/routes";
import type { BotConfig } from "@shared/schema";
import { storage } from "./storage";

let isPolling = false;
let pollingTimeout: NodeJS.Timeout | null = null;
let lastUpdateId = 0;

const MAX_MESSAGE_LENGTH = 3900;

const COMMANDS = {
  start: "/start",
  help: "/help",
  back: "⬅️ Назад",
} as const;

const COMPANY_BUTTONS = {
  requisites: "Реквизиты",
  finances: "Финансы",
  taxes: "Налоги",
  contracts: "Закупки",
  inspections: "Проверки",
  legalCases: "Арбитраж",
  enforcements: "Исп. производства",
  licenses: "Лицензии",
  timeline: "История изменений",
  risks: "Риски",
  extra: "Дополнительно",
} as const;

const ENTREPRENEUR_BUTTONS = {
  requisites: "Реквизиты ИП",
  finances: "Финансы",
  taxes: "Налоги",
  contracts: "Закупки",
  inspections: "Проверки",
  legalCases: "Арбитраж",
  enforcements: "Исп. производства",
  licenses: "Лицензии",
  currentFns: "Текущая ФНС",
  efrsb: "ЕФРСБ",
  risks: "Риски",
  extra: "Дополнительно",
} as const;

const PERSON_BUTTONS = {
  basic: "Основные сведения",
  efrsb: "ЕФРСБ",
  sanctions: "Санкции",
  trademarks: "Товарные знаки",
  links: "Связанные ИП и ЮЛ",
  risks: "Риски",
} as const;

type EntityType = "company" | "entrepreneur" | "person";

type SessionState = {
  entityType: EntityType;
  query: string;
  inn?: string;
  ogrn?: string;
  kpp?: string;
  title: string;
  summary: string;
  dadata?: any;
  cache: Map<string, any>;
};

const sessions = new Map<string, SessionState>();

function normalizeDigits(input: string): string {
  return input.replace(/\D/g, "");
}

function isIdentifierQuery(input: string): boolean {
  const digits = normalizeDigits(input);
  return [8, 10, 12, 13, 15].includes(digits.length);
}

function trimText(input: unknown): string | undefined {
  if (input === null || input === undefined) return undefined;
  const value = String(input).trim();
  return value ? value : undefined;
}

function firstDefined<T>(...values: T[]): T | undefined {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") return "данные не найдены";
  const normalized = typeof value === "number"
    ? value
    : Number(String(value).replace(/\s/g, "").replace(/,/g, "."));
  if (!Number.isFinite(normalized)) return String(value);
  return `${new Intl.NumberFormat("ru-RU").format(normalized)} ₽`;
}

function formatDate(value: unknown): string {
  if (!value) return "—";
  const raw = String(value).trim();
  if (!raw) return "—";

  if (/^\d{13}$/.test(raw)) {
    const date = new Date(Number(raw));
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("ru-RU");
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw) || /^\d{4}\.\d{2}\.\d{2}/.test(raw)) {
    const date = new Date(raw.replace(/\./g, "-"));
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("ru-RU");
  }

  return raw;
}

function chunkText(text: string, maxLength = MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= maxLength) return [text];

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf("\n", maxLength);
    if (splitAt < maxLength * 0.6) {
      splitAt = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitAt < maxLength * 0.5) {
      splitAt = maxLength;
    }

    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) parts.push(remaining);
  return parts.filter(Boolean);
}

function makeKeyboard(rows: string[][]) {
  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
    is_persistent: true,
  };
}

function getKeyboardByEntityType(entityType: EntityType) {
  if (entityType === "company") {
    return makeKeyboard([
      [COMPANY_BUTTONS.requisites],
      [COMPANY_BUTTONS.finances],
      [COMPANY_BUTTONS.taxes],
      [COMPANY_BUTTONS.contracts],
      [COMPANY_BUTTONS.inspections],
      [COMPANY_BUTTONS.legalCases],
      [COMPANY_BUTTONS.enforcements],
      [COMPANY_BUTTONS.licenses],
      [COMPANY_BUTTONS.timeline],
      [COMPANY_BUTTONS.risks],
      [COMPANY_BUTTONS.extra],
      [COMMANDS.back],
    ]);
  }

  if (entityType === "entrepreneur") {
    return makeKeyboard([
      [ENTREPRENEUR_BUTTONS.requisites],
      [ENTREPRENEUR_BUTTONS.finances],
      [ENTREPRENEUR_BUTTONS.taxes],
      [ENTREPRENEUR_BUTTONS.contracts],
      [ENTREPRENEUR_BUTTONS.inspections],
      [ENTREPRENEUR_BUTTONS.legalCases],
      [ENTREPRENEUR_BUTTONS.enforcements],
      [ENTREPRENEUR_BUTTONS.licenses],
      [ENTREPRENEUR_BUTTONS.currentFns],
      [ENTREPRENEUR_BUTTONS.efrsb],
      [ENTREPRENEUR_BUTTONS.risks],
      [ENTREPRENEUR_BUTTONS.extra],
      [COMMANDS.back],
    ]);
  }

  return makeKeyboard([
    [PERSON_BUTTONS.basic],
    [PERSON_BUTTONS.efrsb],
    [PERSON_BUTTONS.sanctions],
    [PERSON_BUTTONS.trademarks],
    [PERSON_BUTTONS.links],
    [PERSON_BUTTONS.risks],
    [COMMANDS.back],
  ]);
}

function getStatusLabelFromDadata(state: any): string | undefined {
  const status = state?.status;
  if (!status) return undefined;
  if (status === "ACTIVE") return "Действует";
  if (status === "LIQUIDATED") return "Деятельность прекращена";
  if (status === "LIQUIDATING") return "Ликвидируется";
  if (status === "BANKRUPT") return "Банкротство";
  return String(status);
}

function getStatusLabelFromChecko(status: any): string | undefined {
  if (!status) return undefined;
  if (typeof status === "string") return status;
  if (typeof status === "object") {
    return trimText(status.Наим) || trimText(status.name) || trimText(status.Статус);
  }
  return String(status);
}

function getEntityName(data: any, dadata?: any): string {
  return (
    trimText(dadata?.value) ||
    trimText(data?.НаимПолн) ||
    trimText(data?.НаимСокр) ||
    trimText(data?.ФИО) ||
    trimText(data?.ФИОПолн) ||
    trimText(data?.name?.full_with_opf) ||
    trimText(data?.name?.short_with_opf) ||
    "Объект не найден"
  );
}

function getAddress(data: any, dadata?: any): string | undefined {
  return (
    trimText(data?.ЮрАдрес) ||
    trimText(data?.АдресПолн) ||
    trimText(data?.Адрес) ||
    trimText(data?.АдресПрож) ||
    trimText(dadata?.address?.value)
  );
}

function getDirectorName(data: any, dadata?: any): string | undefined {
  return (
    trimText(data?.Руковод?.ФИО) ||
    trimText(data?.Руковод?.Наим) ||
    trimText(data?.Руководитель) ||
    trimText(dadata?.management?.name)
  );
}

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

function hasEntityContent(entityType: EntityType, data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (entityType === "company") {
    return Boolean(trimText(data.ИНН) || trimText(data.ОГРН) || trimText(data.НаимПолн) || trimText(data.НаимСокр));
  }
  if (entityType === "entrepreneur") {
    return Boolean(trimText(data.ИНН) || trimText(data.ОГРНИП) || trimText(data.ФИО));
  }
  return Boolean(trimText(data.ИНН) || trimText(data.ФИО));
}

async function telegramCall(token: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.json() as Promise<any>;
}

async function sendTelegramMessage(token: string, chatId: string | number, text: string, options: Record<string, unknown> = {}) {
  const chunks = chunkText(text);
  for (let index = 0; index < chunks.length; index += 1) {
    const isLast = index === chunks.length - 1;
    await telegramCall(token, "sendMessage", {
      chat_id: chatId,
      text: chunks[index],
      ...(isLast ? options : {}),
    });
  }
}

async function dadataRequest(endpoint: string, apiKey: string, body: Record<string, unknown>, secretKey?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Token ${apiKey}`,
  };

  if (secretKey) headers["X-Secret"] = secretKey;

  const response = await fetch(`https://suggestions.dadata.ru/suggestions/api/4_1/rs/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Dadata API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<any>;
}

async function dadataFindParty(query: string, apiKey: string, type?: "LEGAL" | "INDIVIDUAL") {
  const payload: Record<string, unknown> = { query: query.trim(), count: 5 };
  if (type) payload.type = type;
  const data = await dadataRequest("findById/party", apiKey, payload);
  return data?.suggestions?.[0] ?? null;
}

async function dadataSuggestParty(query: string, apiKey: string) {
  const data = await dadataRequest("suggest/party", apiKey, { query: query.trim(), count: 5 });
  return data?.suggestions?.[0] ?? null;
}

async function dadataCleanAddress(query: string, apiKey: string, secretKey?: string | null) {
  const response = await fetch("https://cleaner.dadata.ru/api/v1/clean/address", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Token ${apiKey}`,
      ...(secretKey ? { "X-Secret": secretKey } : {}),
    },
    body: JSON.stringify([query]),
  });

  if (!response.ok) {
    throw new Error(`Dadata API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any[];
  return data?.[0] ?? null;
}

async function checkoGet(endpoint: string, params: Record<string, string | number | undefined>, apiKey?: string | null) {
  if (!apiKey) {
    throw new Error("Checko API key не задан");
  }

  const searchParams = new URLSearchParams({ key: apiKey });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && `${value}` !== "") {
      searchParams.set(key, String(value));
    }
  }

  const response = await fetch(`https://api.checko.ru/v2/${endpoint}?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(`Checko API error: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as any;
  if (payload?.meta?.status === "error") {
    throw new Error(trimText(payload?.meta?.message) || "Checko вернул ошибку");
  }

  return payload;
}

async function checkoGetOptional(endpoint: string, params: Record<string, string | number | undefined>, apiKey?: string | null) {
  try {
    return await checkoGet(endpoint, params, apiKey);
  } catch {
    return null;
  }
}

function buildSessionFromDadata(suggestion: any, query: string): SessionState {
  const data = suggestion?.data || {};
  const entityType: EntityType = data.type === "INDIVIDUAL" || normalizeDigits(String(data.inn || "")).length === 12
    ? "entrepreneur"
    : "company";

  const session: SessionState = {
    entityType,
    query,
    inn: trimText(data.inn),
    ogrn: trimText(data.ogrn),
    kpp: trimText(data.kpp),
    title: trimText(suggestion?.value) || "Контрагент",
    summary: "",
    dadata: data,
    cache: new Map<string, any>(),
  };

  session.summary = buildSummary(session);
  return session;
}

function buildSessionFromChecko(entityType: EntityType, payload: any, query: string): SessionState {
  const data = getMainEntityData(payload) || {};
  const session: SessionState = {
    entityType,
    query,
    inn: trimText(data.ИНН),
    ogrn: trimText(data.ОГРН) || trimText(data.ОГРНИП),
    kpp: trimText(data.КПП),
    title: getEntityName(data),
    summary: "",
    dadata: undefined,
    cache: new Map<string, any>([["main", payload]]),
  };

  session.summary = buildSummary(session);
  return session;
}

async function warmMainPayload(session: SessionState, config: BotConfig) {
  if (!config.checkoApiKey) return;
  if (session.cache.has("main")) return;

  if (session.entityType === "company") {
    const payload = await checkoGetOptional("company", { inn: session.inn, ogrn: session.ogrn, kpp: session.kpp }, config.checkoApiKey);
    if (payload) session.cache.set("main", payload);
  } else if (session.entityType === "entrepreneur") {
    const payload = await checkoGetOptional("entrepreneur", { inn: session.inn, ogrn: session.ogrn }, config.checkoApiKey);
    if (payload) session.cache.set("main", payload);
  } else if (session.entityType === "person" && session.inn) {
    const payload = await checkoGetOptional("person", { inn: session.inn }, config.checkoApiKey);
    if (payload) session.cache.set("main", payload);
  }

  session.summary = buildSummary(session);
}

async function resolveEntitySession(query: string, config: BotConfig): Promise<SessionState | null> {
  const digits = normalizeDigits(query);

  if (digits.length === 10 || digits.length === 13) {
    const suggestion = await dadataFindParty(digits, config.dadataApiKey, "LEGAL");
    if (suggestion) {
      const session = buildSessionFromDadata(suggestion, query);
      await warmMainPayload(session, config);
      return session;
    }

    const payload = await checkoGetOptional("company", digits.length === 10 ? { inn: digits } : { ogrn: digits }, config.checkoApiKey);
    if (payload && hasEntityContent("company", getMainEntityData(payload))) {
      return buildSessionFromChecko("company", payload, query);
    }

    return null;
  }

  if (digits.length === 12 || digits.length === 15) {
    const suggestion = await dadataFindParty(digits, config.dadataApiKey, "INDIVIDUAL");
    if (suggestion) {
      const session = buildSessionFromDadata(suggestion, query);
      await warmMainPayload(session, config);
      return session;
    }

    const entrepreneurPayload = await checkoGetOptional(
      "entrepreneur",
      digits.length === 12 ? { inn: digits } : { ogrn: digits },
      config.checkoApiKey,
    );

    if (entrepreneurPayload && hasEntityContent("entrepreneur", getMainEntityData(entrepreneurPayload))) {
      return buildSessionFromChecko("entrepreneur", entrepreneurPayload, query);
    }

    if (digits.length === 12) {
      const personPayload = await checkoGetOptional("person", { inn: digits }, config.checkoApiKey);
      if (personPayload && hasEntityContent("person", getMainEntityData(personPayload))) {
        return buildSessionFromChecko("person", personPayload, query);
      }
    }

    return null;
  }

  if (digits.length === 8) {
    const companyPayload = await checkoGetOptional("company", { okpo: digits }, config.checkoApiKey);
    if (companyPayload && hasEntityContent("company", getMainEntityData(companyPayload))) {
      return buildSessionFromChecko("company", companyPayload, query);
    }

    const entrepreneurPayload = await checkoGetOptional("entrepreneur", { okpo: digits }, config.checkoApiKey);
    if (entrepreneurPayload && hasEntityContent("entrepreneur", getMainEntityData(entrepreneurPayload))) {
      return buildSessionFromChecko("entrepreneur", entrepreneurPayload, query);
    }
  }

  const suggestion = await dadataSuggestParty(query, config.dadataApiKey);
  if (suggestion) {
    const session = buildSessionFromDadata(suggestion, query);
    await warmMainPayload(session, config);
    return session;
  }

  return null;
}

function getCurrentMainData(session: SessionState): any {
  return getMainEntityData(session.cache.get("main"));
}

function buildSummary(session: SessionState): string {
  const mainData = getCurrentMainData(session);
  const data = mainData || session.dadata || {};
  const lines: string[] = [];
  const title = getEntityName(data, session.dadata);
  const status = getStatusLabelFromChecko(data?.Статус) || getStatusLabelFromDadata(session.dadata?.state);
  const address = getAddress(data, session.dadata);
  const director = getDirectorName(data, session.dadata);
  const okved = trimText(data?.ОКВЭД) || trimText(session.dadata?.okved);
  const okvedName = trimText(data?.ОКВЭДНаим) || trimText(session.dadata?.okveds?.[0]?.name);

  if (session.entityType === "person") {
    lines.push(`👤 ${title}`);
    lines.push(`ИНН: ${session.inn || trimText(data?.ИНН) || "—"}`);
    lines.push(`Санкции: ${data?.Санкции ? "да" : "нет"}`);
    lines.push(`ЕФРСБ: ${Array.isArray(data?.ЕФРСБ) ? data.ЕФРСБ.length : 0}`);
    lines.push("");
    lines.push("Выберите раздел в меню ниже.");
    return lines.join("\n");
  }

  lines.push(`🏢 ${title}`);
  if (status) lines.push(`Статус: ${status}`);
  lines.push(`ИНН: ${session.inn || trimText(data?.ИНН) || "—"}`);
  if (session.entityType === "company") {
    lines.push(`КПП: ${session.kpp || trimText(data?.КПП) || trimText(session.dadata?.kpp) || "—"}`);
    lines.push(`ОГРН: ${session.ogrn || trimText(data?.ОГРН) || trimText(session.dadata?.ogrn) || "—"}`);
  } else {
    lines.push(`ОГРНИП: ${session.ogrn || trimText(data?.ОГРНИП) || trimText(data?.ОГРН) || trimText(session.dadata?.ogrn) || "—"}`);
  }

  const regDate = firstDefined(
    trimText(data?.ДатаРег),
    trimText(data?.ДатаОГРН),
    trimText(data?.ДатаОГРНИП),
    session.dadata?.state?.registration_date,
  );
  if (regDate) lines.push(`Дата регистрации: ${formatDate(regDate)}`);
  if (address) lines.push(`Адрес: ${address}`);
  if (director) lines.push(`Руководитель: ${director}`);
  if (okved) {
    lines.push(`ОКВЭД: ${okved}${okvedName ? ` — ${okvedName}` : ""}`);
  }

  if (session.entityType === "company") {
    const foundersCount = Array.isArray(data?.Учред) ? data.Учред.length : Array.isArray(session.dadata?.founders) ? session.dadata.founders.length : 0;
    if (foundersCount) lines.push(`Учредителей: ${foundersCount}`);
  }

  lines.push("");
  lines.push("Выберите раздел в меню ниже.");
  return lines.join("\n");
}

async function getCachedPayload(session: SessionState, cacheKey: string, loader: () => Promise<any>) {
  if (session.cache.has(cacheKey)) {
    return session.cache.get(cacheKey);
  }
  const payload = await loader();
  session.cache.set(cacheKey, payload);
  return payload;
}

function financeCellValue(value: any): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "object") {
    const nested = firstDefined(value.СумОтч, value.Итог, value.СумПред, value.СумПрдщ, value.Сумма, value.value);
    return financeCellValue(nested);
  }
  const numeric = Number(String(value).replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function formatRequisites(session: SessionState): string {
  const mainData = getCurrentMainData(session);
  const data = mainData || session.dadata || {};
  const founders = Array.isArray(mainData?.Учред)
    ? mainData.Учред.slice(0, 5).map((item: any) => `• ${trimText(item.Наим) || trimText(item.ФИО) || trimText(item.НаимСокр) || "учредитель"}`)
    : Array.isArray(session.dadata?.founders)
      ? session.dadata.founders.slice(0, 5).map((item: any) => `• ${trimText(item.name) || "учредитель"}`)
      : [];

  const lines = [session.entityType === "company" ? "📑 Реквизиты" : "📑 Реквизиты ИП", ""];
  lines.push(getEntityName(data, session.dadata));
  lines.push(`ИНН: ${session.inn || trimText(data?.ИНН) || "—"}`);
  if (session.entityType === "company") {
    lines.push(`КПП: ${session.kpp || trimText(data?.КПП) || trimText(session.dadata?.kpp) || "—"}`);
    lines.push(`ОГРН: ${session.ogrn || trimText(data?.ОГРН) || trimText(session.dadata?.ogrn) || "—"}`);
  } else {
    lines.push(`ОГРНИП: ${session.ogrn || trimText(data?.ОГРНИП) || trimText(data?.ОГРН) || trimText(session.dadata?.ogrn) || "—"}`);
  }

  const okpo = trimText(data?.ОКПО) || trimText(session.dadata?.okpo);
  const oktmo = trimText(data?.ОКТМО) || trimText(session.dadata?.oktmo);
  const status = getStatusLabelFromChecko(data?.Статус) || getStatusLabelFromDadata(session.dadata?.state);
  const regDate = firstDefined(trimText(data?.ДатаРег), trimText(data?.ДатаОГРН), trimText(data?.ДатаОГРНИП), session.dadata?.state?.registration_date);
  const capital = firstDefined(data?.Капитал, data?.УстКап, session.dadata?.capital?.value);
  const address = getAddress(data, session.dadata);
  const okved = trimText(data?.ОКВЭД) || trimText(session.dadata?.okved);
  const okvedName = trimText(data?.ОКВЭДНаим) || trimText(session.dadata?.okveds?.[0]?.name);
  const director = getDirectorName(data, session.dadata);
  const registrar = trimText(data?.РегОрг?.Наим) || trimText(data?.ТекФНС?.НаимОрг);

  if (okpo) lines.push(`ОКПО: ${okpo}`);
  if (oktmo) lines.push(`ОКТМО: ${oktmo}`);
  if (status) lines.push(`Статус: ${status}`);
  if (regDate) lines.push(`Дата регистрации: ${formatDate(regDate)}`);
  if (address) lines.push(`Адрес: ${address}`);
  if (capital !== undefined) lines.push(`Уставный капитал: ${formatMoney(capital)}`);
  if (okved) lines.push(`ОКВЭД: ${okved}${okvedName ? ` — ${okvedName}` : ""}`);
  if (director) lines.push(`Руководитель: ${director}`);
  if (registrar) lines.push(`Текущая ФНС: ${registrar}`);
  if (founders.length && session.entityType === "company") {
    lines.push("");
    lines.push("Учредители:");
    lines.push(...founders);
  }

  return lines.join("\n");
}

function formatFinances(payload: any, entityType: EntityType): string {
  if (entityType !== "company") {
    return "💰 Финансы\n\nДля ИП и физлиц метод /finances официально не возвращает бухгалтерскую отчетность. Этот раздел имеет смысл только для организаций.";
  }

  const data = payload?.data || {};
  const yearKeys = Object.keys(data)
    .filter((key) => /^\d{4}$/.test(key))
    .sort((a, b) => Number(b) - Number(a));

  if (!yearKeys.length) {
    return "💰 Финансы\n\nФинансовая отчетность не найдена.";
  }

  const lines = ["💰 Финансы", "", "Выручка:"];
  for (const year of yearKeys.slice(0, 5)) {
    lines.push(`• ${year} — ${formatMoney(financeCellValue(data[year]?.[2110] ?? data[year]?.["2110"] ?? data[year]?.Выручка))}`);
  }

  lines.push("", "Чистая прибыль:");
  for (const year of yearKeys.slice(0, 5)) {
    lines.push(`• ${year} — ${formatMoney(financeCellValue(data[year]?.[2400] ?? data[year]?.["2400"] ?? data[year]?.ЧистПриб))}`);
  }

  lines.push("", "Активы баланса:");
  for (const year of yearKeys.slice(0, 5)) {
    lines.push(`• ${year} — ${formatMoney(financeCellValue(data[year]?.[1600] ?? data[year]?.["1600"] ?? data[year]?.Активы ?? data[year]?.Баланс))}`);
  }

  lines.push("", "Налог на прибыль:");
  for (const year of yearKeys.slice(0, 5)) {
    lines.push(`• ${year} — ${formatMoney(financeCellValue(data[year]?.[2410] ?? data[year]?.["2410"] ?? data[year]?.НалогПриб))}`);
  }

  const girbo = payload?.["bo.nalog.ru"] || payload?.boNalogRu || payload?.bo_nalog_ru;
  const girboId = girbo?.ID || girbo?.Id || girbo?.id;
  if (girboId !== undefined && girboId !== null) {
    lines.push("", `ГИР БО ID: ${girboId}`);
  }

  const reports = girbo?.Отчет || girbo?.Отчёт || girbo?.report || {};
  const reportEntries = Object.entries(reports)
    .filter(([year, url]) => /^\d{4}$/.test(year) && trimText(url))
    .sort((a, b) => Number(b[0]) - Number(a[0]));

  if (reportEntries.length) {
    lines.push("", "Официальные отчёты ФНС:");
    for (const [year, url] of reportEntries) {
      lines.push(`• ${year} — ${String(url)}`);
    }
  }

  return lines.join("\n");
}

function formatCompanyTaxes(mainData: any): string {
  const taxBlock = mainData?.Налоги || {};
  const year = firstDefined(mainData?.СведУплГод, taxBlock?.СведУплГод, mainData?.ГодУплаты);
  const debt = firstDefined(mainData?.СумНедоим, taxBlock?.СумНедоим, mainData?.Недоимка);

  const lines = ["🧾 Налоги", ""];
  lines.push(`Год сведений об уплате налогов: ${year ?? "данные не найдены"}`);
  lines.push(`Общая сумма задолженности по налогам и сборам: ${debt === undefined ? "данные не найдены" : formatMoney(debt)}`);

  if (debt === undefined) {
    lines.push("Статус: данные не найдены");
  } else if (Number(debt) > 0) {
    lines.push("Статус: есть задолженность");
  } else {
    lines.push("Статус: задолженность не выявлена");
  }

  return lines.join("\n");
}

function formatEntrepreneurTaxes(mainData: any): string {
  const taxBlock = mainData?.Налоги || {};
  const regimes = Array.isArray(taxBlock?.ОсобРежим) ? taxBlock.ОсобРежим : [];
  const lines = ["🧾 Налоги ИП", ""];
  lines.push(`Особые режимы: ${regimes.length ? regimes.join(", ") : "данные не найдены"}`);
  return lines.join("\n");
}

function formatContracts(records: Array<any>): string {
  if (!records.length) {
    return "📦 Закупки\n\nКонтракты не найдены.";
  }

  const total = records.reduce((sum, item) => sum + Number(item.Цена || item.price || 0), 0);
  const lines = ["📦 Закупки", "", `Найдено контрактов: ${records.length}`, `Общая сумма: ${formatMoney(total)}`, "", "Последние контракты:"];
  for (const [index, item] of records.slice(0, 8).entries()) {
    const law = item.__law || item.Закон || item.law || "—";
    const role = item.__role || item.role || "—";
    const customer = trimText(item?.Заказ?.НаимСокр) || trimText(item?.Заказ?.НаимПолн) || trimText(item?.customer);
    lines.push(`${index + 1}. ${law} · роль: ${role}`);
    lines.push(`   Сумма: ${formatMoney(item.Цена || item.price)}`);
    lines.push(`   Дата подписания: ${formatDate(item.Дата || item.date)}`);
    lines.push(`   Дата исполнения: ${formatDate(item.ДатаИсп || item.execution_date)}`);
    if (trimText(item.РегНомер) || trimText(item.number)) {
      lines.push(`   Номер: ${trimText(item.РегНомер) || trimText(item.number)}`);
    }
    if (customer) {
      lines.push(`   Заказчик: ${customer}`);
    }
  }

  return lines.join("\n");
}

function formatInspections(payload: any): string {
  const items = payload?.data?.Записи || payload?.data?.records || [];
  if (!items.length) {
    return "🔎 Проверки\n\nПроверки не найдены.";
  }

  const lines = ["🔎 Проверки", "", `Найдено проверок: ${items.length}`];
  for (const [index, item] of items.slice(0, 6).entries()) {
    lines.push(`${index + 1}. ${trimText(item.Номер) || "Проверка"}`);
    lines.push(`   Статус: ${trimText(item.Статус) || "—"}`);
    lines.push(`   Дата начала: ${formatDate(item.ДатаНач || item.Дата)}`);
    lines.push(`   Дата окончания: ${formatDate(item.ДатаОконч)}`);
    lines.push(`   Нарушения: ${item.Наруш ? "да" : "нет"}`);
  }
  return lines.join("\n");
}

function formatLegalCases(payload: any): string {
  const data = payload?.data || {};
  const items = data.Записи || data.records || [];
  if (!items.length) {
    return "⚖️ Арбитраж\n\nАрбитражные дела не найдены.";
  }

  const totalClaim = firstDefined(data.ОбщСуммИск, data.total_claim_amount);
  const lines = ["⚖️ Арбитраж", "", `Найдено дел: ${items.length}`];
  if (totalClaim !== undefined) lines.push(`Общая сумма исков: ${formatMoney(totalClaim)}`);

  for (const [index, item] of items.slice(0, 6).entries()) {
    lines.push(`${index + 1}. ${trimText(item.Номер) || trimText(item.case_number) || "Дело"}`);
    lines.push(`   Дата: ${formatDate(item.Дата || item.date)}`);
    if (trimText(item.Суд) || trimText(item.court)) {
      lines.push(`   Суд: ${trimText(item.Суд) || trimText(item.court)}`);
    }
    if (firstDefined(item.СуммИск, item.claim_amount) !== undefined) {
      lines.push(`   Сумма иска: ${formatMoney(firstDefined(item.СуммИск, item.claim_amount))}`);
    }
  }
  return lines.join("\n");
}

function formatEnforcements(payload: any, entityType: EntityType): string {
  if (entityType !== "company") {
    return "💸 Исполнительные производства\n\nМетод /enforcements в Checko предназначен для организаций. Для ИП и физлиц этот раздел официально не поддерживается.";
  }

  const items = payload?.data?.Записи || payload?.data?.records || [];
  if (!items.length) {
    return "💸 Исполнительные производства\n\nЗаписи не найдены.";
  }

  const total = items.reduce((sum: number, item: any) => sum + Number(item.ОстЗадолж || item.СумДолг || 0), 0);
  const lines = ["💸 Исполнительные производства", "", `Найдено производств: ${items.length}`, `Сумма: ${formatMoney(total)}`];
  for (const [index, item] of items.slice(0, 6).entries()) {
    lines.push(`${index + 1}. ${trimText(item.ИспПрНомер) || "Производство"}`);
    lines.push(`   Дата: ${formatDate(item.ИспПрДата)}`);
    if (trimText(item.ПредмИсп)) lines.push(`   Предмет: ${trimText(item.ПредмИсп)}`);
    if (firstDefined(item.ОстЗадолж, item.СумДолг) !== undefined) {
      lines.push(`   Остаток: ${formatMoney(firstDefined(item.ОстЗадолж, item.СумДолг))}`);
    }
  }
  return lines.join("\n");
}

function extractLicenses(mainData: any): any[] {
  const licenses = mainData?.Лиценз || mainData?.Лицензии || mainData?.licenses || [];
  return Array.isArray(licenses) ? licenses : [];
}

function formatLicenses(mainData: any): string {
  const licenses = extractLicenses(mainData);
  if (!licenses.length) {
    return "📜 Лицензии\n\nЛицензии не найдены.";
  }

  const lines = ["📜 Лицензии", ""];
  for (const [index, item] of licenses.slice(0, 6).entries()) {
    lines.push(`${index + 1}. ${trimText(item.Номер) || trimText(item.number) || "Лицензия"}`);
    lines.push(`   Дата выдачи: ${formatDate(item.Дата || item.issue_date)}`);
    lines.push(`   Дата начала: ${formatDate(item.ДатаНач || item.valid_from)}`);
    lines.push(`   Дата окончания: ${formatDate(item.ДатаОконч || item.valid_to)}`);
    if (trimText(item.ЛицОрг) || trimText(item.issue_authority)) {
      lines.push(`   Орган: ${trimText(item.ЛицОрг) || trimText(item.issue_authority)}`);
    }
  }

  return lines.join("\n");
}

function formatTimeline(payload: any): string {
  const items = Array.isArray(payload?.data) ? payload.data : [];
  if (!items.length) {
    return "🕘 История изменений\n\nИстория изменений не найдена.";
  }

  const lines = ["🕘 История изменений", ""];
  for (const [index, item] of items.slice(0, 12).entries()) {
    lines.push(`${index + 1}. ${formatDate(item.Дата)}`);
    lines.push(`   ${trimText(item.Событие) || trimText(item.event) || "Событие"}`);
  }
  return lines.join("\n");
}

function formatCurrentFns(mainData: any): string {
  const currentFns = mainData?.ТекФНС || mainData?.CurrentFns;
  if (!currentFns) {
    return "🏛 Текущая ФНС\n\nДанные не найдены.";
  }

  const lines = ["🏛 Текущая ФНС", ""];
  lines.push(`Код: ${trimText(currentFns.КодОрг) || "—"}`);
  lines.push(`Наименование: ${trimText(currentFns.НаимОрг) || "—"}`);
  lines.push(`Дата постановки на учет: ${formatDate(currentFns.Дата)}`);
  if (trimText(currentFns.АдресОрг)) lines.push(`Адрес: ${trimText(currentFns.АдресОрг)}`);
  return lines.join("\n");
}

function formatEfrsb(mainData: any): string {
  const records = Array.isArray(mainData?.ЕФРСБ) ? mainData.ЕФРСБ : [];
  if (!records.length) {
    return "⚠️ ЕФРСБ\n\nСообщения не найдены.";
  }

  const lines = ["⚠️ ЕФРСБ", "", `Найдено сообщений: ${records.length}`];
  for (const [index, item] of records.slice(0, 8).entries()) {
    lines.push(`${index + 1}. ${trimText(item.Тип) || "Сообщение"}`);
    lines.push(`   Дата: ${formatDate(item.Дата)}`);
    if (trimText(item.Дело)) lines.push(`   Дело: ${trimText(item.Дело)}`);
  }
  return lines.join("\n");
}

function formatTrademarks(mainData: any): string {
  const records = Array.isArray(mainData?.ТоварЗнак) ? mainData.ТоварЗнак : [];
  if (!records.length) {
    return "™️ Товарные знаки\n\nТоварные знаки не найдены.";
  }

  const lines = ["™️ Товарные знаки", ""];
  for (const [index, item] of records.slice(0, 8).entries()) {
    lines.push(`${index + 1}. ${trimText(item.ID) || trimText(item.id) || "Регистрация"}`);
    lines.push(`   Дата регистрации: ${formatDate(item.ДатаРег)}`);
    lines.push(`   Дата окончания: ${formatDate(item.ДатаОконч)}`);
    if (trimText(item.URL) || trimText(item.url)) {
      lines.push(`   Ссылка: ${trimText(item.URL) || trimText(item.url)}`);
    }
  }
  return lines.join("\n");
}

function formatLinkedBusinesses(mainData: any): string {
  const directorCompanies = Array.isArray(mainData?.Руковод) ? mainData.Руковод : [];
  const founderCompanies = Array.isArray(mainData?.Учред) ? mainData.Учред : [];
  const entrepreneurs = Array.isArray(mainData?.ИП) ? mainData.ИП : [];

  const lines = ["🔗 Связанные ИП и ЮЛ", ""];
  lines.push(`Организации как руководитель: ${directorCompanies.length}`);
  directorCompanies.slice(0, 5).forEach((item: any) => lines.push(`• ${trimText(item.НаимСокр) || trimText(item.НаимПолн) || "организация"}`));
  lines.push("");
  lines.push(`Организации как учредитель: ${founderCompanies.length}`);
  founderCompanies.slice(0, 5).forEach((item: any) => lines.push(`• ${trimText(item.НаимСокр) || trimText(item.НаимПолн) || "организация"}`));
  lines.push("");
  lines.push(`Связанные ИП: ${entrepreneurs.length}`);
  entrepreneurs.slice(0, 5).forEach((item: any) => lines.push(`• ${trimText(item.ФИО) || "ИП"}`));
  return lines.join("\n");
}

function formatCompanyExtra(mainData: any): string {
  const support = Array.isArray(mainData?.ПоддержМСП) ? mainData.ПоддержМСП : [];
  const sanctionsCountries = Array.isArray(mainData?.СанкцииСтраны) ? mainData.СанкцииСтраны : [];
  const lines = ["➕ Дополнительно", ""];
  lines.push(`Наименование на английском: ${trimText(mainData?.НаимАнгл) || "не найдено"}`);
  lines.push(`Товарные знаки: ${Array.isArray(mainData?.ТоварЗнак) ? mainData.ТоварЗнак.length : 0}`);
  lines.push(`МСП с господдержкой: ${support.length ? `да (${support.length})` : "нет"}`);
  lines.push(`Нелегальная деятельность на финрынке: ${mainData?.НелегалФин ? "выявлено" : "не выявлено"}`);
  lines.push(`Санкции: ${mainData?.Санкции ? "да" : "нет"}`);
  if (sanctionsCountries.length) lines.push(`Страны санкций: ${sanctionsCountries.join(", ")}`);
  if (mainData?.ТекФНС) {
    lines.push(`Текущая ФНС: ${trimText(mainData.ТекФНС.НаимОрг) || trimText(mainData.ТекФНС.КодОрг) || "—"}`);
  }
  lines.push(`ЕФРСБ: ${Array.isArray(mainData?.ЕФРСБ) ? mainData.ЕФРСБ.length : 0}`);
  return lines.join("\n");
}

function formatEntrepreneurExtra(mainData: any): string {
  const support = Array.isArray(mainData?.ПоддержМСП) ? mainData.ПоддержМСП : [];
  const regimes = Array.isArray(mainData?.Налоги?.ОсобРежим) ? mainData.Налоги.ОсобРежим : [];
  const lines = ["➕ Дополнительно", ""];
  lines.push(`Товарные знаки: ${Array.isArray(mainData?.ТоварЗнак) ? mainData.ТоварЗнак.length : 0}`);
  lines.push(`МСП с господдержкой: ${support.length ? `да (${support.length})` : "нет"}`);
  lines.push(`Особые режимы: ${regimes.length ? regimes.join(", ") : "не найдены"}`);
  lines.push(`Адрес: ${trimText(mainData?.АдресПолн) || trimText(mainData?.Адрес) || "не найден"}`);
  lines.push(`ОКВЭД: ${trimText(mainData?.ОКВЭД) || "не найден"}`);
  return lines.join("\n");
}

function formatRisks(entityType: EntityType, mainData: any): string {
  const lines = ["🚦 Риски", ""];
  if (entityType === "company") {
    lines.push(`Санкции: ${mainData?.Санкции ? "да" : "нет"}`);
    lines.push(`Нелегальная деятельность на финрынке: ${mainData?.НелегалФин ? "выявлено" : "не выявлено"}`);
    lines.push(`ЕФРСБ: ${Array.isArray(mainData?.ЕФРСБ) ? mainData.ЕФРСБ.length : 0}`);
    if (firstDefined(mainData?.СумНедоим, mainData?.Налоги?.СумНедоим) !== undefined) {
      const debt = firstDefined(mainData?.СумНедоим, mainData?.Налоги?.СумНедоим);
      lines.push(`Налоговая задолженность: ${Number(debt) > 0 ? formatMoney(debt) : "не выявлена"}`);
    }
    lines.push(`Массовый адрес: ${Array.isArray(mainData?.МассАдрес) && mainData.МассАдрес.length ? `да (${mainData.МассАдрес.length})` : "нет"}`);
  } else if (entityType === "entrepreneur") {
    lines.push(`ЕФРСБ: ${Array.isArray(mainData?.ЕФРСБ) ? mainData.ЕФРСБ.length : 0}`);
    lines.push(`Недобросовестный поставщик: ${mainData?.НедобПост ? "да" : "нет"}`);
    lines.push(`Массовый руководитель: ${mainData?.МассРуковод ? "да" : "нет"}`);
    lines.push(`Массовый учредитель: ${mainData?.МассУчред ? "да" : "нет"}`);
  } else {
    const sanctionsCountries = Array.isArray(mainData?.СанкцииСтраны) ? mainData.СанкцииСтраны : [];
    lines.push(`Санкции: ${mainData?.Санкции ? "да" : "нет"}`);
    if (sanctionsCountries.length) lines.push(`Страны санкций: ${sanctionsCountries.join(", ")}`);
    lines.push(`ЕФРСБ: ${Array.isArray(mainData?.ЕФРСБ) ? mainData.ЕФРСБ.length : 0}`);
    lines.push(`Недобросовестный поставщик: ${mainData?.НедобПост ? "да" : "нет"}`);
    lines.push(`Массовый руководитель: ${mainData?.МассРуковод ? "да" : "нет"}`);
    lines.push(`Массовый учредитель: ${mainData?.МассУчред ? "да" : "нет"}`);
  }

  return lines.join("\n");
}

async function getContractsRecords(session: SessionState, config: BotConfig) {
  return getCachedPayload(session, "contracts", async () => {
    if (!config.checkoApiKey) return [];
    const combinations = [
      { law: 44, role: "supplier", labelLaw: "44-ФЗ", labelRole: "поставщик" },
      { law: 223, role: "supplier", labelLaw: "223-ФЗ", labelRole: "поставщик" },
      { law: 44, role: "customer", labelLaw: "44-ФЗ", labelRole: "заказчик" },
      { law: 223, role: "customer", labelLaw: "223-ФЗ", labelRole: "заказчик" },
    ];

    const records: any[] = [];
    for (const combo of combinations) {
      const payload = await checkoGetOptional(
        "contracts",
        { inn: session.inn, ogrn: session.ogrn, law: combo.law, role: combo.role, limit: 3, sort: "-date" },
        config.checkoApiKey,
      );
      const items = payload?.data?.Записи || payload?.data?.records || [];
      for (const item of items) {
        records.push({ ...item, __law: combo.labelLaw, __role: combo.labelRole });
      }
    }

    records.sort((a, b) => new Date(String(b.Дата || 0)).getTime() - new Date(String(a.Дата || 0)).getTime());
    return records;
  });
}

async function handleSection(chatId: string | number, text: string, config: BotConfig): Promise<string> {
  const session = sessions.get(String(chatId));
  if (!session) {
    return "Сначала отправьте ИНН, ОГРН, ОГРНИП, ОКПО или название контрагента.";
  }

  if (text === COMMANDS.back) {
    return session.summary;
  }

  await warmMainPayload(session, config);
  const mainPayload = session.cache.get("main");
  const mainData = getMainEntityData(mainPayload) || {};

  const requiresChecko = new Set<string>([
    COMPANY_BUTTONS.finances,
    COMPANY_BUTTONS.taxes,
    COMPANY_BUTTONS.contracts,
    COMPANY_BUTTONS.inspections,
    COMPANY_BUTTONS.legalCases,
    COMPANY_BUTTONS.enforcements,
    COMPANY_BUTTONS.licenses,
    COMPANY_BUTTONS.timeline,
    COMPANY_BUTTONS.risks,
    COMPANY_BUTTONS.extra,
    ENTREPRENEUR_BUTTONS.finances,
    ENTREPRENEUR_BUTTONS.taxes,
    ENTREPRENEUR_BUTTONS.contracts,
    ENTREPRENEUR_BUTTONS.inspections,
    ENTREPRENEUR_BUTTONS.legalCases,
    ENTREPRENEUR_BUTTONS.enforcements,
    ENTREPRENEUR_BUTTONS.licenses,
    ENTREPRENEUR_BUTTONS.currentFns,
    ENTREPRENEUR_BUTTONS.efrsb,
    ENTREPRENEUR_BUTTONS.risks,
    ENTREPRENEUR_BUTTONS.extra,
    PERSON_BUTTONS.basic,
    PERSON_BUTTONS.efrsb,
    PERSON_BUTTONS.sanctions,
    PERSON_BUTTONS.trademarks,
    PERSON_BUTTONS.links,
    PERSON_BUTTONS.risks,
  ]);

  if (requiresChecko.has(text) && !config.checkoApiKey) {
    return "Checko API key не задан. Добавьте его в панели, чтобы открыть этот раздел.";
  }

  if (session.entityType === "company") {
    if (text === COMPANY_BUTTONS.requisites) return formatRequisites(session);
    if (text === COMPANY_BUTTONS.finances) {
      const payload = await getCachedPayload(session, "finances", () => checkoGet("finances", { inn: session.inn, ogrn: session.ogrn }, config.checkoApiKey));
      return formatFinances(payload, session.entityType);
    }
    if (text === COMPANY_BUTTONS.taxes) return formatCompanyTaxes(mainData);
    if (text === COMPANY_BUTTONS.contracts) return formatContracts(await getContractsRecords(session, config));
    if (text === COMPANY_BUTTONS.inspections) {
      const payload = await getCachedPayload(session, "inspections", () => checkoGet("inspections", { inn: session.inn, ogrn: session.ogrn, limit: 10, sort: "-date" }, config.checkoApiKey));
      return formatInspections(payload);
    }
    if (text === COMPANY_BUTTONS.legalCases) {
      const payload = await getCachedPayload(session, "legal-cases", () => checkoGet("legal-cases", { inn: session.inn, ogrn: session.ogrn, limit: 10, sort: "-date", actual: true }, config.checkoApiKey));
      return formatLegalCases(payload);
    }
    if (text === COMPANY_BUTTONS.enforcements) {
      const payload = await getCachedPayload(session, "enforcements", () => checkoGet("enforcements", { inn: session.inn, ogrn: session.ogrn, kpp: session.kpp, limit: 10, sort: "-date" }, config.checkoApiKey));
      return formatEnforcements(payload, session.entityType);
    }
    if (text === COMPANY_BUTTONS.licenses) return formatLicenses(mainData);
    if (text === COMPANY_BUTTONS.timeline) {
      const payload = await getCachedPayload(session, "timeline", () => checkoGet("timeline", { inn: session.inn, ogrn: session.ogrn }, config.checkoApiKey));
      return formatTimeline(payload);
    }
    if (text === COMPANY_BUTTONS.risks) return formatRisks(session.entityType, mainData);
    if (text === COMPANY_BUTTONS.extra) return formatCompanyExtra(mainData);
  }

  if (session.entityType === "entrepreneur") {
    if (text === ENTREPRENEUR_BUTTONS.requisites) return formatRequisites(session);
    if (text === ENTREPRENEUR_BUTTONS.finances) return formatFinances(null, session.entityType);
    if (text === ENTREPRENEUR_BUTTONS.taxes) return formatEntrepreneurTaxes(mainData);
    if (text === ENTREPRENEUR_BUTTONS.contracts) return formatContracts(await getContractsRecords(session, config));
    if (text === ENTREPRENEUR_BUTTONS.inspections) {
      const payload = await getCachedPayload(session, "inspections", () => checkoGet("inspections", { inn: session.inn, ogrn: session.ogrn, limit: 10, sort: "-date" }, config.checkoApiKey));
      return formatInspections(payload);
    }
    if (text === ENTREPRENEUR_BUTTONS.legalCases) {
      const payload = await getCachedPayload(session, "legal-cases", () => checkoGet("legal-cases", { inn: session.inn, ogrn: session.ogrn, limit: 10, sort: "-date", actual: true }, config.checkoApiKey));
      return formatLegalCases(payload);
    }
    if (text === ENTREPRENEUR_BUTTONS.enforcements) return formatEnforcements(null, session.entityType);
    if (text === ENTREPRENEUR_BUTTONS.licenses) return formatLicenses(mainData);
    if (text === ENTREPRENEUR_BUTTONS.currentFns) return formatCurrentFns(mainData);
    if (text === ENTREPRENEUR_BUTTONS.efrsb) return formatEfrsb(mainData);
    if (text === ENTREPRENEUR_BUTTONS.risks) return formatRisks(session.entityType, mainData);
    if (text === ENTREPRENEUR_BUTTONS.extra) return formatEntrepreneurExtra(mainData);
  }

  if (session.entityType === "person") {
    if (text === PERSON_BUTTONS.basic) return buildSummary(session).replace("Выберите раздел в меню ниже.", "").trim();
    if (text === PERSON_BUTTONS.efrsb) return formatEfrsb(mainData);
    if (text === PERSON_BUTTONS.sanctions) {
      const countries = Array.isArray(mainData?.СанкцииСтраны) ? mainData.СанкцииСтраны : [];
      return [
        "🚫 Санкции",
        "",
        `В санкционных списках: ${mainData?.Санкции ? "да" : "нет"}`,
        `Страны: ${countries.length ? countries.join(", ") : "не найдены"}`,
      ].join("\n");
    }
    if (text === PERSON_BUTTONS.trademarks) return formatTrademarks(mainData);
    if (text === PERSON_BUTTONS.links) return formatLinkedBusinesses(mainData);
    if (text === PERSON_BUTTONS.risks) return formatRisks(session.entityType, mainData);
  }

  return "Не понял команду. Выберите раздел из меню или отправьте новый запрос.";
}

async function handleIncomingText(chatId: string | number, username: string, text: string, config: BotConfig) {
  if (text === COMMANDS.start) {
    return {
      text:
        "Бот проверки контрагентов готов.\n\n" +
        "Поддерживаемые запросы:\n" +
        "• ИНН, ОГРН, ОГРНИП, ОКПО\n" +
        "• название компании или ФИО ИП\n\n" +
        "После поиска бот покажет краткую карточку и меню разделов.\n" +
        "Для расширенных разделов нужен Checko API key.",
    };
  }

  if (text === COMMANDS.help) {
    return {
      text:
        "Как пользоваться:\n" +
        "1. Отправьте ИНН, ОГРН, ОГРНИП, ОКПО или название.\n" +
        "2. Получите карточку.\n" +
        "3. Откройте нужный раздел через reply-меню.\n\n" +
        "ЮЛ, ИП и физлица разделены по меню и форматтерам.",
    };
  }

  const activeSession = sessions.get(String(chatId));
  const companyButtons = new Set(Object.values(COMPANY_BUTTONS));
  const entrepreneurButtons = new Set(Object.values(ENTREPRENEUR_BUTTONS));
  const personButtons = new Set(Object.values(PERSON_BUTTONS));

  if (text === COMMANDS.back || companyButtons.has(text as any) || entrepreneurButtons.has(text as any) || personButtons.has(text as any)) {
    if (!activeSession) {
      return { text: "Сначала отправьте ИНН, ОГРН, ОГРНИП, ОКПО или название контрагента." };
    }
    return {
      text: await handleSection(chatId, text, config),
      reply_markup: getKeyboardByEntityType(activeSession.entityType),
    };
  }

  const session = await resolveEntitySession(text, config);
  if (session) {
    sessions.set(String(chatId), session);
    return {
      text: session.summary,
      reply_markup: getKeyboardByEntityType(session.entityType),
    };
  }

  if (!isIdentifierQuery(text)) {
    const address = await dadataCleanAddress(text, config.dadataApiKey, config.dadataSecretKey);
    if (address?.result) {
      return {
        text: [
          `📍 ${address.result}`,
          `Индекс: ${address.postal_code || "—"}`,
          `Координаты: ${address.geo_lat || "—"}, ${address.geo_lon || "—"}`,
        ].join("\n"),
      };
    }
  }

  return {
    text: "Ничего не найдено. Проверьте запрос: ИНН, ОГРН, ОГРНИП, ОКПО или название компании/ИП.",
  };
}

async function pollTelegram(config: BotConfig) {
  if (!isPolling) return;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.tgToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`,
    );
    const data = (await response.json()) as any;

    if (data?.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        const message = update.message;
        if (!message?.text) continue;

        const chatId = message.chat.id;
        const text = String(message.text).trim();
        const username = message.from?.username || message.from?.first_name || "Unknown";

        let result: { text: string; reply_markup?: any };
        try {
          result = await handleIncomingText(chatId, username, text, config);
        } catch (error: any) {
          result = { text: `Ошибка: ${error.message}` };
        }

        await storage.addLog({
          chatId: String(chatId),
          username,
          query: text,
          response: result.text,
        });

        await sendTelegramMessage(
          config.tgToken,
          chatId,
          result.text,
          result.reply_markup ? { reply_markup: result.reply_markup } : {},
        );
      }
    }
  } catch (error) {
    console.error("Telegram polling error:", error);
  }

  if (isPolling) {
    const freshConfig = await storage.getConfig();
    if (freshConfig?.isActive && freshConfig.tgToken) {
      pollingTimeout = setTimeout(() => pollTelegram(freshConfig), 1000);
    } else {
      isPolling = false;
    }
  }
}

async function restartBot() {
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }
  isPolling = false;
  lastUpdateId = 0;

  const config = await storage.getConfig();
  if (!config || !config.isActive || !config.tgToken) return;

  isPolling = true;
  void pollTelegram(config);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get(api.config.get.path, async (_req, res) => {
    const config = await storage.getConfig();
    res.json(config || null);
  });

  app.post(api.config.save.path, async (req, res) => {
    try {
      const input = api.config.save.input.parse(req.body);
      const config = await storage.saveConfig(input);
      await restartBot();
      res.status(200).json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: error.errors[0]?.message || "Validation error",
          field: error.errors[0]?.path.join("."),
        });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.config.toggle.path, async (req, res) => {
    try {
      const input = api.config.toggle.input.parse(req.body);
      const config = await storage.getConfig();
      if (!config) {
        return res.status(404).json({ message: "Config not found" });
      }
      const updated = await storage.updateConfig(config.id, { isActive: input.isActive });
      await restartBot();
      return res.status(200).json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: error.errors[0]?.message || "Validation error",
          field: error.errors[0]?.path.join("."),
        });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.logs.list.path, async (_req, res) => {
    const logs = await storage.getLogs();
    res.json(logs);
  });

  await restartBot();
  return httpServer;
}
