-- Раз в час (в :00 по UTC) вызывает серверную функцию push, а она сама решает, кому пора слать напоминание.
-- Час по Киеву проверяется на стороне базы, поэтому переход на летнее и зимнее время ничего не ломает.
-- Замени <PROJECT_REF> на идентификатор проекта (https://<PROJECT_REF>.supabase.co).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'push-reminders',
  '0 * * * *',
  $job$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select cron_secret from public.push_config where id)
    ),
    body := '{"action":"send-reminders"}'::jsonb
  );
  $job$
);
