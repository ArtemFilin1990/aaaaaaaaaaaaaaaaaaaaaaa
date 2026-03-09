import os
import requests
from typing import Optional

CHECKO_BASE_URL = "https://api.checko.ru/v2"


def get_company_by_inn(inn: str) -> Optional[dict]:
    """
    Запрашивает данные компании по ИНН через API Checko.ru.
    Возвращает словарь с данными или None при ошибке.
    """
    api_key = os.getenv("CHECKO_API_KEY")
    if not api_key:
        raise ValueError("CHECKO_API_KEY не задан в переменных окружения")

    try:
        response = requests.get(
            f"{CHECKO_BASE_URL}/company",
            params={"key": api_key, "inn": inn},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException:
        return None

    # API возвращает {"data": {...}} или {"error": "..."}
    if "data" not in data or not data["data"]:
        return None

    return data["data"]


def extract_company_card(raw: dict) -> dict:
    """
    Извлекает поля для карточки из сырого ответа API.
    """
    # Название
    name = raw.get("НазваниеПолное") or raw.get("НазваниеКраткое") or "—"

    # ИНН / ОГРН
    inn = raw.get("ИНН") or "—"
    ogrn = raw.get("ОГРН") or "—"

    # Статус
    status_raw = raw.get("Статус") or {}
    if isinstance(status_raw, dict):
        status = status_raw.get("Название") or "—"
    else:
        status = str(status_raw) or "—"

    # Дата регистрации
    reg_date = raw.get("ДатаРегистрации") or "—"

    # Директор
    director = "—"
    руководитель = raw.get("Руководитель")
    if isinstance(руководитель, dict):
        fio = руководитель.get("ФИО") or руководитель.get("Имя") or ""
        post = руководитель.get("Должность") or ""
        director = f"{fio} ({post})" if post else fio or "—"
    elif isinstance(руководитель, list) and руководитель:
        first = руководитель[0]
        fio = first.get("ФИО") or first.get("Имя") or ""
        post = first.get("Должность") or ""
        director = f"{fio} ({post})" if post else fio or "—"

    # Регион
    region = "—"
    адрес = raw.get("Адрес") or {}
    if isinstance(адрес, dict):
        region = адрес.get("Регион") or адрес.get("НазваниеРегиона") or "—"

    return {
        "name": name,
        "inn": inn,
        "ogrn": ogrn,
        "status": status,
        "reg_date": reg_date,
        "director": director,
        "region": region,
    }


def extract_finances(raw: dict) -> str:
    """Извлекает финансовые данные из ответа API."""
    финансы = raw.get("Финансы") or raw.get("БухОтчетность") or {}

    if not финансы:
        return "Финансовые данные недоступны."

    lines = ["📊 <b>Финансы</b>\n"]

    # Поддержка как словаря, так и списка отчётных периодов
    if isinstance(финансы, list):
        финансы = финансы[0] if финансы else {}

    выручка = финансы.get("Выручка") or финансы.get("Revenue")
    прибыль = финансы.get("ЧистаяПрибыль") or финансы.get("NetProfit")
    налоги = финансы.get("НалогиСборы") or финансы.get("Taxes")
    год = финансы.get("Год") or финансы.get("Year") or ""

    if год:
        lines.append(f"Период: {год}\n")
    if выручка is not None:
        lines.append(f"Выручка: {выручка:,} руб.")
    if прибыль is not None:
        lines.append(f"Чистая прибыль: {прибыль:,} руб.")
    if налоги is not None:
        lines.append(f"Налоги и сборы: {налоги:,} руб.")

    if len(lines) == 1:
        return "Финансовые данные недоступны."

    return "\n".join(lines)


def extract_courts(raw: dict) -> str:
    """Извлекает арбитражные дела."""
    суды = raw.get("Суды") or raw.get("Арбитраж") or []

    if not суды:
        return "⚖️ Арбитражных дел не найдено."

    lines = [f"⚖️ <b>Арбитражные дела</b> (всего: {len(суды)})\n"]
    for дело in суды[:5]:  # показываем первые 5
        номер = дело.get("НомерДела") or дело.get("Номер") or "—"
        статус = дело.get("Статус") or "—"
        сумма = дело.get("СуммаИска") or ""
        строка = f"• Дело {номер} — {статус}"
        if сумма:
            строка += f" ({сумма:,} руб.)"
        lines.append(строка)

    if len(суды) > 5:
        lines.append(f"\n...и ещё {len(суды) - 5} дел(а)")

    return "\n".join(lines)


def extract_purchases(raw: dict) -> str:
    """Извлекает госзакупки."""
    закупки = raw.get("Госзакупки") or raw.get("Контракты") or []

    if not закупки:
        return "💰 Госконтрактов не найдено."

    lines = [f"💰 <b>Госзакупки</b> (всего: {len(закупки)})\n"]
    for контракт in закупки[:5]:
        номер = контракт.get("НомерКонтракта") or контракт.get("Номер") or "—"
        предмет = контракт.get("Предмет") or "—"
        сумма = контракт.get("Сумма") or ""
        строка = f"• {номер}: {предмет[:60]}..."
        if сумма:
            строка += f" — {сумма:,} руб."
        lines.append(строка)

    if len(закупки) > 5:
        lines.append(f"\n...и ещё {len(закупки) - 5} контракт(ов)")

    return "\n".join(lines)


def extract_connections(raw: dict) -> str:
    """Извлекает учредителей и связанные компании."""
    lines = ["🔗 <b>Связи</b>\n"]

    учредители = raw.get("Учредители") or []
    if учредители:
        lines.append("<b>Учредители:</b>")
        for у in учредители[:5]:
            имя = у.get("НазваниеПолное") or у.get("ФИО") or у.get("Имя") or "—"
            доля = у.get("ДоляПроцент") or у.get("Доля") or ""
            строка = f"• {имя}"
            if доля:
                строка += f" ({доля}%)"
            lines.append(строка)

    связанные = raw.get("СвязанныеКомпании") or raw.get("Аффилированные") or []
    if связанные:
        lines.append("\n<b>Связанные компании:</b>")
        for с in связанные[:5]:
            название = с.get("НазваниеПолное") or с.get("Название") or "—"
            инн = с.get("ИНН") or ""
            строка = f"• {название}"
            if инн:
                строка += f" (ИНН: {инн})"
            lines.append(строка)

    if len(lines) == 1:
        return "🔗 Данные о связях недоступны."

    return "\n".join(lines)
