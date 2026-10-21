# finance-tracker

Личное PWA-приложение для учёта трат и накоплений (по мотивам ZenMoney). Русский язык, тёмная тема, данные в облаке (Supabase), установка на экран «Домой».

Архитектура и принятые решения: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Что умеет

- Счета в UAH / USD / USDT, архив счетов, начальный остаток
- Расходы, доходы, переводы между счетами (в т.ч. в разных валютах), сверка баланса
- Категории (набор по умолчанию создаётся при первом входе)
- Статистика по дням / неделям / месяцам, разбивка по категориям
- Бюджеты по категориям на месяц с предупреждением о превышении
- Цели накоплений, привязанные к счёту
- Экспорт всех данных в JSON
- Чтение работает офлайн (кэш), запись — только с сетью

## Запуск

1. Создай проект на [supabase.com](https://supabase.com) и выполни `supabase/paste.sql` (или `supabase/migrations/0001_init.sql`) в SQL Editor.
2. **Authentication → Sign In / Providers → Email**: выключи **Confirm email**, чтобы не зависеть от писем.
3. Скопируй `.env.example` в `.env` и заполни `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. `npm install && npm run dev`
5. На экране входа нажми «Первый запуск? Создать аккаунт», задай email и пароль. После этого **отключи регистрацию новых пользователей** (Authentication → Sign In / Providers → «Allow new users to sign up»), чтобы никто чужой не мог создать аккаунт.

## Деплой (Vercel)

1. На vercel.com войди через GitHub → **Add New → Project** → выбери репозиторий `finance-tracker`.
2. Framework Preset определится как Vite (build `npm run build`, output `dist`).
3. В **Environment Variables** добавь `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` (те же значения, что в `.env`) и нажми **Deploy**.
4. `vercel.json` уже настроен: переходы по ссылкам внутри приложения работают, service worker не кэшируется.

Cloudflare Pages тоже подойдёт: build `npm run build`, output `dist`, `public/_redirects` уже есть.

На iPhone: открой сайт в Safari → «Поделиться» → «На экран Домой».

## Бэкап и keep-alive

В репозитории настроены GitHub Actions. Добавь секреты репозитория: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (keep-alive) и `SUPABASE_DB_URL` (еженедельный дамп).

## Дальше (v1.1)

Push-уведомления (вечернее напоминание), теги, очередь записей офлайн.
