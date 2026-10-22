-- Пуш-уведомления: настройки напоминаний, ключи сервера и выбор получателей.
-- Скрипт можно запускать повторно.

create table if not exists public.push_settings (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  enabled        boolean not null default true,
  reminder_hour  smallint not null default 21 check (reminder_hour between 0 and 23),
  updated_at     timestamptz not null default now()
);

alter table public.push_settings enable row level security;
drop policy if exists "own rows" on public.push_settings;
create policy "own rows" on public.push_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Одна строка с ключами VAPID и секретом для cron. Доступна только серверной функции (service_role):
-- RLS включён, политик нет, права у клиентских ролей отозваны.
create table if not exists public.push_config (
  id            boolean primary key default true check (id),
  vapid_public  text,
  vapid_private text,
  cron_secret   text not null default encode(gen_random_bytes(24), 'hex')
);

alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
insert into public.push_config (id) values (true) on conflict do nothing;

-- Название часового пояса Киева зависит от версии базы данных пояса: «Europe/Kyiv» в новых, «Europe/Kiev» в старых.
-- Берём то, которое есть.
create or replace function public.kyiv_tz()
returns text
language sql
stable
as $$
  select coalesce(
    (select name from pg_timezone_names where name = 'Europe/Kyiv'),
    'Europe/Kiev'
  );
$$;

-- Кому сейчас пора отправить напоминание: включены уведомления, есть подписка,
-- сейчас выбранный час по Киеву и сегодня ещё нет ни одной операции.
create or replace function public.users_due_for_reminder()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select s.user_id
  from public.push_settings s
  where s.enabled
    and s.reminder_hour = extract(hour from (now() at time zone public.kyiv_tz()))::int
    and exists (select 1 from public.push_subscriptions p where p.user_id = s.user_id)
    and not exists (
      select 1 from public.transactions t
      where t.user_id = s.user_id
        and t.kind in ('income', 'expense', 'transfer')
        and (t.occurred_at at time zone public.kyiv_tz())::date = (now() at time zone public.kyiv_tz())::date
    );
$$;

revoke all on function public.users_due_for_reminder() from public, anon, authenticated;
grant execute on function public.users_due_for_reminder() to service_role;
