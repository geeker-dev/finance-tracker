alter table public.accounts add column credit_limit_minor bigint not null default 0 check (credit_limit_minor >= 0);
