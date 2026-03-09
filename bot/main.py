import asyncio
import json
import logging
import os
import re
from typing import Optional

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, CallbackQuery
from dotenv import load_dotenv

from checko_api import (
    get_company,
    get_finances,
    get_legal_cases,
    get_contracts,
    extract_company_card,
    format_finances,
    format_legal_cases,
    format_contracts,
    format_connections,
)
from keyboards import company_card_keyboard

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Отдельный кэш на каждый эндпоинт: inn -> ответ API
_cache_company:   dict[str, dict] = {}
_cache_finances:  dict[str, dict] = {}
_cache_courts:    dict[str, dict] = {}
_cache_contracts: dict[str, dict] = {}


def _is_valid_inn(inn: str) -> bool:
    """ИНН юрлица — 10 цифр, ИП — 12 цифр."""
    return bool(re.fullmatch(r"\d{10}|\d{12}", inn.strip()))


def _format_card(card: dict) -> str:
    return (
        f"🏢 <b>Компания:</b> {card['name']}\n"
        f"ИНН: <code>{card['inn']}</code>\n"
        f"ОГРН: <code>{card['ogrn']}</code>\n"
        f"Статус: {card['status']}\n"
        f"Регистрация: {card['reg_date']}\n"
        f"Директор: {card['director']}\n"
        f"Регион: {card['region']}"
    )


async def _run(func, *args):
    """Запускает синхронную функцию в executor, не блокируя event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, func, *args)


async def _get_company(inn: str) -> Optional[dict]:
    if inn not in _cache_company:
        raw = await _run(get_company, inn)
        if raw:
            _cache_company[inn] = raw
    return _cache_company.get(inn)


async def _get_finances(inn: str) -> Optional[dict]:
    if inn not in _cache_finances:
        raw = await _run(get_finances, inn)
        if raw:
            _cache_finances[inn] = raw
    return _cache_finances.get(inn)


async def _get_courts(inn: str) -> Optional[dict]:
    if inn not in _cache_courts:
        raw = await _run(get_legal_cases, inn)
        if raw:
            _cache_courts[inn] = raw
    return _cache_courts.get(inn)


async def _get_contracts(inn: str) -> Optional[dict]:
    if inn not in _cache_contracts:
        raw = await _run(get_contracts, inn)
        if raw:
            _cache_contracts[inn] = raw
    return _cache_contracts.get(inn)


# ── Хэндлеры ──────────────────────────────────────────────────────────────────

async def cmd_start(message: Message) -> None:
    await message.answer(
        "Добро пожаловать!\n\nВведите <b>ИНН компании</b> для проверки.",
        parse_mode="HTML",
    )


async def handle_inn(message: Message) -> None:
    inn = (message.text or "").strip()

    if not _is_valid_inn(inn):
        await message.answer(
            "❌ Некорректный ИНН.\n"
            "Введите 10-значный ИНН юридического лица "
            "или 12-значный ИНН индивидуального предпринимателя."
        )
        return

    await message.answer("🔍 Запрашиваю данные, подождите...")

    raw = await _get_company(inn)
    if not raw:
        await message.answer("⚠️ Компания не найдена.")
        return

    card = extract_company_card(raw)
    await message.answer(
        _format_card(card),
        parse_mode="HTML",
        reply_markup=company_card_keyboard(inn),
    )


async def cb_finances(callback: CallbackQuery) -> None:
    inn = callback.data.split(":", 1)[1]
    await callback.answer()
    resp = await _get_finances(inn)
    if not resp:
        await callback.message.answer("⚠️ Финансовые данные недоступны.")
        return
    await callback.message.answer(format_finances(resp), parse_mode="HTML")


async def cb_courts(callback: CallbackQuery) -> None:
    inn = callback.data.split(":", 1)[1]
    await callback.answer()
    resp = await _get_courts(inn)
    if not resp:
        await callback.message.answer("⚠️ Данные об арбитражных делах недоступны.")
        return
    await callback.message.answer(
        format_legal_cases(resp),
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


async def cb_purchases(callback: CallbackQuery) -> None:
    inn = callback.data.split(":", 1)[1]
    await callback.answer()
    resp = await _get_contracts(inn)
    if not resp:
        await callback.message.answer("⚠️ Данные о госзакупках недоступны.")
        return
    await callback.message.answer(
        format_contracts(resp),
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


async def cb_connections(callback: CallbackQuery) -> None:
    """Связи берутся из кэша /v2/company — без дополнительного запроса."""
    inn = callback.data.split(":", 1)[1]
    await callback.answer()
    raw = await _get_company(inn)
    if not raw:
        await callback.message.answer("⚠️ Данные о связях недоступны.")
        return
    await callback.message.answer(format_connections(raw), parse_mode="HTML")


async def cb_full_report(callback: CallbackQuery) -> None:
    """Полный JSON ответа /v2/company, разбитый на части по 4000 символов."""
    inn = callback.data.split(":", 1)[1]
    await callback.answer()
    raw = await _get_company(inn)
    if not raw:
        await callback.message.answer("⚠️ Данные недоступны.")
        return

    json_text = json.dumps(raw, ensure_ascii=False, indent=2)
    chunks = [json_text[i: i + 4000] for i in range(0, len(json_text), 4000)]

    for idx, chunk in enumerate(chunks):
        header = "📋 <b>Полный отчёт (JSON)</b>\n\n" if idx == 0 else ""
        await callback.message.answer(
            f"{header}<pre>{chunk}</pre>",
            parse_mode="HTML",
        )


# ── Точка входа ───────────────────────────────────────────────────────────────

async def main() -> None:
    token = os.getenv("TELEGRAM_TOKEN")
    if not token:
        raise RuntimeError("TELEGRAM_TOKEN не задан в .env")

    bot = Bot(token=token)
    dp = Dispatcher()

    dp.message.register(cmd_start, CommandStart())
    dp.message.register(handle_inn, F.text)

    dp.callback_query.register(cb_finances,    F.data.startswith("finances:"))
    dp.callback_query.register(cb_courts,      F.data.startswith("courts:"))
    dp.callback_query.register(cb_purchases,   F.data.startswith("purchases:"))
    dp.callback_query.register(cb_connections, F.data.startswith("connections:"))
    dp.callback_query.register(cb_full_report, F.data.startswith("full_report:"))

    logger.info("Бот запущен. Polling...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
