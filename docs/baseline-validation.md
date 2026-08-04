# Проверка базового технического контура

## Область проверки

Дата проверки: 2026-08-04.

Этап стабилизирует исходный каркас B2B-каталога «ЭВЕРЕСТ» без подключения рабочих данных, Bitrix24 и 1С.

BASE_SHA актуального `origin/main` на момент начала работ: `9bebd6f0ada7e6cc208ea9b969473a66024c4020`.

Рабочая ветка: `codex/project-baseline-fix`.

## Среда

- Node.js: `v20.20.2`.
- Corepack: `0.34.6`.
- pnpm: `10.14.0`.
- PostgreSQL service из Docker Compose: `db` (`postgres:17-alpine`).
- PostgreSQL version: не определена локально, потому что в среде отсутствует Docker CLI/Engine и локальные PostgreSQL binaries.
- Способ запуска базы по конфигурации проекта: `docker compose up -d db`.

## Обнаруженные и исправленные проблемы

1. В checkout отсутствовал `pnpm-lock.yaml`; lockfile создан штатной командой `pnpm install --lockfile-only` без ручного редактирования.
2. Dockerfile устанавливал зависимости через `pnpm install --no-frozen-lockfile`; после появления lockfile переведён на `pnpm install --frozen-lockfile`.
3. CI содержал bootstrap-job, генерирующий lockfile внутри GitHub Actions; после добавления lockfile workflow переведён на прямую воспроизводимую установку с pnpm cache.
4. `prisma format` изменил только выравнивание полей `Product` в `prisma/schema.prisma`.

## Фактические результаты команд

| Команда | Exit code | Статус | Результат |
|---|---:|---|---|
| `pwd` | 0 | PASS | `/workspace/aaaaaaaaaaaaaaaaaaaaaaa` |
| `git status --short` | 0 | PASS | исходно чистое дерево на ветке `work` |
| `git branch --show-current` | 0 | PASS | `work` |
| `git rev-parse HEAD` | 0 | PASS | `9bebd6f0ada7e6cc208ea9b969473a66024c4020` |
| `git remote -v` | 0 | PASS | исходно remote отсутствовал; `origin` добавлен как `https://github.com/ArtemFilin1990/aaaaaaaaaaaaaaaaaaaaaaa.git` |
| `git fetch origin --prune` | 0 | PASS | удалённые ветки получены |
| `git rev-parse origin/main` | 0 | PASS | `9bebd6f0ada7e6cc208ea9b969473a66024c4020` |
| `gh auth status` | 1 | BLOCKED BY ENVIRONMENT | GitHub CLI не аутентифицирован |
| `node --version` | 0 | PASS | `v20.20.2` |
| `corepack --version` | 0 | PASS | `0.34.6` |
| `docker version` | 127 | BLOCKED BY ENVIRONMENT | `docker: command not found` |
| `docker compose version` | 127 | BLOCKED BY ENVIRONMENT | `docker: command not found` |
| `corepack enable && corepack prepare pnpm@10.14.0 --activate && pnpm --version` | 0 | PASS | pnpm `10.14.0` активирован |
| `find . -maxdepth 2 \( -name package-lock.json -o -name yarn.lock -o -name npm-shrinkwrap.json \) -print` | 0 | PASS | конфликтующие lock-файлы не найдены |
| `pnpm install --lockfile-only` | 0 | PASS | создан `pnpm-lock.yaml` |
| `pnpm install --frozen-lockfile` | 0 | PASS | воспроизводимая установка завершена успешно |
| `docker compose up -d db` | 127 | BLOCKED BY ENVIRONMENT | Docker CLI отсутствует |
| `docker compose ps` | 127 | BLOCKED BY ENVIRONMENT | Docker CLI отсутствует |
| `docker compose logs --tail=100 db` | 127 | BLOCKED BY ENVIRONMENT | Docker CLI отсутствует |
| `pnpm exec prisma format` | 0 | PASS | schema отформатирована |
| `pnpm exec prisma validate` | 0 | PASS | schema валидна |
| `pnpm prisma:generate` | 0 | PASS | Prisma Client сгенерирован |
| `pnpm exec prisma migrate deploy` | 1 | BLOCKED BY ENVIRONMENT | тестовая PostgreSQL недоступна на `localhost:5432` |
| `pnpm lint` | 0 | PASS | ESLint завершился без ошибок |
| `pnpm typecheck` | 0 | PASS | TypeScript strict проверка завершилась без ошибок |
| `pnpm test` | 0 | PASS | Vitest: 1 файл, 6 тестов пройдены |
| `pnpm build` | 0 | PASS | production build Next.js завершён успешно |
| `pnpm exec playwright install --with-deps chromium` | 1 | BLOCKED BY ENVIRONMENT | системные зависимости установлены, но загрузка Chromium с `cdn.playwright.dev` заблокирована proxy 403 `Domain forbidden` |
| `pnpm test:e2e` | NOT RUN | NOT RUN | не запускался, потому что Chromium не был установлен |

## Production smoke

Команда запуска: `HOSTNAME=127.0.0.1 PORT=3000 pnpm start` после `pnpm build`.

| URL | HTTP-код | Redirects | Статус |
|---|---:|---:|---|
| `/` | 200 | 0 | PASS |
| `/catalog` | 200 | 0 | PASS |
| `/search` | 200 | 0 | PASS |
| `/request` | 200 | 0 | PASS |
| `/api/health` | 200 | 0 | PASS |

Runtime exception в production smoke не обнаружен по логам запуска. Бесконечных redirect не обнаружено. Внешние CRM-запросы не выполнялись.

## Prisma и PostgreSQL

- `prisma format`, `prisma validate` и `prisma generate` выполнены успешно.
- Существующая миграция `20260804170000_init` не применена локально из-за отсутствия Docker CLI/Engine и недоступности PostgreSQL на `localhost:5432`.
- Seed не запускался: в `package.json` нет seed script и отдельная seed-конфигурация не обнаружена.

## CI

Workflow обновлён минимально после появления реального `pnpm-lock.yaml`:

- используется Node.js 22;
- активируется pnpm `10.14.0`;
- включён `cache: pnpm` в `actions/setup-node`;
- выполняется `pnpm install --frozen-lockfile`;
- PostgreSQL service с health-check сохранён;
- тестовый `DATABASE_URL` сохранён;
- Prisma generate/format/validate/migrate, lint, typecheck, Vitest, production build, Playwright и standalone smoke сохранены как обязательные шаги;
- production-секреты и Bitrix24 write mode не используются.

## Безопасность

- `.env` создан только локально для проверок и не отслеживается Git.
- Production webhook, токены, API keys, private keys и клиентские данные не добавлялись.
- `B24_MODE=mock` и `B24_WRITE_ENABLED=false` сохранены в CI и Docker Compose.
- Внешние Bitrix24/CRM-запросы не выполнялись.

## Ограничения

- Docker CLI/Engine отсутствует в среде, поэтому Docker Compose, PostgreSQL container logs и миграции на чистой базе локально заблокированы средой.
- GitHub CLI не аутентифицирован, поэтому push и Pull Request через `gh` локально заблокированы средой.
- Загрузка Playwright Chromium с `cdn.playwright.dev` заблокирована proxy 403, поэтому E2E браузерный запуск локально не выполнен.
