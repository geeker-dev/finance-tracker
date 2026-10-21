import { monthRange } from './date'
import { formatMoney } from './money'
import { supabase } from './supabase'
import type { Account, Budget, Transaction } from './types'

/**
 * После сохранения расхода проверяет бюджет категории за текущий месяц.
 * Возвращает текст предупреждения или null. Считается на клиенте — пуш тут не нужен,
 * пользователь в этот момент и так в приложении.
 */
export async function budgetWarning(
  categoryId: string,
  accounts: Account[],
): Promise<string | null> {
  const month = monthRange(0)
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*')
    .eq('category_id', categoryId)
    .eq('month', month.key)
  const list = (budgets ?? []) as Budget[]
  if (list.length === 0) return null

  const { data: txs } = await supabase
    .from('transactions')
    .select('account_id,amount_minor')
    .eq('kind', 'expense')
    .eq('category_id', categoryId)
    .gte('occurred_at', month.from.toISOString())
    .lt('occurred_at', month.to.toISOString())
  const rows = (txs ?? []) as Pick<Transaction, 'account_id' | 'amount_minor'>[]
  const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]))

  for (const b of list) {
    const limit = Number(b.limit_minor)
    const spent = rows
      .filter((r) => currencyOf.get(r.account_id) === b.currency)
      .reduce((s, r) => s + Number(r.amount_minor), 0)
    if (spent > limit) {
      return `Бюджет превышен: потрачено ${formatMoney(spent, b.currency)} из ${formatMoney(limit, b.currency)}`
    }
    if (spent >= limit * 0.8) {
      return `Использовано ${Math.round((spent / limit) * 100)}% бюджета категории`
    }
  }
  return null
}
