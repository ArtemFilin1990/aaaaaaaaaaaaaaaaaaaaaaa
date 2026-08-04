# Проверка базового технического контура

## Область проверки

Этап стабилизирует исходный каркас B2B-каталога «ЭВЕРЕСТ» без подключения рабочих данных, Bitrix24 и 1С.

Базовый коммит `main` на момент начала работ: `763ef7b4f9b45be3f7bd3ef0f7352dad5fbe267e`.

Рабочая ветка: `codex/project-baseline-fix`.

## Обнаруженные проблемы

1. В репозитории отсутствовал `pnpm-lock.yaml`.
2. CI использовал `pnpm install --no-frozen-lockfile`.
3. CI не поднимал PostgreSQL и не применял миграции.
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
- Dockerfile использует standalone output, непривилегированного пользователя и frozen lockfile;
- Docker Compose получил health-check и ожидание готовности PostgreSQL;
- GitHub Actions поднимает PostgreSQL, проверяет Prisma, применяет миграции, запускает lint, typecheck, unit, build, Playwright и standalone smoke-тест;
- workflow временно генерирует отсутствующий `pnpm-lock.yaml` и публикует его как artifact. После первого успешного запуска lockfile должен быть добавлен в репозиторий, после чего bootstrap-шаг можно удалить.

## Проверки

Фактические команды выполняются GitHub Actions, поскольку GitHub-коннектор не предоставляет локальную среду Node.js, Docker и браузер.

| Проверка | Статус до CI |
|---|---|
| `pnpm install --frozen-lockfile` | ожидает созданный lockfile |
| Prisma format | настроено в CI |
| Prisma validate | настроено в CI |
| Prisma migrate deploy | настроено в CI с PostgreSQL service |
| lint | настроено в CI |
| typecheck | настроено в CI |
| unit tests | настроено в CI |
| production build | настроено в CI |
| Playwright | настроено в CI |
| standalone `/api/health` | настроено в CI |
| Docker Compose | конфигурация обновлена; Docker Engine отдельно не запускался |

Ни одна проверка не считается успешно пройденной до получения зелёного статуса соответствующего GitHub Actions job.

## Безопасность

- рабочие webhook, токены и `.env` не добавлялись;
- `B24_MODE=mock` и `B24_WRITE_ENABLED=false` сохранены;
- тестовая PostgreSQL использует только локальные учётные данные CI;
- внешние запросы Bitrix24 и 1С не выполняются.

## Ограничения следующего этапа

- текущая Prisma schema остаётся минимальной и не является полной моделью каталога;
- демонстрационный каталог пока хранится в коде;
- `pnpm-lock.yaml` требуется получить из CI artifact и закоммитить;
- реальные PostgreSQL, Bitrix24 и 1С не подключены;
- дизайн не изменялся.
