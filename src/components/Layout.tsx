import { NavLink, Outlet } from 'react-router-dom'
import { useAddSheet } from './AddTransactionSheet'

const ITEMS = [
  { to: '/', label: 'Главная', icon: '🏠', end: true },
  { to: '/history', label: 'История', icon: '🕘', end: false },
  { to: '/stats', label: 'Статистика', icon: '📊', end: false },
  { to: '/more', label: 'Ещё', icon: '⚙️', end: false },
]

export default function Layout() {
  const { open } = useAddSheet()

  const link = (i: (typeof ITEMS)[number]) => (
    <NavLink
      key={i.to}
      to={i.to}
      end={i.end}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
          isActive ? 'text-white' : 'text-muted'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`text-xl ${isActive ? '' : 'opacity-60 grayscale'}`}>{i.icon}</span>
          {i.label}
        </>
      )}
    </NavLink>
  )

  return (
    <div className="app-bg min-h-dvh">
      <main
        className="mx-auto max-w-md px-5"
        style={{
          paddingTop: 'calc(var(--safe-top) + 16px)',
          paddingBottom: 'calc(var(--safe-bottom) + 120px)',
        }}
      >
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}
      >
        <div className="glass flex items-center rounded-[28px] px-2" style={{ background: 'rgb(13 20 36 / 0.85)' }}>
          {ITEMS.slice(0, 2).map(link)}
          <button
            aria-label="Добавить операцию"
            onClick={() => open('expense')}
            className="-mt-6 flex h-14 w-14 flex-none items-center justify-center rounded-full bg-lime text-3xl font-light text-black shadow-lg shadow-lime/20 active:scale-95"
          >
            +
          </button>
          {ITEMS.slice(2).map(link)}
        </div>
      </nav>
    </div>
  )
}
