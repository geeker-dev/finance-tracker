import { useMemo, useState } from 'react'
import { useAccounts, useCategories, useTransactionsRange } from '../lib/api'
import { TZ, kyivParts, kyivStart, monthRange, weekRange } from '../lib/date'
import { categoryEmoji } from '../lib/icons'
import { formatMoney, formatMoneyShort } from '../lib/money'
import { CURRENCIES, type Currency } from '../lib/types'

type Mode = 'daily' | 'weekly' | 'monthly'

interface Bucket {
  label: string
  title: string
  from: Date
  to: Date
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const shortDate = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: 'numeric', month: 'short' })
const shortMonth = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, month: 'short' })
const longMonth = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, month: 'long', year: 'numeric' })

function buildBuckets(mode: Mode, weekOffset: number): Bucket[] {
  if (mode === 'daily') {
    const w = weekRange(weekOffset)
    const p = kyivParts(w.from)
    return Array.from({ length: 7 }, (_, i) => {
      const from = kyivStart(p.y, p.m, p.d + i)
      return {
        label: WEEKDAYS[i],
        title: shortDate.format(from),
        from,
        to: kyivStart(p.y, p.m, p.d + i + 1),
      }
    })
  }
  if (mode === 'weekly') {
    return Array.from({ length: 8 }, (_, i) => {
      const w = weekRange(i - 7)
      const last = new Date(w.to.getTime() - 1)
      return {
        label: String(kyivParts(w.from).d),
        title: `${shortDate.format(w.from)} — ${shortDate.format(last)}`,
        from: w.from,
        to: w.to,
      }
    })
  }
  return Array.from({ length: 6 }, (_, i) => {
    const m = monthRange(i - 5)
    return { label: shortMonth.format(m.from).replace('.', ''), title: longMonth.format(m.from), from: m.from, to: m.to }
  })
}

export default function Stats() {
  const [mode, setMode] = useState<Mode>('daily')
  const [weekOffset, setWeekOffset] = useState(0)
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [currency, setCurrency] = useState<Currency>('UAH')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const buckets = useMemo(() => buildBuckets(mode, weekOffset), [mode, weekOffset])
  const txs = useTransactionsRange(buckets[0].from, buckets[buckets.length - 1].to)
  const accounts = useAccounts()
  const categories = useCategories()

  const currencyOf = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a.currency])), [accounts.data])

  const relevant = useMemo(
    () => (txs.data ?? []).filter((t) => t.kind === kind && currencyOf.get(t.account_id) === currency),
    [txs.data, kind, currency, currencyOf],
  )

  const totals = useMemo(
    () =>
      buckets.map((b) =>
        relevant
          .filter((t) => {
            const ts = new Date(t.occurred_at).getTime()
            return ts >= b.from.getTime() && ts < b.to.getTime()
          })
          .reduce((s, t) => s + Number(t.amount_minor), 0),
      ),
    [buckets, relevant],
  )

  // по умолчанию выбран текущий период (последний столбец, а в «Днях» — сегодня)
  const defaultIdx = useMemo(() => {
    if (mode !== 'daily') return buckets.length - 1
    const now = Date.now()
    const idx = buckets.findIndex((b) => now >= b.from.getTime() && now < b.to.getTime())
    return idx === -1 ? buckets.length - 1 : idx
  }, [mode, buckets])
  const idx = selectedIdx ?? defaultIdx
  const bucket = buckets[idx]
  const max = Math.max(...totals, 1)

  const breakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of relevant) {
      const ts = new Date(t.occurred_at).getTime()
      if (ts < bucket.from.getTime() || ts >= bucket.to.getTime() || !t.category_id) continue
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + Number(t.amount_minor))
    }
    return [...map.entries()]
      .map(([id, sum]) => ({ category: categories.data?.find((c) => c.id === id), sum }))
      .sort((a, b) => b.sum - a.sum)
  }, [relevant, bucket, categories.data])

  const periodTotal = totals[idx] ?? 0
  const usedCurrencies = CURRENCIES.filter((c) => (accounts.data ?? []).some((a) => a.currency === c))

  const changeMode = (m: Mode) => {
    setMode(m)
    setWeekOffset(0)
    setSelectedIdx(null)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Статистика</h1>

      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-card p-1">
        {(
          [
            ['daily', 'По дням'],
            ['weekly', 'По неделям'],
            ['monthly', 'По месяцам'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => changeMode(m)}
            className={`rounded-xl py-2 text-sm font-medium ${mode === m ? 'bg-primary text-white' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="chip" data-active={kind === 'expense'} onClick={() => setKind('expense')}>
          Расходы
        </button>
        <button className="chip" data-active={kind === 'income'} onClick={() => setKind('income')}>
          Доходы
        </button>
        <span className="w-2" />
        {(usedCurrencies.length ? usedCurrencies : (['UAH'] as Currency[])).map((c) => (
          <button key={c} className="chip" data-active={c === currency} onClick={() => setCurrency(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="glass p-5">
        {mode === 'daily' && (
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <button className="px-2 py-1" onClick={() => { setWeekOffset((w) => w - 1); setSelectedIdx(null) }}>
              ‹ Раньше
            </button>
            <button
              className="px-2 py-1 disabled:opacity-30"
              disabled={weekOffset >= 0}
              onClick={() => { setWeekOffset((w) => w + 1); setSelectedIdx(null) }}
            >
              Позже ›
            </button>
          </div>
        )}

        <div className="text-center">
          <div className="text-3xl font-bold">{formatMoney(periodTotal, currency)}</div>
          <div className="mt-1 text-sm text-muted">{bucket.title}</div>
        </div>

        <div className="mt-5 flex h-44 items-end gap-2">
          {buckets.map((b, i) => {
            const h = totals[i] > 0 ? Math.max(8, (totals[i] / max) * 160) : 4
            const active = i === idx
            return (
              <button
                key={b.from.toISOString()}
                onClick={() => setSelectedIdx(i)}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                aria-label={`${b.title}: ${formatMoneyShort(totals[i], currency)}`}
              >
                <span
                  className="w-full rounded-xl transition-all"
                  style={{
                    height: h,
                    background: active
                      ? kind === 'expense'
                        ? 'linear-gradient(180deg,#5b8bff,#2f6bff)'
                        : 'linear-gradient(180deg,#d4ff6b,#b6f23a)'
                      : 'rgb(255 255 255 / 0.1)',
                  }}
                />
                <span className={`text-xs ${active ? 'text-white' : 'text-muted'}`}>{b.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">По категориям</h2>
        {txs.isLoading && <div className="h-16 animate-pulse rounded-2xl bg-white/5" />}
        {!txs.isLoading && breakdown.length === 0 && <p className="text-sm text-muted">За этот период операций нет.</p>}
        <div className="space-y-2">
          {breakdown.map(({ category, sum }) => (
            <div key={category?.id ?? 'unknown'} className="row p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-xl">
                  {categoryEmoji(category?.icon)}
                </span>
                <span className="flex-1 truncate font-medium">{category?.name ?? 'Без категории'}</span>
                <span className="text-right">
                  <span className="block font-semibold">{formatMoney(sum, currency)}</span>
                  <span className="block text-xs text-muted">
                    {periodTotal ? Math.round((sum / periodTotal) * 100) : 0}%
                  </span>
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${kind === 'expense' ? 'bg-primary' : 'bg-lime'}`}
                  style={{ width: `${periodTotal ? (sum / periodTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
