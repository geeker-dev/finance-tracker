import { useMemo, useState } from 'react'
import TransactionRow from '../components/TransactionRow'
import { useToast } from '../components/Toast'
import { useAccounts, useCategories, useDeleteTransaction, useTransactionsPage } from '../lib/api'
import { dayKey, formatDayLabel } from '../lib/date'
import type { Transaction } from '../lib/types'

export default function History() {
  const [pageSize, setPageSize] = useState(50)
  const txs = useTransactionsPage(pageSize)
  const accounts = useAccounts()
  const categories = useCategories()
  const del = useDeleteTransaction()
  const toast = useToast()
  const [selected, setSelected] = useState<Transaction | null>(null)

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const tx of txs.data ?? []) {
      const k = dayKey(tx.occurred_at)
      map.set(k, [...(map.get(k) ?? []), tx])
    }
    return [...map.entries()]
  }, [txs.data])

  async function remove() {
    if (!selected) return
    try {
      await del.mutateAsync(selected.id)
      toast.show('Операция удалена')
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Не удалось удалить', 'error')
    }
    setSelected(null)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">История</h1>

      {txs.isLoading && <div className="h-16 animate-pulse rounded-2xl bg-white/5" />}
      {txs.error && <p className="text-sm text-danger">{(txs.error as Error).message}</p>}
      {txs.data?.length === 0 && <p className="text-muted">Операций пока нет.</p>}

      {groups.map(([key, items]) => (
        <section key={key}>
          <h2 className="mb-2 text-sm text-muted">{formatDayLabel(key)}</h2>
          <div className="space-y-2">
            {items.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                accounts={accounts.data ?? []}
                categories={categories.data ?? []}
                onClick={() => setSelected(tx)}
              />
            ))}
          </div>
        </section>
      ))}

      {txs.data && txs.data.length >= pageSize && (
        <button className="btn btn-ghost w-full" onClick={() => setPageSize((n) => n + 50)}>
          Показать ещё
        </button>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setSelected(null)}>
          <div
            className="glass mx-auto w-full max-w-md rounded-b-none p-5"
            style={{ background: 'rgb(13 20 36 / 0.98)', paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-center text-muted">Удалить эту операцию? Баланс счёта пересчитается.</p>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>
                Отмена
              </button>
              <button className="btn btn-danger" onClick={remove} disabled={del.isPending}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
