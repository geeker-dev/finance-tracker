create extension if not exists pgcrypto;

create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  currency    text not null check (currency in ('UAH', 'USD', 'USDT')),
  type        text not null default 'cash' check (type in ('cash', 'card', 'savings', 'crypto')),
  icon        text,
  color       text,
  sort_order  int  not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  kind        text not null check (kind in ('income', 'expense')),
  icon        text,
  color       text,
  parent_id   uuid references public.categories(id) on delete restrict,
  sort_order  int  not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind             text not null check (kind in ('income', 'expense', 'transfer', 'adjustment')),
  account_id       uuid not null references public.accounts(id) on delete restrict,
  to_account_id    uuid references public.accounts(id) on delete restrict,
  amount_minor     bigint not null,
  to_amount_minor  bigint,
  category_id      uuid references public.categories(id) on delete restrict,
  note             text,
  occurred_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),

  constraint tx_shape check ((
    case kind
      when 'income'     then amount_minor > 0 and category_id is not null
                             and to_account_id is null and to_amount_minor is null
      when 'expense'    then amount_minor > 0 and category_id is not null
                             and to_account_id is null and to_amount_minor is null
      when 'transfer'   then amount_minor > 0 and to_amount_minor > 0
                             and to_account_id is not null and to_account_id <> account_id
                             and category_id is null
      when 'adjustment' then amount_minor <> 0 and category_id is null
                             and to_account_id is null and to_amount_minor is null
    end
  ) is true)
);

create index transactions_user_time_idx on public.transactions (user_id, occurred_at desc);
create index transactions_account_idx   on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id) where to_account_id is not null;
create index transactions_category_idx  on public.transactions (category_id) where category_id is not null;

create or replace function public.validate_transaction()
returns trigger language plpgsql as $$
declare
  cat_kind text;
  acc_user uuid;
begin
  if new.category_id is not null then
    select kind into cat_kind from public.categories where id = new.category_id and user_id = new.user_id;
    if cat_kind is null then
      raise exception 'Категория не найдена';
    end if;
    if cat_kind <> new.kind then
      raise exception 'Вид категории (%) не совпадает с видом транзакции (%)', cat_kind, new.kind;
    end if;
  end if;

  select user_id into acc_user from public.accounts where id = new.account_id;
  if acc_user is distinct from new.user_id then
    raise exception 'Счёт не найден';
  end if;

  if new.to_account_id is not null then
    select user_id into acc_user from public.accounts where id = new.to_account_id;
    if acc_user is distinct from new.user_id then
      raise exception 'Счёт назначения не найден';
    end if;
  end if;

  return new;
end;
$$;

create trigger transactions_validate
  before insert or update on public.transactions
  for each row execute function public.validate_transaction();

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.transaction_tags (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tag_id         uuid not null references public.tags(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (transaction_id, tag_id)
);

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  month        date not null check (month = date_trunc('month', month)::date),
  limit_minor  bigint not null check (limit_minor > 0),
  currency     text not null default 'UAH' check (currency in ('UAH', 'USD', 'USDT')),
  created_at   timestamptz not null default now(),
  unique (user_id, category_id, month, currency)
);

create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  account_id    uuid not null unique references public.accounts(id) on delete cascade,
  target_minor  bigint not null check (target_minor > 0),
  deadline      date,
  created_at    timestamptz not null default now()
);

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.currency,
  coalesce(sum(m.delta), 0)::bigint as balance_minor
from public.accounts a
left join (
  select account_id as acc, case kind
           when 'income'     then amount_minor
           when 'adjustment' then amount_minor
           when 'expense'    then -amount_minor
           when 'transfer'   then -amount_minor
         end as delta
  from public.transactions
  union all
  select to_account_id as acc, to_amount_minor as delta
  from public.transactions
  where kind = 'transfer'
) m on m.acc = a.id
group by a.id, a.user_id, a.currency;

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'transactions', 'tags',
    'transaction_tags', 'budgets', 'goals', 'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

grant select on public.account_balances to authenticated;

create or replace function public.seed_default_categories()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Нужна авторизация';
  end if;
  if exists (select 1 from public.categories where user_id = uid) then
    return;
  end if;

  insert into public.categories (user_id, name, kind, icon, color, sort_order) values
    (uid, 'Продукты',          'expense', 'shopping-cart', '#3b82f6', 1),
    (uid, 'Кафе и рестораны',  'expense', 'utensils',      '#f59e0b', 2),
    (uid, 'Транспорт',         'expense', 'bus',           '#06b6d4', 3),
    (uid, 'Жильё и коммуналка','expense', 'home',          '#8b5cf6', 4),
    (uid, 'Здоровье',          'expense', 'heart-pulse',   '#ef4444', 5),
    (uid, 'Развлечения',       'expense', 'gamepad-2',     '#ec4899', 6),
    (uid, 'Одежда',            'expense', 'shirt',         '#14b8a6', 7),
    (uid, 'Связь и интернет',  'expense', 'wifi',          '#6366f1', 8),
    (uid, 'Подписки',          'expense', 'repeat',        '#a855f7', 9),
    (uid, 'Подарки',           'expense', 'gift',          '#f43f5e', 10),
    (uid, 'Образование',       'expense', 'graduation-cap','#0ea5e9', 11),
    (uid, 'Другое',            'expense', 'ellipsis',      '#64748b', 99),
    (uid, 'Зарплата',          'income',  'banknote',      '#a3e635', 1),
    (uid, 'Подработка',        'income',  'briefcase',     '#84cc16', 2),
    (uid, 'Подарки (доход)',   'income',  'gift',          '#22c55e', 3),
    (uid, 'Другое (доход)',    'income',  'ellipsis',      '#64748b', 99);
end;
$$;

revoke all on function public.seed_default_categories() from public, anon;
grant execute on function public.seed_default_categories() to authenticated;
