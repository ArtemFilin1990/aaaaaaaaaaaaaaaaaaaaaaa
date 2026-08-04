# ЭВЕРЕСТ — B2B-каталог подшипников

Новый проект полностью заменяет прежний Python-инструмент в ветке `main`. Старое состояние сохранено в ветке `archive/legacy-before-everest-store-2026-08-04` и в истории Git.

## Назначение

Сайт для поиска подшипников по ГОСТ, ISO, размерам и техническим параметрам, формирования корзины-заявки и последующей серверной передачи заявки в Bitrix24 без использования лидов.

Публичные цены, онлайн-оплата и неподтверждённое наличие не используются.

## Стек

- Next.js App Router
- TypeScript strict
- Tailwind CSS
- Prisma + PostgreSQL
- Zod
- Vitest
- Playwright
- Docker

## Разработка в режиме «Работа»

Основной канал разработки — мобильный режим «Работа».

Перед любой задачей агент обязан прочитать:

- `AGENTS.md`;
- `docs/WORK_MODE.md`;
- соответствующий файл из `tasks`.

Задачи выполняются по одной в отдельных ветках `codex/*`. Локальные коммиты нельзя считать опубликованными без удалённой ветки или Pull Request.

Текущие этапы:

- `tasks/01-baseline-stabilization.md`;
- `tasks/02-catalog-data-model.md`.

## Локальный запуск

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm db:seed
pnpm dev
```

Откройте `http://localhost:3000`.

## База данных

Каноническая модель разделяет товар, обозначения ГОСТ/ISO, поисковые алиасы, стандартные соответствия, инженерные аналоги, документы и партии импорта.

Seed создаёт 33 демонстрационные позиции. Они помечены как `DEMO`, не содержат публичных цен и не подтверждают наличие или срок.

```bash
pnpm db:seed
pnpm db:studio
pnpm db:reset
```

`db:reset` удаляет локальные данные и не должен выполняться на рабочей базе.

Документация:

- `docs/data-dictionary.md`;
- `docs/catalog-architecture.md`;
- `docs/local-database.md`.

## Проверки

```bash
pnpm prisma:format
pnpm prisma:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Основные маршруты

`/`, `/catalog`, `/search`, `/product/[slug]`, `/selection`, `/brands`, `/knowledge`, `/about`, `/delivery`, `/contacts`, `/request`.

## Безопасность

Реальные токены, вебхуки, `.env` и персональные данные запрещено коммитить. Интеграция Bitrix24 по умолчанию работает только в `mock`-режиме.
