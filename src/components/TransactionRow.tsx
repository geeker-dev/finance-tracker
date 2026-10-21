import { categoryEmoji } from '../lib/icons'
import { formatTime } from '../lib/date'
import { formatMoney } from '../lib/money'
import type { Account, Category, Transaction } from '../lib/types'

interface Props {
  tx: Transaction
  accounts: Account[]
  categories: Category[]
  showDate?: boolean
  onClick?: () => void
}

export default function TransactionRow({ tx, accounts, categories, onClick }: Props) {
  const account = accounts.find((a) => a.id === tx.account_id)
  const toAccount = accounts.find((a) => a.id === tx.to_account_id)
  const category = categories.find((c) => c.id === tx.category_id)
  const currency = account?.currency ?? 'UAH'

  let title: string
  let emoji: string
  let amount: string
  let color = 'text-text'

  switch (tx.kind) {
    case 'income':
      title = category?.name ?? 'Доход'
      emoji = categoryEmoji(category?.icon)
      amount = formatMoney(tx.amount_minor, currency, { sign: true })
      color = 'text-lime'
      break
    case 'expense':
      title = category?.name ?? 'Расход'
      emoji = categoryEmoji(category?.icon)
      amount = formatMoney(-tx.amount_minor, currency)
      break
    case 'transfer':
      title = `${account?.name ?? '?'} → ${toAccount?.name ?? '?'}`
      emoji = '🔄'
      amount = formatMoney(tx.amount_minor, currency)
      color = 'text-primary-2'
      break
    default:
      title = 'Корректировка'
      emoji = '⚖️'
      amount = formatMoney(tx.amount_minor, currency, { sign: true })
      color = tx.amount_minor > 0 ? 'text-lime' : 'text-text'
  }

  const sub = [tx.note, tx.kind === 'transfer' ? null : account?.name, formatTime(tx.occurred_at)]
    .filter(Boolean)
    .join(' · ')

  return (
    <button onClick={onClick} className="row flex w-full items-center gap-3 p-3 text-left active:opacity-80">
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-white/5 text-xl">
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      <span className="text-right">
        <span className={`block font-semibold ${color}`}>{amount}</span>
        {tx.kind === 'transfer' && tx.to_amount_minor && toAccount && toAccount.currency !== currency && (
          <span className="block text-xs text-muted">→ {formatMoney(tx.to_amount_minor, toAccount.currency)}</span>
        )}
      </span>
    </button>
  )
}
