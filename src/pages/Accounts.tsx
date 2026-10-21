import { useState, type FormEvent } from 'react'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'
import { useAccounts, useArchiveAccount, useCreateAccount, useUpdateAccount } from '../lib/api'
import { ACCOUNT_TYPES, accountEmoji } from '../lib/icons'
import { formatMoney, parseAmount } from '../lib/money'
import { CURRENCIES, type AccountType, type AccountWithBalance, type Currency } from '../lib/types'

// "5000" -> "5000", "5000,5" -> "5000,5": число для поля ввода из копеек
const toInput = (minor: number) => (minor ? String(minor / 100).replace('.', ',') : '')

export default function Accounts() {
  const { data: accounts = [], isLoading } = useAccounts()
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const archive = useArchiveAccount()
  const toast = useToast()

  const [showForm, setShowForm] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>('UAH')
  const [type, setType] = useState<AccountType>('card')
  const [initial, setInitial] = useState('')
  const [limit, setLimit] = useState('')

  const [editing, setEditing] = useState<AccountWithBalance | null>(null)
  const [editName, setEditName] = useState('')
  const [editLimit, setEditLimit] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const initialMinor = initial.trim() === '' ? 0 : parseAmount(initial)
    if (initialMinor === null) return toast.show('Некорректный остаток', 'error')
    const limitMinor = limit.trim() === '' ? 0 : parseAmount(limit)
    if (limitMinor === null || limitMinor < 0) return toast.show('Некорректный кредитный лимит', 'error')
    try {
      await create.mutateAsync({
        name: name.trim(),
        currency,
        type,
        initial_minor: initialMinor,
        credit_limit_minor: limitMinor,
      })
      toast.show('Счёт создан')
      setName('')
      setInitial('')
      setLimit('')
      setShowForm(false)
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не удалось создать счёт', 'error')
    }
  }

  function startEdit(a: AccountWithBalance) {
    setEditing(a)
    setEditName(a.name)
    setEditLimit(toInput(a.credit_limit_minor))
  }

  async function saveEdit() {
    if (!editing) return
    const limitMinor = editLimit.trim() === '' ? 0 : parseAmount(editLimit)
    if (limitMinor === null || limitMinor < 0) return toast.show('Некорректный кредитный лимит', 'error')
    if (!editName.trim()) return toast.show('Укажи название', 'error')
    try {
      await update.mutateAsync({ id: editing.id, name: editName.trim(), credit_limit_minor: limitMinor })
      setEditing(null)
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не удалось сохранить', 'error')
    }
  }

  async function toggleArchive(id: string, archived: boolean) {
    try {
      await archive.mutateAsync({ id, archived })
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
  }

  const visible = accounts.filter((a) => a.archived === showArchived)

  return (
    <div>
      <PageHeader title="Счета" />

      <div className="space-y-2">
        {isLoading && <div className="h-16 animate-pulse rounded-2xl bg-white/5" />}
        {!isLoading && visible.length === 0 && (
          <p className="text-muted">{showArchived ? 'Архив пуст.' : 'Счетов пока нет.'}</p>
        )}
        {visible.map((a) =>
          editing?.id === a.id ? (
            <div key={a.id} className="glass space-y-3 p-4">
              <div>
                <label className="label">Название</label>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="label">Кредитный лимит ({a.currency})</label>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="0 — лимита нет"
                  value={editLimit}
                  onChange={(e) => setEditLimit(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                  Отмена
                </button>
                <button className="btn btn-lime" onClick={saveEdit} disabled={update.isPending}>
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <div key={a.id} className="row p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{accountEmoji(a.type)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.name}</span>
                  <span className="block text-sm text-muted">
                    {a.credit_limit_minor > 0 ? 'Свои средства: ' : ''}
                    {formatMoney(a.balance_minor, a.currency)}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 text-sm text-muted">
                  <button onClick={() => startEdit(a)}>Изменить</button>
                  <button onClick={() => toggleArchive(a.id, !a.archived)}>{a.archived ? 'Вернуть' : 'В архив'}</button>
                </span>
              </div>
              {a.credit_limit_minor > 0 && (
                <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm">
                  <span className="text-muted">Лимит {formatMoney(a.credit_limit_minor, a.currency)}</span>
                  <span>Доступно {formatMoney(a.balance_minor + a.credit_limit_minor, a.currency)}</span>
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {!showForm && (
        <button className="btn btn-primary mt-5 w-full" onClick={() => setShowForm(true)}>
          + Новый счёт
        </button>
      )}

      {showForm && (
        <form onSubmit={submit} className="glass mt-5 space-y-4 p-4">
          <div>
            <label className="label">Название</label>
            <input
              className="input"
              placeholder="Например, Monobank"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <span className="label">Валюта</span>
            <div className="flex gap-2">
              {CURRENCIES.map((c) => (
                <button type="button" key={c} className="chip" data-active={c === currency} onClick={() => setCurrency(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Тип</span>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_TYPES.map((t) => (
                <button type="button" key={t.value} className="chip" data-active={t.value === type} onClick={() => setType(t.value)}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Текущий остаток (свои средства)</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="0"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">Если уже потратил кредитные деньги, введи сумму со знаком минус.</p>
          </div>
          <div>
            <label className="label">Кредитный лимит (необязательно)</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="Например, 50000"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Отмена
            </button>
            <button className="btn btn-lime" disabled={create.isPending || !name.trim()}>
              Создать
            </button>
          </div>
        </form>
      )}

      <button className="mt-6 w-full text-center text-sm text-muted" onClick={() => setShowArchived((v) => !v)}>
        {showArchived ? 'Показать активные' : 'Показать архив'}
      </button>
    </div>
  )
}
