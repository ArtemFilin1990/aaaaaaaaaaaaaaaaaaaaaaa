from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton


def company_card_keyboard(inn: str) -> InlineKeyboardMarkup:
    """
    Inline-клавиатура под карточкой компании.
    Все callback_data содержат ИНН, чтобы отдельно не запрашивать его.
    """
    buttons = [
        [
            InlineKeyboardButton(
                text="📊 Финансы",
                callback_data=f"finances:{inn}",
            ),
            InlineKeyboardButton(
                text="⚖️ Суды",
                callback_data=f"courts:{inn}",
            ),
        ],
        [
            InlineKeyboardButton(
                text="💰 Госзакупки",
                callback_data=f"purchases:{inn}",
            ),
            InlineKeyboardButton(
                text="🔗 Связи",
                callback_data=f"connections:{inn}",
            ),
        ],
        [
            InlineKeyboardButton(
                text="📋 Полный отчет",
                callback_data=f"full_report:{inn}",
            ),
        ],
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)
