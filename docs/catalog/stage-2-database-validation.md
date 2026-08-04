# Stage 2 database validation

Дата проверки: 2026-08-04.

## База

- Базовый SHA `origin/main`: `41e2af67410102e1982f14fca0a36793217fd5a4`.
- Рабочая ветка: `codex/stage-2-db-integrity-fix`.
- PostgreSQL: локальный PostgreSQL 16.14, установленный в среде проверки, отдельные базы `everest_stage21_repro`, `everest_stage21_clean`, `everest_stage21_shadow`.
- Docker Compose не использовался, потому что Docker CLI отсутствовал в среде (`docker: command not found`).

## Воспроизведённый дефект до исправления

На пустой базе `everest_stage21_repro` команды `pnpm install --frozen-lockfile`, `pnpm prisma:generate`, `pnpm prisma:validate` прошли, а `pnpm prisma:migrate:deploy` упал на миграции `20260804183000_catalog_data_model` с ошибкой PostgreSQL `42704`: тип `AnalogStatus` не существует. Причина: миграция использовала enum `AnalogStatus` и `EvidenceLevel` до их создания.

## Способ исправления

Миграция этапа 2 исправлена in-place, потому что проект находится на демонстрационной стадии и нет документированного успешного применения этой миграции к общей или production-базе. Исправление:

- создаёт все enum до первого использования: `DesignationKind`, `AttributeValueType`, `StandardKind`, `AnalogStatus`, `EvidenceLevel`, `DocumentKind`, `ImportBatchStatus`, `ImportRowStatus`;
- заменяет безусловный `DROP TABLE IF EXISTS "Product" CASCADE` на upgrade-путь: старая таблица переименовывается в `_Stage1Product`, создаётся новая каноническая структура, затем старые строки переносятся с сохранением `id`, `slug`, `name`, размеров, типа и `isDemo`;
- переносит `sku`, `gost` и `iso` в `ProductDesignation`, а ГОСТ/ISO также в `StandardMapping`;
- назначает безопасный `supplyStatus = 'MIGRATED_UNCONFIRMED'` для мигрированных строк;
- не создаёт аналогов по совпадению размеров.

## Выполненные команды

```bash
git fetch origin --prune
git rev-parse origin/main
gh pr list --state open --limit 20
gh run list --limit 10
docker compose up -d db
apt-get update && apt-get install -y postgresql
pg_ctlcluster 16 main start
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:validate
pnpm prisma:migrate:deploy
pnpm prisma db seed
pnpm db:verify
pnpm prisma db seed
pnpm db:verify
pnpm db:drift
```

## Результаты seed и контрольные количества

После первого seed на чистой PostgreSQL:

| Сущность | Количество |
| --- | ---: |
| Product | 30 |
| DEMO Product | 30 |
| ProductDesignation | 120 |
| SearchAlias | 90 |
| StandardMapping | 60 |
| AnalogRelation | 3 |
| AnalogEvidence | 3 |
| ImportBatch | 1 |
| ImportRow | 30 |

После второго seed количества не изменились: `Product` остался `30`, `ImportBatch` остался `1`, `ImportRow` остался `30`, дубли по контролируемым уникальным ключам не обнаружены.

## Schema drift

`pnpm db:drift` выполнил `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --exit-code`. Результат: `No difference detected`.

## Upgrade-путь

Upgrade-путь проверяется от состояния после первой миграции: старая плоская таблица `Product` не удаляется вслепую, а конвертируется в новую модель. Реальные строки с `isDemo=false` не удаляются молча: значение `isDemo` сохраняется, а статус поставки становится неподтверждённым `MIGRATED_UNCONFIRMED`.

## Ограничения среды

- Docker CLI отсутствовал, поэтому PostgreSQL поднят локально через пакет PostgreSQL, а не Docker Compose.
- GitHub CLI не аутентифицирован, поэтому открытые PR и последние Actions локально не прочитаны через `gh`.
- `pnpm exec playwright install --with-deps chromium` установил системные зависимости, но загрузка Chromium с `cdn.playwright.dev` была заблокирована proxy `403 Domain forbidden`; поэтому полный `pnpm test:e2e` локально не завершился.
- Если GitHub Actions не стартует из-за биллинга, статус CI должен фиксироваться как `BLOCKED_CI_BILLING`; локально такой статус подтвердить невозможно без доступа к GitHub Actions.

## Статус GitHub Actions

Локально workflow обновлён так, чтобы после `migrate deploy` запускать seed дважды, DB verification и schema-drift check. Фактический результат GitHub Actions должен проверяться в Pull Request; при блокировке биллинга использовать статус `BLOCKED_CI_BILLING`.
