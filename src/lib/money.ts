import type { Currency } from './types'

// Все валюты хранятся с двумя знаками после запятой.
const SYMBOL: Record<Currency, string> = { UAH: '₴', USD: '$', USDT: '₮' }

export function currencySymbol(c: Currency): string {
  return SYMBOL[c]
}

const nf = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const nfInt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

/** 123456 -> "1 234,56" */
export function formatAmount(minor: number): string {
  return nf.format(minor / 100)
}

/** 123456, 'UAH' -> "1 234,56 ₴" */
export function formatMoney(minor: number, c: Currency, opts?: { sign?: boolean }): string {
  const sign = opts?.sign ? (minor > 0 ? '+' : minor < 0 ? '−' : '') : minor < 0 ? '−' : ''
  return `${sign}${nf.format(Math.abs(minor) / 100)} ${SYMBOL[c]}`
}

/** Без копеек — для крупных сумм в статистике */
export function formatMoneyShort(minor: number, c: Currency): string {
  const sign = minor < 0 ? '−' : ''
  return `${sign}${nfInt.format(Math.abs(minor) / 100)} ${SYMBOL[c]}`
}

/**
 * "12,5" / "12.50" / "1 200" -> 1250 / 1250 / 120000.
 * Возвращает null, если ввод некорректен.
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return null
  const [int, frac = ''] = s.replace('-', '').split('.')
  const minor = Number(int) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(minor)) return null
  return s.startsWith('-') ? -minor : minor
}
