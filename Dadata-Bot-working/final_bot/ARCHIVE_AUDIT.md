# Аудит архивов

## Что было в исходниках

### 1. `Dadata-Bot.zip`
Базовый Replit-проект:
- Express + polling Telegram bot
- web-dashboard
- хранение конфигурации и логов
- Dadata интеграция

### 2. `Dadata-Bot-checko-patch.zip`
Промежуточный патч:
- поле `checkoApiKey`
- начальные заготовки меню и секций Checko

### 3. `Чеко.zip`
Документация Checko API и справочники:
- PDF по `/entrepreneur`, `/person`, `/finances`, `/contracts`, `/legal-cases`, `/enforcements`, `/inspections`, `/timeline`, `/bankruptcy-messages`, `/bank`
- xlsx и sql-справочники
- doc/docx c описаниями форматов

### 4. `Бот1000.zip`
Сборный архив:
- дубликаты `Dadata-Bot.zip` и `Чеко.zip`
- те же PDF/SQL/XLSX
- скриншоты Telegram
- `Коммерческое предложение (API).pdf`
- `format.rar`

## Что найдено при рекурсивной распаковке
- дубли проекта и документации;
- вложенные zip со справочниками;
- `format.rar` с XSD и DOC-файлами описания форматов;
- два Excel-справочника статусов `СЮЛСТ.xlsx` и `СИПСТ.xlsx`;
- SQL-справочники `okved_2`, `okpd`, `okpd_2`, `okopf`, `okfs`, `account_codes`.

## Что использовано в рабочем боте
- проект из `Dadata-Bot.zip` как базовая кодовая основа;
- идеи из `Dadata-Bot-checko-patch.zip` как черновой ориентир;
- документация Checko из `Чеко.zip` и дублей из `Бот1000.zip`;
- Telegram-скрины как ориентир по reply-меню.

## Что не понадобилось в рантайме
- SQL/XLSX-справочники;
- doc/docx описания XSD;
- `format.rar`.

## Особое замечание
`format.rar` был распознан и просмотрен по списку содержимого. Внутри находятся XSD и DOC-описания форматов `VO_OTKRDAN1..7`. Автоматическая распаковка не выполнена в контейнере только из-за отсутствия rar-экстрактора.
