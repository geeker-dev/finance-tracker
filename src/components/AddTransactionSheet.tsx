import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAccounts, useAddTransaction, useCategories } from '../lib/api'
import { budgetWarning } from '../lib/budgetCheck'
import { dayKey, inputDateToInstant, kyivParts, kyivStart, todayInputValue } from '../lib/date'
import { accountEmoji, categoryEmoji } from '../lib/icons'
import { currencySymbol, formatMoney, parseAmount } from '../lib/money'
import type { AccountWithBalance } from '../lib/types'
import { useToast } from './Toast'

export type SheetKind = 'expense' | 'income' | 'transfer' | 'adjustment'

const TABS: { kind: SheetKind; label: string }[] = [
  { kind: 'expense', label: 'Расход' },
  { kind: 'income', label: 'Доход' },
  { kind: 'transfer', label: 'Перевод' },
  { kind: 'adjustment', label: 'Сверка' },
]

interface SheetApi {
  open: (kind?: SheetKind) => void
}
const Ctx = createContext<SheetApi>({ open: () => {} })
export const useAddSheet = () => useContext(Ctx)

export function AddSheetProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<SheetKind | null>(null)
  return (
    <Ctx.Provider value={{ open: (k = 'expense') => setKind(k) }}>
      {children}
      {kind && <Sheet initialKind={kind} onClose={() => setKind(null)} />}
    </Ctx.Provider>
  )
}

function formatShortDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Kyiv', day: 'numeric', month: 'short' })
    .format(kyivStart(y, m, d))
    .replace('.', '')
}

function Sheet({ initialKind, onClose }: { initialKind: SheetKind; onClose: () => void }) {
  const { data: allAccounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const add = useAddTransaction()
  const toast = useToast()

  const accounts = useMemo(() => allAccounts.filter((a) => !a.archived), [allAccounts])

  const [kind, setKind] = useState<SheetKind>(initialKind)
  const [amount, setAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [toAccountId, setToAccountId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const today = useMemo(() => todayInputValue(), [])
  const yesterday = useMemo(() => {
    const p = kyivParts(new Date())
    return dayKey(kyivStart(p.y, p.m, p.d - 1))
  }, [])
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string | null>(null)

  const account: AccountWithBalance | undefined =
    accounts.find((a) => a.id === accountId) ?? accounts[0]
  const toAccount = accounts.find((a) => a.id === toAccountId) ?? accounts.find((a) => a.id !== account?.id)

  const cats = categories.filter((c) => c.kind === kind && !c.archived)
  const sameCurrency = account && toAccount && account.currency === toAccount.currency

  async function save() {
    setError(null)
    if (!account) return setError('Сначала создай счёт: Ещё → Счета')
    const occurred_at = inputDateToInstant(date).toISOString()
    const trimmedNote = note.trim() || null

    try {
      if (kind === 'expense' || kind === 'income') {
        const minor = parseAmount(amount)
        if (!minor || minor <= 0) return setError('Введи сумму больше нуля')
        const cat = categoryId ?? cats[0]?.id
        if (!cat) return setError('Выбери категорию')
        await add.mutateAsync({
          kind,
          account_id: account.id,
          amount_minor: minor,
          category_id: cat,
          note: trimmedNote,
          occurred_at,
        })
        if (kind === 'expense') {
          const warn = await budgetWarning(cat, allAccounts).catch(() => null)
          if (warn) toast.show(warn, 'warn', undefined, 5000)
        }
      } else if (kind === 'transfer') {
        if (!toAccount) return setError('Для перевода нужно минимум два счёта')
        const out = parseAmount(amount)
        if (!out || out <= 0) return setError('Введи сумму больше нуля')
        const inn = sameCurrency ? out : parseAmount(toAmount)
        if (!inn || inn <= 0) return setError('Введи сумму зачисления')
        await add.mutateAsync({
          kind: 'transfer',
          account_id: account.id,
          to_account_id: toAccount.id,
          amount_minor: out,
          to_amount_minor: inn,
          note: trimmedNote,
          occurred_at,
        })
      } else {
        // сверка: вводим фактический баланс, разницу считаем сами
        const actual = parseAmount(amount)
        if (actual === null) return setError('Введи фактический баланс')
        const diff = actual - account.balance_minor
        if (diff === 0) return setError('Баланс уже совпадает')
        await add.mutateAsync({
          kind: 'adjustment',
          account_id: account.id,
          amount_minor: diff,
          note: trimmedNote ?? 'Корректировка баланса',
          occurred_at,
        })
      }
      toast.show('Сохранено')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  return (
    <div className="app-bg fixed inset-0 z-50 overflow-y-auto">
      <div
        className="mx-auto max-w-md px-5 pb-10"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
      >
        <div className="flex items-center justify-between">
          <button className="btn btn-ghost !px-4 !py-2" onClick={onClose}>
            Закрыть
          </button>
          <h2 className="text-lg font-semibold">Новая операция</h2>
          <span className="w-[88px]" />
        </div>

        <div className="mt-5 grid grid-cols-4 gap-1 rounded-2xl border border-line bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.kind}
              onClick={() => {
                setKind(t.kind)
                setCategoryId(null)
                setError(null)
              }}
              className={`rounded-xl py-2 text-sm font-medium ${
                kind === t.kind ? 'bg-primary text-white' : 'text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Сумма */}
        <div className="glass mt-5 p-5 text-center">
          <div className="text-sm text-muted">
            {kind === 'adjustment' ? 'Фактический баланс' : kind === 'transfer' ? 'Списывается' : 'Сумма'}
          </div>
          <div className="mt-1 flex items-baseline justify-center gap-2">
            <input
              autoFocus
              className={`min-w-0 flex-1 bg-transparent text-center font-bold leading-tight outline-none placeholder:text-white/20 ${
                amount.length > 9 ? 'text-4xl' : amount.length > 6 ? 'text-5xl' : 'text-6xl'
              }`}
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="text-3xl text-muted">{account ? currencySymbol(account.currency) : ''}</span>
          </div>
          {(kind === 'expense' || kind === 'transfer') &&
            account &&
            account.credit_limit_minor > 0 &&
            (parseAmount(amount) ?? 0) > account.balance_minor + account.credit_limit_minor && (
              <div className="mt-2 text-sm text-amber-300">
                Больше доступного: {formatMoney(account.balance_minor + account.credit_limit_minor, account.currency)}
              </div>
            )}
          {kind === 'adjustment' && account && (
            <div className="mt-2 text-sm text-muted">
              Сейчас на счёте: {formatMoney(account.balance_minor, account.currency)}
            </div>
          )}
        </div>

        {/* Счёт */}
        <div className="mt-5">
          <span className="label">{kind === 'transfer' ? 'Со счёта' : 'Счёт'}</span>
          {accounts.length === 0 ? (
            <p className="text-sm text-danger">Нет счетов. Создай первый: Ещё → Счета.</p>
          ) : (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  className="chip"
                  data-active={a.id === account?.id}
                  onClick={() => setAccountId(a.id)}
                >
                  {accountEmoji(a.type)} {a.name} · {a.currency}
                </button>
              ))}
            </div>
          )}
        </div>

        {kind === 'transfer' && (
          <>
            <div className="mt-5">
              <span className="label">На счёт</span>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {accounts
                  .filter((a) => a.id !== account?.id)
                  .map((a) => (
                    <button
                      key={a.id}
                      className="chip"
                      data-active={a.id === toAccount?.id}
                      onClick={() => setToAccountId(a.id)}
                    >
                      {accountEmoji(a.type)} {a.name} · {a.currency}
                    </button>
                  ))}
              </div>
            </div>
            {toAccount && !sameCurrency && (
              <div className="mt-5">
                <label className="label">Зачисляется ({toAccount.currency})</label>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="0"
                  value={toAmount}
                  onChange={(e) => setToAmount(e.target.value)}
                />
              </div>
            )}
          </>
        )}

        {/* Категории */}
        {(kind === 'expense' || kind === 'income') && (
          <div className="mt-5">
            <span className="label">Категория</span>
            <div className="grid grid-cols-4 gap-2">
              {cats.map((c) => {
                const active = (categoryId ?? cats[0]?.id) === c.id
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
        )}

        <div className="mt-5">
          <span className="label">Дата</span>
          <div className="flex gap-2">
            <button className="chip" data-active={date === today} onClick={() => setDate(today)}>
              Сегодня
            </button>
            <button className="chip" data-active={date === yesterday} onClick={() => setDate(yesterday)}>
              Вчера
            </button>
            {/* прозрачное системное поле поверх кнопки: тап открывает выбор даты */}
            <label className="chip relative overflow-hidden" data-active={date !== today && date !== yesterday}>
              {date !== today && date !== yesterday ? formatShortDate(date) : '📅 Другая'}
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value || today)}
                className="absolute inset-0 h-full w-full opacity-0"
                aria-label="Выбрать дату"
              />
            </label>
          </div>
        </div>

        <input
          className="input mt-4 !py-2.5"
          placeholder="Заметка (необязательно)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        {offline && <p className="mt-4 text-sm text-amber-300">Нет сети — сохранить сейчас нельзя.</p>}

        <button
          className="btn btn-lime mt-6 w-full"
          disabled={add.isPending || offline || accounts.length === 0}
          onClick={save}
        >
          {add.isPending ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
