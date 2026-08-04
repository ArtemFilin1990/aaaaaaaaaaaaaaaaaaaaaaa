# Проверка базового технического контура

## Область проверки

Этап стабилизирует исходный каркас B2B-каталога «ЭВЕРЕСТ» без подключения рабочих данных, Bitrix24 и 1С.

Базовый коммит `main` на момент начала работ: `763ef7b4f9b45be3f7bd3ef0f7352dad5fbe267e`.

Рабочая ветка: `codex/project-baseline-fix`.

## Обнаруженные проблемы

1. В репозитории отсутствует `pnpm-lock.yaml`.
2. Исходный CI использовал `pnpm install --no-frozen-lockfile`.
3. Исходный CI не поднимал PostgreSQL и не применял миграции.
4. Prisma schema не проходила отдельные `format` и `validate` проверки.
5. Vitest не исключал Playwright-файлы явно.
6. Playwright не запускался в CI.
7. Standalone production-сборка не проверялась реальным HTTP-запросом.
8. Docker Compose не имел health-check для PostgreSQL и приложения.
9. Начальная Prisma migration отсутствовала.

## Выполненные изменения

- добавлены команды Prisma, базы данных и отдельных тестовых контуров;
- lint переведён на прямой запуск ESLint с запретом предупреждений;
- Vitest ограничен unit-тестами и исключает `tests/e2e`;
- Playwright получил CI-настройки, таймауты, повторные попытки и отчёт;
- добавлен smoke-тест `/api/health`;
- добавлена начальная PostgreSQL migration;
- Dockerfile сохраняет standalone output и запускает приложение от непривилегированного пользователя;
- Docker Compose получил health-check и ожидание готовности PostgreSQL;
- GitHub Actions разделён на bootstrap lockfile и основной quality job;
- quality job настроен на PostgreSQL, Prisma format/validate/migrate, lint, typecheck, unit, build, Playwright и standalone smoke-тест.

## Фактический статус проверок

GitHub Actions запустился для Pull Request №14, но job `lockfile` завершился до выполнения доступных через API шагов. Artifact не создан, а GitHub API не вернул журнал job (`BlobNotFound`). Поэтому причина сбоя среды пока не подтверждена.

| Проверка | Статус |
|---|---|
| Генерация `pnpm-lock.yaml` | не выполнена: CI job завершился ошибкой до artifact |
| `pnpm install --frozen-lockfile` | не выполнена |
| Prisma format | настроено, не выполнено |
| Prisma validate | настроено, не выполнено |
| Prisma migrate deploy | настроено, не выполнено |
| lint | настроено, не выполнено |
| typecheck | настроено, не выполнено |
| unit tests | настроено, не выполнено |
| production build | настроено, не выполнено |
| Playwright | настроено, не выполнено |
| standalone `/api/health` | настроено, не выполнено |
| Docker Compose | конфигурация обновлена; Docker Engine не запускался |

Ни одна проверка не считается успешно пройденной.

## Lockfile и Docker

До появления реального `pnpm-lock.yaml` Dockerfile использует `pnpm install --no-frozen-lockfile`, чтобы сборка репозитория не была заведомо сломана отсутствующим файлом. После создания и коммита lockfile Dockerfile и CI должны быть переведены на обязательный `--frozen-lockfile`, а bootstrap job удалён.

## Безопасность

- рабочие webhook, токены и `.env` не добавлялись;
- `B24_MODE=mock` и `B24_WRITE_ENABLED=false` сохранены;
- тестовая PostgreSQL использует только локальные учётные данные CI;
- внешние запросы Bitrix24 и 1С не выполняются.

## Ограничения следующего этапа

- текущая Prisma schema остаётся минимальной и не является полной моделью каталога;
- демонстрационный каталог пока хранится в коде;
- `pnpm-lock.yaml` отсутствует;
- CI среды GitHub Actions требует отдельной диагностики владельцем репозитория через UI Actions;
- реальные PostgreSQL, Bitrix24 и 1С не подключены;
- дизайн не изменялся.
