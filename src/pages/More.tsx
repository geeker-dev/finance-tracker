import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import { exportAllData } from '../lib/exportData'

const LINKS = [
  { to: '/more/accounts', icon: '💳', title: 'Счета', sub: 'Кошельки, карты, накопления' },
  { to: '/more/budgets', icon: '🎯', title: 'Бюджеты', sub: 'Лимиты по категориям на месяц' },
  { to: '/more/notifications', icon: '🔔', title: 'Напоминания', sub: 'Вечерний пуш, если нет операций за день' },
  { to: '/more/goals', icon: '🏁', title: 'Цели накоплений', sub: 'Прогресс по счетам накоплений' },
]

export default function More() {
  const { session } = useAuth()
  const toast = useToast()

  async function onExport() {
    try {
      await exportAllData()
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Не удалось экспортировать', 'error')
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Ещё</h1>

      <div className="space-y-2">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="row flex items-center gap-4 p-4">
            <span className="text-2xl">{l.icon}</span>
            <span className="flex-1">
              <span className="block font-semibold">{l.title}</span>
              <span className="block text-sm text-muted">{l.sub}</span>
            </span>
            <span className="text-muted">›</span>
          </Link>
        ))}
      </div>

      <div className="glass p-4">
        <div className="text-sm text-muted">Аккаунт</div>
        <div className="mt-1 truncate">{session?.user.email}</div>
        <button className="btn btn-ghost mt-4 w-full" onClick={onExport}>
          Экспорт данных (JSON)
        </button>
        <button className="btn btn-ghost mt-3 w-full" onClick={() => supabase.auth.signOut()}>
          Выйти
        </button>
      </div>
    </div>
  )
}
