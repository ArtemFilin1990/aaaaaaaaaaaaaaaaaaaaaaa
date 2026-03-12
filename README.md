# Cloudflare Worker MCP

Подпроект в `MCP/` добавляет отдельный `Cloudflare Worker` MCP-сервер на базе [`cloudflare/mcp`](https://github.com/cloudflare/mcp) и паттерна `Code Mode` через `Worker Loader`.

Сервер предоставляет два MCP tools:

- `search` — поиск по Cloudflare OpenAPI spec;
- `execute` — выполнение Cloudflare API вызовов через изолированный worker.

Реализация опирается на:

- [`worker-loader`](https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/)
- [`workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider)
- upstream reference: [`cloudflare/mcp`](https://github.com/cloudflare/mcp)

## Что внутри

- `src/index.ts` — `fetch`/`scheduled` entrypoint и OAuth/API-token обработка.
- `src/server.ts` — регистрация MCP tools `search` и `execute`.
- `src/executor.ts` — запуск сгенерированного кода внутри `Worker Loader`.
- `src/auth/*` — OAuth flow и scope management.
- `scripts/seed-r2.ts` — загрузка подготовленного OpenAPI spec в `R2`.

## Установка

```bash
cd MCP
npm install
```

## Конфигурация Cloudflare

1. Создайте `R2` bucket:

```bash
npx wrangler r2 bucket create cloudflare-worker-mcp-spec
```

2. Создайте `KV` namespace для OAuth state/storage:

```bash
npx wrangler kv namespace create OAUTH_KV
```

3. Подставьте полученный `id` в `wrangler.jsonc` вместо `00000000000000000000000000000000`.

4. Если нужен OAuth flow, задайте секреты:

```bash
npx wrangler secret put MCP_COOKIE_ENCRYPTION_KEY
npx wrangler secret put CLOUDFLARE_CLIENT_ID
npx wrangler secret put CLOUDFLARE_CLIENT_SECRET
```

Для локальной разработки можно создать `.dev.vars` по образцу `.dev.vars.example`.

## Первичная загрузка spec

Перед первым удалённым запуском загрузите подготовленный OpenAPI spec в `R2`:

```bash
npm run seed
```

## Запуск

Локальная разработка:

```bash
npm run dev
```

Локальный MCP endpoint будет доступен через `wrangler dev`; основной маршрут MCP — `POST /mcp`.

Проверки:

```bash
npm run check
```

Деплой:

```bash
npm run deploy
```

## Ограничения

- `search` зависит от наличия `spec.json` и `products.json` в `R2`.
- `execute` работает только против `env.CLOUDFLARE_API_BASE` и блокирует произвольный outbound traffic через `GlobalOutbound`.
- Direct API token mode поддерживается без OAuth redirect flow, но OAuth-секреты всё равно нужны, если вы хотите авторизацию через `/authorize`.
