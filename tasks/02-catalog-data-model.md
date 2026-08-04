# Этап 2. Каноническая модель каталога

## Ветка

`codex/catalog-data-model`

## Цель

Создать нормализованную Prisma-модель B2B-каталога подшипников без публичных цен и неподтверждённых остатков.

## Обязательные сущности

- Product
- ProductDesignation
- Brand
- Category
- ProductAttribute
- StandardMapping
- AnalogRelation
- AnalogEvidence
- TechnicalDocument
- SearchAlias
- ImportBatch
- ImportRow

## Правила

- ГОСТ, ISO, брендовые и внутренние обозначения хранить отдельно.
- Исходное обозначение не терять после нормализации.
- Одинаковые размеры не означают прямую взаимозаменяемость.
- Аналоги используют только статусы DIRECT, ONE_WAY, PARTIAL, SIZE_ONLY, NO_DIRECT, CONFLICT.
- Доказательность: A, B, C, R.
- Не добавлять публичные цены, реальные остатки, гарантированные сроки и реальные клиентские данные.
- Seed должен быть идемпотентным и содержать минимум 30 DEMO-позиций.

## Проверки

- Prisma format
- Prisma validate
- миграция на чистой PostgreSQL
- повторный seed без дублей
- lint
- typecheck
- unit tests
- production build

До восстановления GitHub Actions результаты считаются неподтверждёнными средой CI.