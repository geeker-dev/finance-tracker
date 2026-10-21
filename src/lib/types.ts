export type Currency = 'UAH' | 'USD' | 'USDT'
export const CURRENCIES: Currency[] = ['UAH', 'USD', 'USDT']

export type AccountType = 'cash' | 'card' | 'savings' | 'crypto'
export type TxKind = 'income' | 'expense' | 'transfer' | 'adjustment'

export interface Account {
  id: string
  name: string
  currency: Currency
  type: AccountType
  icon: string | null
  color: string | null
  sort_order: number
  archived: boolean
  created_at: string
}

export interface AccountWithBalance extends Account {
  balance_minor: number
}

export interface Category {
  id: string
  name: string
  kind: 'income' | 'expense'
  icon: string | null
  color: string | null
  parent_id: string | null
  sort_order: number
  archived: boolean
}

export interface Transaction {
  id: string
  kind: TxKind
  account_id: string
  to_account_id: string | null
  amount_minor: number
  to_amount_minor: number | null
  category_id: string | null
  note: string | null
  occurred_at: string
  created_at: string
}

export interface Budget {
  id: string
  category_id: string
  month: string // YYYY-MM-01
  limit_minor: number
  currency: Currency
}

export interface Goal {
  id: string
  name: string
  account_id: string
  target_minor: number
  deadline: string | null
}
