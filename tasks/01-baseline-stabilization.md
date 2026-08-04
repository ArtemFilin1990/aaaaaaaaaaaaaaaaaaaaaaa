# Этап 1. Стабилизация каркаса и CI

## Репозиторий

`https://github.com/ArtemFilin1990/aaaaaaaaaaaaaaaaaaaaaaa`

## Ветка

`codex/project-baseline-fix`

## Цель

Получить воспроизводимый технический каркас сайта, который проходит обязательные проверки и готов к следующему этапу — модели каталога.

## Перед началом

1. Прочитай `AGENTS.md`.
2. Прочитай `docs/WORK_MODE.md`.
3. Прочитай `README.md` и все текущие документы в `docs`.
4. Проверь текущую ветку, HEAD, remotes и `git status`.
5. Получи актуальное состояние удалённого `main`.
6. Не используй ранее созданные локальные коммиты, если они не являются потомками актуального `main`; сначала сравни содержимое и перенеси только отсутствующие изменения без переписывания истории.

## Аудит

Проверь:

- Next.js App Router;
- TypeScript strict;
- Tailwind CSS;
- Prisma/PostgreSQL;
- Docker Compose;
- `package.json` и `pnpm-lock.yaml`;
- GitHub Actions;
- Vitest;
- Playwright;
- все маршруты;
- `.gitignore` и `.env.example`;
- отсутствие секретов;
- соответствие `AGENTS.md`.

Создай или обнови `docs/baseline-validation.md`.

## Исправления

Обязательно:

- актуальный `pnpm-lock.yaml`;
- `pnpm install --frozen-lockfile` в CI;
- Prisma format и Prisma validate;
- PostgreSQL service в GitHub Actions;
- применение миграций на тестовой базе;
- unit-тесты;
- Playwright smoke-тест;
- production build;
- smoke-проверка `/api/health`;
- разделение Vitest и Playwright-файлов;
- корректный запуск production/standalone-сборки;
- mock-режим интеграций Bitrix24 и 1С;
- отсутствие реальных внешних запросов.

Не занимайся сложным дизайном и не создавай полноценную модель каталога на этом этапе.

## Проверки

Фактически выполни доступные команды:

```bash
pnpm install --frozen-lockfile
pnpm exec prisma format
pnpm exec prisma validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Когда среда позволяет:

```bash
pnpm test:e2e
```

Запусти production-сборку и проверь HTTP 200 для основных страниц и `/api/health`.

Если Chromium, Docker Engine, PostgreSQL или сеть недоступны, явно зафиксируй это в документе и итоговом отчёте. Не помечай соответствующую проверку успешной.

## Git

- Создай логические атомарные коммиты.
- Force push запрещён.
- `main` напрямую не изменять.
- Опубликуй ветку и создай Pull Request:

`chore: validate and stabilize Everest project baseline`

Не объединяй Pull Request автоматически.

Если публикация невозможна, выполни экспорт по `docs/WORK_MODE.md` и приложи patch-файлы, архив и `EXPORT_MANIFEST.md`.

## Итог

Укажи:

- базовый SHA актуального `main`;
- ветку;
- SHA коммитов;
- Pull Request либо экспортные файлы;
- результаты каждой проверки;
- перечень исправлений;
- ограничения;
- готовность к этапу модели каталога.
