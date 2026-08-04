# Локальная PostgreSQL

## Запуск

```bash
cp .env.example .env
pnpm db:up
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm db:seed
```

Повторный `pnpm db:seed` не должен создавать дубли.

## Команды

```bash
pnpm db:logs
pnpm db:studio
pnpm db:down
```

Полный сброс локальной базы:

```bash
pnpm db:reset
```

Команда удаляет локальные данные и запрещена для рабочей базы.

## Безопасность

- значения из `.env.example` предназначены только для локальной разработки;
- реальные пароли, токены и webhook не коммитить;
- рабочие Bitrix24 и 1С не подключаются к seed;
- все seed-записи имеют `sourceStatus=DEMO` и `isDemo=true`;
- перед использованием реальных каталогов требуется отдельный импорт с предварительным просмотром и ручным подтверждением.
