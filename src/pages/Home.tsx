import { Link } from 'react-router-dom'
import { useAddSheet, type SheetKind } from '../components/AddTransactionSheet'
import TransactionRow from '../components/TransactionRow'
import { useAccounts, useCategories, useRecentTransactions } from '../lib/api'
import { accountEmoji } from '../lib/icons'
import { formatMoney, formatMoneyShort } from '../lib/money'
import { CURRENCIES, type Currency } from '../lib/types'

const ACTIONS: { kind: SheetKind; label: string; icon: string }[] = [
  { kind: 'expense', label: 'Расход', icon: '↗' },
  { kind: 'income', label: 'Доход', icon: '↙' },
  { kind: 'transfer', label: 'Перевод', icon: '⇄' },
  { kind: 'adjustment', label: 'Сверка', icon: '⚖' },
]

export default function Home() {
  const { open } = useAddSheet()
  const accounts = useAccounts()
  const categories = useCategories()
  const recent = useRecentTransactions(5)

  const active = (accounts.data ?? []).filter((a) => !a.archived)

  // Общий баланс по каждой валюте (без конвертации по курсу)
  const totals = CURRENCIES.map((c) => ({
    currency: c as Currency,
    sum: active.filter((a) => a.currency === c).reduce((s, a) => s + a.balance_minor, 0),
    has: active.some((a) => a.currency === c),
  })).filter((t) => t.has)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold">Мои финансы</h1>
      </header>

      <section>
        <div className="text-sm text-muted">Общий баланс</div>
        {accounts.isLoading ? (
          <div className="mt-2 h-12 w-48 animate-pulse rounded-xl bg-white/5" />
        ) : totals.length === 0 ? (
          <div className="mt-1 text-4xl font-bold">0,00 ₴</div>
        ) : (
          <>
            <div className="mt-1 text-5xl font-bold tracking-tight">
              {formatMoney(totals[0].sum, totals[0].currency)}
            </div>
            {totals.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-lg text-muted">
                {totals.slice(1).map((t) => (
                  <span key={t.currency}>{formatMoney(t.sum, t.currency)}</span>
                ))}
              </div>
            )}
          </>
        )}
        {accounts.error && <p className="mt-2 text-sm text-danger">{(accounts.error as Error).message}</p>}
      </section>

      <section className="grid grid-cols-4 gap-3">
        {ACTIONS.map((a) => (
          <button key={a.kind} onClick={() => open(a.kind)} className="flex flex-col items-center gap-2">
            <span className="glass flex h-16 w-full items-center justify-center rounded-2xl text-2xl">{a.icon}</span>
            <span className="text-xs text-muted">{a.label}</span>
          </button>
        ))}
      </section>

      {!accounts.isLoading && active.length === 0 ? (
        <Link to="/more/accounts" className="glass block p-5 text-center">
          <div className="text-3xl">💳</div>
          <div className="mt-2 font-semibold">Создай первый счёт</div>
          <div className="text-sm text-muted">Наличные, карта или накопления — и можно вносить траты</div>
        </Link>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Счета</h2>
            <Link to="/more/accounts" className="text-sm text-muted">
              Управлять
            </Link>
          </div>
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
            {active.map((a) => (
              <div key={a.id} className="glass w-44 flex-none p-4">
                <div className="text-2xl">{accountEmoji(a.type)}</div>
                <div className="mt-2 truncate text-sm text-muted">{a.name}</div>
                <div className={`mt-0.5 truncate font-semibold ${a.balance_minor < 0 ? 'text-danger' : ''}`}>
                  {formatMoney(a.balance_minor, a.currency)}
                </div>
                {a.credit_limit_minor > 0 && (
                  <div className="mt-1 truncate text-xs text-muted">
                    Доступно {formatMoneyShort(a.balance_minor + a.credit_limit_minor, a.currency)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Последние операции</h2>
          <Link to="/history" className="text-sm text-muted">
            Все
          </Link>
        </div>
        <div className="space-y-2">
          {recent.isLoading && <div className="h-16 animate-pulse rounded-2xl bg-white/5" />}
          {recent.data?.length === 0 && <p className="text-sm text-muted">Пока нет операций.</p>}
          {recent.data?.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} accounts={accounts.data ?? []} categories={categories.data ?? []} />
          ))}
        </div>
      </section>
    </div>
  )
}
