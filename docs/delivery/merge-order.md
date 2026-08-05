# Порядок последовательного merge этапов 3–12

Дата: 2026-08-05.

Исходный `origin/main`: `b00a6a9bf83633eae1d77b533019abb40f331427`.

## Правило

Каждый следующий этап должен базироваться на HEAD предыдущего этапа, если предыдущий PR ещё не объединён. Ветки нельзя объединять вне очереди, потому что функциональность каталога, карточки, корзины, интеграций, импорта, SEO и production-readiness зависит от предыдущих слоёв.

## Порядок

| Очередь | Ветка | База до merge предыдущего этапа | Назначение | Статус |
|---:|---|---|---|---|
| 3 | `codex/stage-3-postgres-search` | `main` | PostgreSQL-backed поиск | в `origin/main` уже есть commit `073b3d5` |
| 4 | `codex/stage-4-catalog-filters` | `origin/main` | URL-фильтры, сортировка, пагинация | локальная ветка |
| 5 | `codex/stage-5-product-analogs` | `codex/stage-4-catalog-filters` | техническая карточка и безопасные аналоги | план |
| 6 | `codex/stage-6-request-cart` | `codex/stage-5-product-analogs` | корзина-заявка и PostgreSQL заказ | план |
| 7 | `codex/stage-7-bitrix-adapter` | `codex/stage-6-request-cart` | отключённый Bitrix24 order adapter | план |
| 8 | `codex/stage-8-import-1c` | `codex/stage-7-bitrix-adapter` | импорт и 1С-контракты | план |
| 9 | `codex/stage-9-design-system-home` | `codex/stage-8-import-1c` | дизайн-система и главная | план |
| 10 | `codex/stage-10-seo-content-analytics` | `codex/stage-9-design-system-home` | SEO, база знаний, аналитика | план |
| 11 | `codex/stage-11-release-audit` | `codex/stage-10-seo-content-analytics` | release audit | план |
| 12 | `codex/stage-12-production-readiness` | `codex/stage-11-release-audit` | production runbooks/readiness | план |

## Запреты

- Не merge этап 5 до этапа 4.
- Не merge этап 6 до этапа 5.
- Не включать write-режим Bitrix24 до отдельного разрешения.
- Не объявлять production deployment без фактических credentials, migration, smoke и URL.

## SHA

- Stage 4 base SHA: `b00a6a9bf83633eae1d77b533019abb40f331427`.
- Stage 4 final SHA: `c10de402a11368b116e4047878237f02d7ec55c1`.
- Stage 5–12 final SHA: NOT RUN.
