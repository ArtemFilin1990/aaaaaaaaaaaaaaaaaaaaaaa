# Стратегия тестирования

- Unit: нормализация обозначений, ранжирование поиска, проверки аналогов.
- Integration: Prisma repository, импорт, mock Bitrix24.
- E2E: поиск → карточка → корзина-заявка → форма.
- Quality gate: lint, typecheck, unit tests и production build на каждый pull request.
- Responsive: 360, 390, 768, 1024, 1440 и 1920 px.
- Security: отсутствие секретов в bundle и логах, серверная валидация, защита загрузки файлов и повторной отправки.
