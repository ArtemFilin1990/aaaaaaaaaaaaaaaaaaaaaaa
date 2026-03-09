"""
Клиент Checko.ru API v2.4
Документация: https://checko.ru/integration/api

Эндпоинты:
  /v2/company      — ЕГРЮЛ (организации)
  /v2/finances     — Финансовая отчётность
  /v2/legal-cases  — Арбитражные дела
  /v2/contracts    — Контракты по госзакупкам
"""

import os
import requests
from typing import Optional

BASE_URL = "https://api.checko.ru/v2"

# Коды строк бухгалтерской отчётности (БФО ФНС)
_FINANCE_ROWS = {
    "2110": "Выручка",
    "2120": "Себестоимость",
    "2200": "Прибыль от продаж",
    "2300": "Прибыль до налогообложения",
    "2400": "Чистая прибыль",
}


def _request(endpoint: str, params: dict) -> Optional[dict]:
    """Базовый GET-запрос к API. Возвращает dict или None при ошибке."""
    api_key = os.getenv("CHECKO_API_KEY")
    if not api_key:
        raise ValueError("CHECKO_API_KEY не задан в переменных окружения")

    params = {**params, "key": api_key}
    try:
        resp = requests.get(
            f"{BASE_URL}/{endpoint}",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException:
        return None

    meta = data.get("meta") or {}
    if meta.get("status") != "ok":
        return None

    return data


# ── Запросы к API ──────────────────────────────────────────────────────────────

def get_company(inn: str) -> Optional[dict]:
    """
    GET /v2/company — данные ЕГРЮЛ.

    Ответ API: {"data": {ОГРН, ИНН, КПП, НаимСокр, НаимПолн, ДатаРег,
                          Статус, ДатаЛикв, РегионКод, ЮрАдрес, ОКВЭД,
                          Руководители: [...], Учредители: [...]},
                "meta": {...}}

    Возвращает объект data или None.
    """
    resp = _request("company", {"inn": inn})
    if resp is None:
        return None
    return resp.get("data") or None


def get_finances(inn: str) -> Optional[dict]:
    """
    GET /v2/finances — финансовая отчётность.

    Ответ API: {"company": {...},
                "data": {"2023": {"2110": int, "2400": int, ...}, ...},
                "meta": {...}}

    Возвращает полный ответ (нужен data + company).
    """
    return _request("finances", {"inn": inn})


def get_legal_cases(inn: str) -> Optional[dict]:
    """
    GET /v2/legal-cases — арбитражные дела.

    Ответ API: {"company": {...},
                "data": {"ЗапВсего": int, "ОбщСуммИск": float,
                         "Записи": [{Номер, UUID, СтрКАД, Дата, Суд,
                                     Ист: [...], Ответ: [...], СуммИск}]},
                "meta": {...}}
    """
    return _request("legal-cases", {"inn": inn, "sort": "-date"})


def get_contracts(inn: str) -> Optional[dict]:
    """
    GET /v2/contracts — контракты по 44-ФЗ.

    Ответ API: {"company": {...},
                "data": {"ЗапВсего": int, "СтрВсего": int,
                         "Записи": [{РегНомер, СтрЕИС, РегионКод, Дата,
                                     ДатаИсп, Цена, Заказ: {...},
                                     Постав: [...], Объекты: [...]}]},
                "meta": {...}}

    Параметры law=44, role=supplier, sort=-date.
    """
    return _request("contracts", {"inn": inn, "law": "44", "sort": "-date"})


# ── Форматирование ─────────────────────────────────────────────────────────────

def extract_company_card(raw: dict) -> dict:
    """
    Извлекает поля карточки из объекта data /v2/company.

    Поля ответа: НаимПолн / НаимСокр, ИНН, ОГРН, Статус,
                 ДатаРег, РегионКод, ЮрАдрес,
                 Руководители[0].ФИО + .Должн
    """
    name = raw.get("НаимПолн") or raw.get("НаимСокр") or "—"
    inn = raw.get("ИНН") or "—"
    ogrn = raw.get("ОГРН") or "—"
    status = raw.get("Статус") or "—"
    reg_date = raw.get("ДатаРег") or "—"
    region = raw.get("РегионКод") or "—"

    director = "—"
    руководители = raw.get("Руководители")
    if isinstance(руководители, list) and руководители:
        first = руководители[0]
        fio = first.get("ФИО") or ""
        post = first.get("Должн") or first.get("Должность") or ""
        director = f"{fio} ({post})" if post else fio or "—"

    return {
        "name": name,
        "inn": inn,
        "ogrn": ogrn,
        "status": status,
        "reg_date": reg_date,
        "director": director,
        "region": region,
    }


def format_finances(resp: dict) -> str:
    """
    Форматирует ответ /v2/finances.

    data: {"год": {"2110": int, "2400": int, ...}}
    Строки: 2110=Выручка, 2200=Прибыль от продаж, 2400=Чистая прибыль.
    Суммы указаны в тысячах рублей.
    """
    data = resp.get("data") or {}
    years = sorted([y for y in data if y.isdigit()], reverse=True)

    if not years:
        return "📊 Финансовые данные недоступны."

    lines = ["📊 <b>Финансовая отчётность</b> (тыс. руб.)"]

    for year in years[:3]:
        year_data = data[year]
        if not isinstance(year_data, dict):
            continue
        lines.append(f"\n<b>{year} год:</b>")
        found = False
        for code, label in _FINANCE_ROWS.items():
            val = year_data.get(code)
            if val is not None:
                lines.append(f"  {label} (стр.{code}): {val:,}")
                found = True
        if not found:
            lines.append("  Нет данных")

    return "\n".join(lines)


def format_legal_cases(resp: dict) -> str:
    """
    Форматирует ответ /v2/legal-cases.

    data.Записи: [{Номер, Дата, Суд, Ист: [...], Ответ: [...],
                   СуммИск, СтрКАД}]
    """
    data = resp.get("data") or {}
    records = data.get("Записи") or []
    total = data.get("ЗапВсего") or 0
    total_sum = data.get("ОбщСуммИск")

    if not records:
        return "⚖️ Арбитражных дел не найдено."

    lines = [f"⚖️ <b>Арбитражные дела</b> (всего: {total})"]
    if total_sum:
        lines.append(f"Общая сумма исков: {total_sum:,.0f} руб.\n")

    for case in records[:5]:
        number = case.get("Номер") or "—"
        date = case.get("Дата") or "—"
        court = case.get("Суд") or "—"
        sum_isk = case.get("СуммИск")
        url = case.get("СтрКАД") or ""

        line = f"• <b>{number}</b> от {date}\n  {court}"
        if sum_isk:
            line += f"\n  Сумма иска: {sum_isk:,.0f} руб."
        if url:
            line += f'\n  <a href="{url}">Картотека арбитражных дел</a>'
        lines.append(line)

    if total > 5:
        lines.append(f"\n...и ещё {total - 5} дел(а)")

    return "\n".join(lines)


def format_contracts(resp: dict) -> str:
    """
    Форматирует ответ /v2/contracts.

    data.Записи: [{РегНомер, СтрЕИС, Дата, Цена,
                   Заказ: {НаимСокр}, Объекты: [{Наим}]}]
    """
    data = resp.get("data") or {}
    records = data.get("Записи") or []
    total = data.get("ЗапВсего") or 0

    if not records:
        return "💰 Госконтрактов по 44-ФЗ не найдено."

    lines = [f"💰 <b>Госзакупки 44-ФЗ</b> (всего: {total})\n"]

    for contract in records[:5]:
        number = contract.get("РегНомер") or "—"
        date = contract.get("Дата") or "—"
        price = contract.get("Цена")
        url = contract.get("СтрЕИС") or ""
        objects = contract.get("Объекты") or []
        subject = objects[0].get("Наим") if objects else ""
        customer = (contract.get("Заказ") or {}).get("НаимСокр") or ""

        line = f"• {number} от {date}"
        if customer:
            line += f"\n  Заказчик: {customer}"
        if subject:
            short = subject[:70] + "…" if len(subject) > 70 else subject
            line += f"\n  Предмет: {short}"
        if price is not None:
            line += f"\n  Цена: {price:,} руб."
        if url:
            line += f'\n  <a href="{url}">ЕИС закупки</a>'
        lines.append(line)

    if total > 5:
        lines.append(f"\n...и ещё {total - 5} контракт(ов)")

    return "\n".join(lines)


def format_connections(raw: dict) -> str:
    """
    Форматирует связи из объекта data /v2/company.

    Поля: Руководители[{ФИО, Должн}], Учредители[{НаимПолн/ФИО, ИНН, ДоляПроцент}]
    """
    lines = ["🔗 <b>Связи компании</b>"]

    руководители = raw.get("Руководители") or []
    if isinstance(руководители, list) and руководители:
        lines.append("\n<b>Руководители:</b>")
        for р in руководители[:5]:
            fio = р.get("ФИО") or "—"
            post = р.get("Должн") or р.get("Должность") or ""
            entry = f"• {fio}"
            if post:
                entry += f" ({post})"
            lines.append(entry)

    учредители = raw.get("Учредители") or []
    if isinstance(учредители, list) and учредители:
        lines.append("\n<b>Учредители:</b>")
        for у in учредители[:5]:
            name = у.get("НаимПолн") or у.get("НаимСокр") or у.get("ФИО") or "—"
            inn = у.get("ИНН") or ""
            доля = у.get("ДоляПроцент") or у.get("Доля") or ""
            entry = f"• {name}"
            if inn:
                entry += f" (ИНН: {inn})"
            if доля:
                entry += f" [{доля}%]"
            lines.append(entry)

    if len(lines) == 1:
        return "🔗 Данные о руководителях и учредителях недоступны."

    return "\n".join(lines)
