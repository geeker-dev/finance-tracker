import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'
import { useAccounts, useDeleteGoal, useGoals, useSaveGoal } from '../lib/api'
import { TZ } from '../lib/date'
import { accountEmoji } from '../lib/icons'
import { formatMoney, parseAmount } from '../lib/money'

const deadlineFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' })

export default function Goals() {
  const goals = useGoals()
  const accounts = useAccounts()
  const save = useSaveGoal()
  const del = useDeleteGoal()
  const toast = useToast()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')

  const list = goals.data ?? []
  const linked = new Set(list.map((g) => g.account_id))
  const free = (accounts.data ?? []).filter((a) => !a.archived && !linked.has(a.id))
  const chosen = free.find((a) => a.id === accountId) ?? free[0]

  async function submit() {
    const minor = parseAmount(target)
    if (!name.trim() || !chosen || !minor || minor <= 0) return toast.show('Заполни название, счёт и сумму цели', 'error')
    try {
      await save.mutateAsync({
        name: name.trim(),
        account_id: chosen.id,
        target_minor: minor,
        deadline: deadline || null,
      })
      setShowForm(false)
      setName('')
      setTarget('')
      setDeadline('')
      setAccountId(null)
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Не удалось сохранить', 'error')
    }
  }

  return (
    <div>
      <PageHeader title="Цели накоплений" />

      <p className="-mt-2 mb-5 text-sm text-muted">
        Цель привязана к счёту: прогресс — это баланс счёта. Пополняй счёт накоплений переводом или доходом.
      </p>

      {list.length === 0 && !goals.isLoading && (
        <div className="glass p-5 text-center">
          <div className="text-3xl">🏁</div>
          <p className="mt-2 text-muted">Целей пока нет.</p>
        </div>
      )}

      <div className="space-y-3">
        {list.map((g) => {
          const acc = accounts.data?.find((a) => a.id === g.account_id)
          const saved = Math.max(0, acc?.balance_minor ?? 0)
          const ratio = saved / g.target_minor
          const done = saved >= g.target_minor
          return (
            <div key={g.id} className="row p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{acc ? accountEmoji(acc.type) : '🏁'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{g.name}</span>
                  <span className="block truncate text-xs text-muted">{acc?.name}</span>
                </span>
                <button
                  className="text-sm text-muted"
                  onClick={() => del.mutate(g.id, { onError: (e) => toast.show(e.message, 'error') })}
                >
                  Убрать
                </button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${done ? 'bg-lime' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-sm text-muted">
                <span>
                  {acc ? formatMoney(saved, acc.currency) : '—'} из {acc ? formatMoney(g.target_minor, acc.currency) : '—'}
                </span>
                <span>{done ? 'Цель достигнута 🎉' : `${Math.floor(ratio * 100)}%`}</span>
              </div>
              {g.deadline && (
                <div className="mt-1 text-xs text-muted">
                  Срок: {deadlineFmt.format(new Date(g.deadline + 'T12:00:00Z'))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!showForm ? (
        <button className="btn btn-primary mt-5 w-full" onClick={() => setShowForm(true)}>
          + Новая цель
        </button>
      ) : (
        <div className="glass mt-5 space-y-4 p-4">
          {free.length === 0 ? (
            <p className="text-sm text-muted">
              Нет свободных счетов. Создай счёт накоплений (Ещё → Счета), и привяжи к нему цель.
            </p>
          ) : (
            <>
              <div>
                <label className="label">Название</label>
                <input className="input" placeholder="Например, Отпуск" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <span className="label">Счёт накоплений</span>
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                  {free.map((a) => (
                    <button key={a.id} className="chip" data-active={a.id === chosen?.id} onClick={() => setAccountId(a.id)}>
                      {accountEmoji(a.type)} {a.name} · {a.currency}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Сумма цели{chosen ? ` (${chosen.currency})` : ''}</label>
                <input className="input" inputMode="decimal" placeholder="0" value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
              <div>
                <label className="label">Срок (необязательно)</label>
                <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Отмена
            </button>
            <button className="btn btn-lime" onClick={submit} disabled={save.isPending || free.length === 0}>
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
