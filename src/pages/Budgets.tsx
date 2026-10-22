import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'
import {
  useAccounts,
  useBudgets,
  useCategories,
  useDeleteBudget,
  useSaveBudget,
  useTransactionsRange,
} from '../lib/api'
import { formatMonth, monthRange } from '../lib/date'
import { categoryEmoji } from '../lib/icons'
import { formatMoneyShort, parseAmount } from '../lib/money'
import { CURRENCIES, type Currency } from '../lib/types'

export default function Budgets() {
  const month = useMemo(() => monthRange(0), [])
  const monthTitle = useMemo(() => {
    const t = formatMonth(month.from)
    return t.charAt(0).toUpperCase() + t.slice(1)
  }, [month])
  const prevMonth = useMemo(() => monthRange(-1), [])
  const budgets = useBudgets(month.key)
  const prevBudgets = useBudgets(prevMonth.key)
  const categories = useCategories()
  const accounts = useAccounts()
  const txs = useTransactionsRange(month.from, month.to)
  const save = useSaveBudget()
  const del = useDeleteBudget()
  const toast = useToast()

  const [showForm, setShowForm] = useState(false)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [limit, setLimit] = useState('')
  const [currency, setCurrency] = useState<Currency>('UAH')

  const expenseCats = (categories.data ?? []).filter((c) => c.kind === 'expense' && !c.archived)
  const currencyOf = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a.currency])), [accounts.data])

  const spentFor = (catId: string, cur: Currency) =>
    (txs.data ?? [])
      .filter((t) => t.kind === 'expense' && t.category_id === catId && currencyOf.get(t.account_id) === cur)
      .reduce((s, t) => s + Number(t.amount_minor), 0)

  async function submit() {
    const minor = parseAmount(limit)
    const cat = categoryId ?? expenseCats[0]?.id
    if (!cat || !minor || minor <= 0) return toast.show('Выбери категорию и введи лимит', 'error')
    try {
      await save.mutateAsync({ category_id: cat, month: month.key, limit_minor: minor, currency })
      setShowForm(false)
      setLimit('')
      setCategoryId(null)
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Не удалось сохранить', 'error')
    }
  }

  async function copyFromPrevious() {
    try {
      for (const b of prevBudgets.data ?? []) {
        await save.mutateAsync({
          category_id: b.category_id,
          month: month.key,
          limit_minor: b.limit_minor,
          currency: b.currency,
        })
      }
      toast.show('Бюджеты скопированы')
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Не удалось скопировать', 'error')
    }
  }

  async function remove(id: string) {
    try {
      await del.mutateAsync(id)
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Не удалось удалить', 'error')
    }
  }

  const list = budgets.data ?? []

  return (
    <div>
      <PageHeader title="Бюджеты" />
      <p className="-mt-2 mb-5 text-sm text-muted">{monthTitle}</p>

      {list.length === 0 && !budgets.isLoading && (
        <div className="glass p-5 text-center">
          <div className="text-3xl">🎯</div>
          <p className="mt-2 text-muted">На этот месяц бюджетов нет.</p>
          {(prevBudgets.data?.length ?? 0) > 0 && (
            <button className="btn btn-ghost mt-4 w-full" onClick={copyFromPrevious} disabled={save.isPending}>
              Скопировать с прошлого месяца
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {list.map((b) => {
          const cat = categories.data?.find((c) => c.id === b.category_id)
          const spent = spentFor(b.category_id, b.currency)
          const ratio = spent / b.limit_minor
          const over = spent > b.limit_minor
          return (
            <div key={b.id} className="row p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{categoryEmoji(cat?.icon)}</span>
                <span className="flex-1 font-semibold">{cat?.name ?? 'Категория'}</span>
                <button className="text-sm text-muted" onClick={() => remove(b.id)}>
                  Убрать
                </button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${over ? 'bg-danger' : ratio >= 0.8 ? 'bg-amber-400' : 'bg-lime'}`}
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between gap-3 whitespace-nowrap text-sm">
                <span className={over ? 'text-danger' : 'text-muted'}>
                  {formatMoneyShort(spent, b.currency)} из {formatMoneyShort(b.limit_minor, b.currency)}
                </span>
                <span className={over ? 'text-danger' : 'text-muted'}>
                  {over
                    ? `превышено на ${formatMoneyShort(spent - b.limit_minor, b.currency)}`
                    : `осталось ${formatMoneyShort(b.limit_minor - spent, b.currency)}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {!showForm ? (
        <button className="btn btn-primary mt-5 w-full" onClick={() => setShowForm(true)}>
          + Новый бюджет
        </button>
      ) : (
        <div className="glass mt-5 space-y-4 p-4">
          <div>
            <span className="label">Категория</span>
            <div className="grid grid-cols-4 gap-2">
              {expenseCats.map((c) => {
                const active = (categoryId ?? expenseCats[0]?.id) === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border p-2 text-center text-[11px] leading-tight ${
                      active ? 'border-primary bg-primary/20' : 'border-line bg-card'
                    }`}
                  >
                    <span className="text-2xl">{categoryEmoji(c.icon)}</span>
                    <span className="line-clamp-2">{c.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="label">Лимит на месяц</label>
            <input className="input" inputMode="decimal" placeholder="0" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {CURRENCIES.map((c) => (
              <button key={c} className="chip" data-active={c === currency} onClick={() => setCurrency(c)}>
                {c}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Учитываются только расходы в выбранной валюте. Если бюджет на эту категорию уже есть, он обновится.</p>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Отмена
            </button>
            <button className="btn btn-lime" onClick={submit} disabled={save.isPending}>
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
