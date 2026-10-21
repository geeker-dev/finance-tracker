-- Кредитный лимит на счёте (в минимальных единицах). 0 = лимита нет.
-- Баланс счёта по-прежнему считается по транзакциям и может быть отрицательным;
-- доступно к трате = баланс + кредитный лимит.
alter table public.accounts
  add column credit_limit_minor bigint not null default 0 check (credit_limit_minor >= 0);
