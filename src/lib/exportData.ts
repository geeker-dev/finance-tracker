import { supabase } from './supabase'

const TABLES = ['accounts', 'categories', 'transactions', 'budgets', 'goals', 'tags', 'transaction_tags'] as const

/** Скачивает все данные пользователя одним JSON-файлом (ручной бэкап). */
export async function exportAllData(): Promise<void> {
  const result: Record<string, unknown> = { exported_at: new Date().toISOString() }
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select('*')
    if (error) throw new Error(`${t}: ${error.message}`)
    result[t] = data
  }
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance-export-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
