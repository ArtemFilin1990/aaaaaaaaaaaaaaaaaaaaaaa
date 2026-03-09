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

    Ответ API: {"data": {
      ОГРН, ИНН, КПП, ОКПО, ДатаРег, НаимСокр, НаимПолн,
      Статус: {Код, Наим},            ← объект, не строка
      Ликвид: {Дата, Наим},
      Регион: {Код, Наим},            ← объект, не РегионКод
      ЮрАдрес: {НасПункт, АдресРФ},  ← объект, не строка
      ОКВЭД: {Код, Наим},            ← объект, не строка
      Руковод: [{ФИО, ИНН, НаимДолжн, МассРуковод, ...}],  ← Руковод, не Руководители
      Учред: {                        ← объект с подгруппами
        ФЛ:     [{ФИО, ИНН, Доля:{Процент}}],
        РосОрг: [{НаимПолн, НаимСокр, ИНН, Доля:{Процент}}],
        ИнОрг:  [{НаимПолн, Страна, Доля:{Процент}}],
      },
      Налоги: {ОсобРежим, СведУпл, СумУпл},
      РМСП: {Кат, ДатаВкл},
      НедобПост, МассРуковод, МассУчред, Санкции, ...
    }, "meta": {...}}

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

    Статус   → Статус.Наим       (объект, не строка)
    Регион   → Регион.Наим       (объект, не РегионКод)
    ЮрАдрес  → ЮрАдрес.АдресРФ  (объект, не строка)
    ОКВЭД    → ОКВЭД.Наим        (объект, не строка)
    Директор → Руковод[0].ФИО + .НаимДолжн  (поле Руковод, не Руководители)
    """
    name = raw.get("НаимПолн") or raw.get("НаимСокр") or "—"
    inn = raw.get("ИНН") or "—"
    ogrn = raw.get("ОГРН") or "—"
    reg_date = raw.get("ДатаРег") or "—"

    # Статус — объект {Код, Наим, ОгрДоступ, ДатаЗаписи}
    статус_obj = raw.get("Статус") or {}
    status = статус_obj.get("Наим") or "—"

    # Регион — объект {Код, Наим}
    регион_obj = raw.get("Регион") or {}
    region = регион_obj.get("Наим") or регион_obj.get("Код") or "—"

    # Руководитель — поле Руковод (список), должность — НаимДолжн
    director = "—"
    руковод = raw.get("Руковод")
    if isinstance(руковод, list) and руковод:
        first = руковод[0]
        fio = first.get("ФИО") or ""
        post = first.get("НаимДолжн") or ""
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


def _fmt_founder_entry(у: dict) -> str:
    """Строка для одного учредителя любого типа (ФЛ / РосОрг / ИнОрг)."""
    name = (
        у.get("НаимПолн") or у.get("НаимСокр")
        or у.get("ФИО") or у.get("Наим") or "—"
    )
    inn = у.get("ИНН") or ""
    доля_obj = у.get("Доля") or {}
    процент = доля_obj.get("Процент") if isinstance(доля_obj, dict) else None
    entry = f"• {name}"
    if inn:
        entry += f" (ИНН: {inn})"
    if процент is not None:
        entry += f" [{процент:.1f}%]"
    return entry


def format_connections(raw: dict) -> str:
    """
    Форматирует связи из объекта data /v2/company.

    Руковод: [{ФИО, НаимДолжн, МассРуковод, ДисквЛицо}]  ← поле Руковод
    Учред:   объект с подгруппами:
      ФЛ:     [{ФИО, ИНН, Доля:{Процент}}]
      РосОрг: [{НаимПолн, НаимСокр, ИНН, Доля:{Процент}}]
      ИнОрг:  [{НаимПолн, Страна, Доля:{Процент}}]
    """
    lines = ["🔗 <b>Связи компании</b>"]

    # Руководители
    руковод = raw.get("Руковод") or []
    if isinstance(руковод, list) and руковод:
        lines.append("\n<b>Руководители:</b>")
        for р in руковод[:5]:
            fio = р.get("ФИО") or "—"
            post = р.get("НаимДолжн") or ""
            flags = []
            if р.get("МассРуковод"):
                flags.append("массовый")
            if р.get("ДисквЛицо"):
                flags.append("дисквалификация")
            entry = f"• {fio}"
            if post:
                entry += f" ({post})"
            if flags:
                entry += f" ⚠️ {', '.join(flags)}"
            lines.append(entry)

    # Учредители — объект {ФЛ, РосОрг, ИнОрг, ПИФ, РФ}
    учред = raw.get("Учред") or {}
    if isinstance(учред, dict):
        фл = учред.get("ФЛ") or []
        рос = учред.get("РосОрг") or []
        ин = учред.get("ИнОрг") or []

        все = list(фл) + list(рос) + list(ин)
        if все:
            lines.append("\n<b>Учредители:</b>")
            for у in все[:7]:
                lines.append(_fmt_founder_entry(у))

    # Связанные компании (где данная org является управляющей / учредила)
    упр = raw.get("СвязУпрОрг") or []
    if упр:
        lines.append(f"\n<b>Под управлением ({len(упр)}):</b>")
        for с in упр[:3]:
            name = с.get("НаимСокр") or с.get("НаимПолн") or "—"
            lines.append(f"• {name}")

    учр_связи = raw.get("СвязУчред") or []
    if учр_связи:
        lines.append(f"\n<b>Учреждённые компании ({len(учр_связи)}):</b>")
        for с in учр_связи[:3]:
            name = с.get("НаимСокр") or с.get("НаимПолн") or "—"
            lines.append(f"• {name}")

    if len(lines) == 1:
        return "🔗 Данные о руководителях и учредителях недоступны."

    return "\n".join(lines)
