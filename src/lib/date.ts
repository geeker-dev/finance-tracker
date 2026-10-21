// Все периоды считаем в часовом поясе Киева, неделя начинается с понедельника.
export const TZ = 'Europe/Kyiv'

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

export interface KyivParts {
  y: number
  m: number // 1..12
  d: number
  weekday: number // 0 = понедельник
}

export function kyivParts(date: Date | string): KyivParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(new Date(date))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  }
}

function offsetMinutes(date: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value // "GMT+03:00"
  const m = name?.match(/GMT([+-])(\d{2}):(\d{2})/)
  if (!m) return 0
  const v = Number(m[2]) * 60 + Number(m[3])
  return m[1] === '-' ? -v : v
}

/** Момент времени 00:00 по Киеву для даты y-m-d (день можно выходить за границы месяца). */
export function kyivStart(y: number, m: number, d: number): Date {
  const base = Date.UTC(y, m - 1, d)
  let t = base
  for (let i = 0; i < 2; i++) t = base - offsetMinutes(new Date(t)) * 60_000
  return new Date(t)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-10-21" — ключ дня по Киеву */
export function dayKey(date: Date | string): string {
  const p = kyivParts(date)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

export function monthKey(date: Date | string): string {
  const p = kyivParts(date)
  return `${p.y}-${pad(p.m)}-01`
}

/** Начало месяца (сдвиг в месяцах от текущего) */
export function monthRange(offset = 0, now = new Date()): { from: Date; to: Date; key: string } {
  const p = kyivParts(now)
  const total = p.y * 12 + (p.m - 1) + offset
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return {
    from: kyivStart(y, m, 1),
    to: kyivStart(y, m + 1, 1),
    key: `${y}-${pad(m)}-01`,
  }
}

/** Начало недели (пн) со сдвигом в неделях от текущей */
export function weekRange(offset = 0, now = new Date()): { from: Date; to: Date } {
  const p = kyivParts(now)
  const startDay = p.d - p.weekday + offset * 7
  return { from: kyivStart(p.y, p.m, startDay), to: kyivStart(p.y, p.m, startDay + 7) }
}

const dayFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const monthFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, month: 'long', year: 'numeric' })

export const formatTime = (d: Date | string) => timeFmt.format(new Date(d))

export function formatMonth(d: Date | string): string {
  return monthFmt.format(new Date(d))
}

/** "Сегодня" / "Вчера" / "21 октября" */
export function formatDayLabel(key: string): string {
  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 24 * 3600 * 1000))
  if (key === today) return 'Сегодня'
  if (key === yesterday) return 'Вчера'
  const [y, m, d] = key.split('-').map(Number)
  return dayFmt.format(kyivStart(y, m, d))
}

/** Для input[type=date]: сегодня по Киеву */
export const todayInputValue = () => dayKey(new Date())

/** Дата из input[type=date] → момент. Сегодня = сейчас, другой день = полдень по Киеву. */
export function inputDateToInstant(value: string): Date {
  if (value === dayKey(new Date())) return new Date()
  const [y, m, d] = value.split('-').map(Number)
  return new Date(kyivStart(y, m, d).getTime() + 12 * 3600 * 1000)
}
