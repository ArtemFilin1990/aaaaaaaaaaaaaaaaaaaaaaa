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
    get_company_by_inn,
    extract_company_card,
    extract_finances,
    extract_courts,
    extract_purchases,
    extract_connections,
)
from keyboards import company_card_keyboard

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Кэш: inn -> сырой ответ API
_cache: dict[str, dict] = {}


def _is_valid_inn(inn: str) -> bool:
    """Базовая проверка ИНН: 10 цифр (юрлицо) или 12 цифр (ИП)."""
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


async def _fetch_and_cache(inn: str) -> Optional[dict]:
    """Возвращает сырые данные из кэша или запрашивает API."""
    if inn in _cache:
        logger.info("Cache hit for INN %s", inn)
        return _cache[inn]

    logger.info("Fetching data for INN %s from Checko API", inn)
    # Запрос выполняется синхронно в executor, чтобы не блокировать event loop
    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(None, get_company_by_inn, inn)

    if raw:
        _cache[inn] = raw

    return raw


# ── Handlers ──────────────────────────────────────────────────────────────────

async def cmd_start(message: Message) -> None:
    await message.answer(
        "Добро пожаловать!\n\nВведите <b>ИНН компании</b> для проверки.",
        parse_mode="HTML",
    )


async def handle_inn(message: Message) -> None:
    inn = (message.text or "").strip()

    if not _is_valid_inn(inn):
        await message.answer(
            "❌ Некорректный ИНН. Введите 10-значный ИНН юридического лица "
            "или 12-значный ИНН индивидуального предпринимателя."
        )
        return

    await message.answer("🔍 Ищу информацию, подождите...")

    raw = await _fetch_and_cache(inn)

    if not raw:
        await message.answer("⚠️ Компания не найдена.")
        return

    card = extract_company_card(raw)
    text = _format_card(card)
    keyboard = company_card_keyboard(inn)

    await message.answer(text, parse_mode="HTML", reply_markup=keyboard)


async def cb_finances(callback: CallbackQuery) -> None:
    inn = callback.data.split(":", 1)[1]
    raw = await _fetch_and_cache(inn)
    if not raw:
        await callback.answer("Данные недоступны", show_alert=True)
        return
    text = extract_finances(raw)
    await callback.message.answer(text, parse_mode="HTML")
    await callback.answer()


async def cb_courts(callback: CallbackQuery) -> None:
    inn = callback.data.split(":", 1)[1]
    raw = await _fetch_and_cache(inn)
    if not raw:
        await callback.answer("Данные недоступны", show_alert=True)
        return
    text = extract_courts(raw)
    await callback.message.answer(text, parse_mode="HTML")
    await callback.answer()


async def cb_purchases(callback: CallbackQuery) -> None:
    inn = callback.data.split(":", 1)[1]
    raw = await _fetch_and_cache(inn)
    if not raw:
        await callback.answer("Данные недоступны", show_alert=True)
        return
    text = extract_purchases(raw)
    await callback.message.answer(text, parse_mode="HTML")
    await callback.answer()


async def cb_connections(callback: CallbackQuery) -> None:
    inn = callback.data.split(":", 1)[1]
    raw = await _fetch_and_cache(inn)
    if not raw:
        await callback.answer("Данные недоступны", show_alert=True)
        return
    text = extract_connections(raw)
    await callback.message.answer(text, parse_mode="HTML")
    await callback.answer()


async def cb_full_report(callback: CallbackQuery) -> None:
    inn = callback.data.split(":", 1)[1]
    raw = await _fetch_and_cache(inn)
    if not raw:
        await callback.answer("Данные недоступны", show_alert=True)
        return

    json_text = json.dumps(raw, ensure_ascii=False, indent=2)

    # Telegram ограничивает сообщение 4096 символами
    chunk_size = 4000
    header = "📋 <b>Полный отчет (JSON)</b>\n\n"
    chunks = [json_text[i : i + chunk_size] for i in range(0, len(json_text), chunk_size)]

    for idx, chunk in enumerate(chunks):
        prefix = header if idx == 0 else ""
        await callback.message.answer(
            f"{prefix}<pre>{chunk}</pre>",
            parse_mode="HTML",
        )

    await callback.answer()


# ── Entry point ───────────────────────────────────────────────────────────────

async def main() -> None:
    token = os.getenv("TELEGRAM_TOKEN")
    if not token:
        raise RuntimeError("TELEGRAM_TOKEN не задан в .env")

    bot = Bot(token=token)
    dp = Dispatcher()

    # Регистрация хэндлеров
    dp.message.register(cmd_start, CommandStart())
    dp.message.register(handle_inn, F.text)

    dp.callback_query.register(cb_finances, F.data.startswith("finances:"))
    dp.callback_query.register(cb_courts, F.data.startswith("courts:"))
    dp.callback_query.register(cb_purchases, F.data.startswith("purchases:"))
    dp.callback_query.register(cb_connections, F.data.startswith("connections:"))
    dp.callback_query.register(cb_full_report, F.data.startswith("full_report:"))

    logger.info("Bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
