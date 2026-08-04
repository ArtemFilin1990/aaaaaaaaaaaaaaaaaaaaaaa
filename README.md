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

## Локальный запуск

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm dev
```

Откройте `http://localhost:3000`.

## Проверки

```bash
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
