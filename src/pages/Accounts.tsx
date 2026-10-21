import { useState, type FormEvent } from 'react'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'
import { useAccounts, useArchiveAccount, useCreateAccount } from '../lib/api'
import { ACCOUNT_TYPES, accountEmoji } from '../lib/icons'
import { formatMoney, parseAmount } from '../lib/money'
import { CURRENCIES, type AccountType, type Currency } from '../lib/types'

export default function Accounts() {
  const { data: accounts = [], isLoading } = useAccounts()
  const create = useCreateAccount()
  const archive = useArchiveAccount()
  const toast = useToast()

  const [showForm, setShowForm] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>('UAH')
  const [type, setType] = useState<AccountType>('card')
  const [initial, setInitial] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const initialMinor = initial.trim() === '' ? 0 : parseAmount(initial)
    if (initialMinor === null) return toast.show('Некорректный начальный остаток', 'error')
    try {
      await create.mutateAsync({ name: name.trim(), currency, type, initial_minor: initialMinor })
      toast.show('Счёт создан')
      setName('')
      setInitial('')
      setShowForm(false)
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не удалось создать счёт', 'error')
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
        {visible.map((a) => (
          <div key={a.id} className="row flex items-center gap-3 p-4">
            <span className="text-2xl">{accountEmoji(a.type)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{a.name}</span>
              <span className="block text-sm text-muted">{formatMoney(a.balance_minor, a.currency)}</span>
            </span>
            <button className="text-sm text-muted" onClick={() => toggleArchive(a.id, !a.archived)}>
              {a.archived ? 'Вернуть' : 'В архив'}
            </button>
          </div>
        ))}
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
            <label className="label">Текущий остаток</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="0"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
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
