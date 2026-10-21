import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type {
  Account,
  AccountType,
  AccountWithBalance,
  Budget,
  Category,
  Currency,
  Goal,
  Transaction,
  TxKind,
} from './types'

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ------------------------------------------------------------------ чтение

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async (): Promise<AccountWithBalance[]> => {
      const [accs, bals] = await Promise.all([
        supabase.from('accounts').select('*').order('sort_order').order('created_at'),
        supabase.from('account_balances').select('account_id,balance_minor'),
      ])
      const accounts = check(accs) as Account[]
      const balances = new Map(
        (check(bals) as { account_id: string; balance_minor: number }[]).map((b) => [
          b.account_id,
          Number(b.balance_minor),
        ]),
      )
      return accounts.map((a) => ({ ...a, balance_minor: balances.get(a.id) ?? 0 }))
    },
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      let cats = check(
        await supabase.from('categories').select('*').order('sort_order').order('name'),
      ) as Category[]
      if (cats.length === 0) {
        // первый вход: создаём набор категорий по умолчанию
        check(await supabase.rpc('seed_default_categories'))
        cats = check(
          await supabase.from('categories').select('*').order('sort_order').order('name'),
        ) as Category[]
      }
      return cats
    },
  })
}

export function useRecentTransactions(limit = 5) {
  return useQuery({
    queryKey: ['transactions', 'recent', limit],
    queryFn: async () =>
      check(
        await supabase
          .from('transactions')
          .select('*')
          .order('occurred_at', { ascending: false })
          .limit(limit),
      ) as Transaction[],
  })
}

export function useTransactionsPage(pageSize: number) {
  return useQuery({
    queryKey: ['transactions', 'page', pageSize],
    queryFn: async () =>
      check(
        await supabase
          .from('transactions')
          .select('*')
          .order('occurred_at', { ascending: false })
          .limit(pageSize),
      ) as Transaction[],
  })
}

export function useTransactionsRange(from: Date, to: Date) {
  return useQuery({
    queryKey: ['transactions', 'range', from.toISOString(), to.toISOString()],
    queryFn: async () =>
      check(
        await supabase
          .from('transactions')
          .select('*')
          .gte('occurred_at', from.toISOString())
          .lt('occurred_at', to.toISOString())
          .order('occurred_at', { ascending: false }),
      ) as Transaction[],
  })
}

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ['budgets', month],
    queryFn: async () =>
      (check(await supabase.from('budgets').select('*').eq('month', month)) as Budget[]).map(
        (b) => ({ ...b, limit_minor: Number(b.limit_minor) }),
      ),
  })
}

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () =>
      (check(await supabase.from('goals').select('*').order('created_at')) as Goal[]).map((g) => ({
        ...g,
        target_minor: Number(g.target_minor),
      })),
  })
}

// ------------------------------------------------------------------ запись

function useInvalidate() {
  const qc = useQueryClient()
  return (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })))
}

export interface NewTransaction {
  kind: TxKind
  account_id: string
  to_account_id?: string | null
  amount_minor: number
  to_amount_minor?: number | null
  category_id?: string | null
  note?: string | null
  occurred_at: string
}

export function useAddTransaction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (tx: NewTransaction) => {
      // id генерируем на клиенте — задел под офлайн-очередь без дублей
      const id = crypto.randomUUID()
      check(await supabase.from('transactions').insert({ id, ...tx }).select('id').single())
      return id
    },
    onSuccess: () => invalidate('transactions', 'accounts'),
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.from('transactions').delete().eq('id', id)
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => invalidate('transactions', 'accounts'),
  })
}

export interface NewAccount {
  name: string
  currency: Currency
  type: AccountType
  initial_minor: number
}

export function useCreateAccount() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ initial_minor, ...acc }: NewAccount) => {
      const created = check(
        await supabase.from('accounts').insert(acc).select('id').single(),
      ) as { id: string }
      if (initial_minor !== 0) {
        check(
          await supabase
            .from('transactions')
            .insert({
              id: crypto.randomUUID(),
              kind: 'adjustment',
              account_id: created.id,
              amount_minor: initial_minor,
              note: 'Начальный остаток',
            })
            .select('id')
            .single(),
        )
      }
      return created.id
    },
    onSuccess: () => invalidate('accounts', 'transactions'),
  })
}

export function useArchiveAccount() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const res = await supabase.from('accounts').update({ archived }).eq('id', id)
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => invalidate('accounts'),
  })
}

export function useSaveBudget() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (b: { category_id: string; month: string; limit_minor: number; currency: Currency }) => {
      const res = await supabase
        .from('budgets')
        .upsert(b, { onConflict: 'user_id,category_id,month,currency' })
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => invalidate('budgets'),
  })
}

export function useDeleteBudget() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.from('budgets').delete().eq('id', id)
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => invalidate('budgets'),
  })
}

export function useSaveGoal() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (g: { name: string; account_id: string; target_minor: number; deadline: string | null }) => {
      const res = await supabase.from('goals').insert(g)
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => invalidate('goals'),
  })
}

export function useDeleteGoal() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.from('goals').delete().eq('id', id)
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => invalidate('goals'),
  })
}
