import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastKind = 'ok' | 'error' | 'warn'
interface ToastItem {
  id: number
  text: string
  kind: ToastKind
  action?: { label: string; run: () => void }
}

interface ToastApi {
  show: (text: string, kind?: ToastKind, action?: ToastItem['action'], ms?: number) => void
}

const Ctx = createContext<ToastApi>({ show: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback<ToastApi['show']>((text, kind = 'ok', action, ms = 3500) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text, kind, action }])
    if (!action) setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), ms)
  }, [])

  const dismiss = (id: number) => setItems((x) => x.filter((i) => i.id !== id))

  const color: Record<ToastKind, string> = {
    ok: 'border-ok/40',
    error: 'border-danger/60',
    warn: 'border-amber-400/60',
  }

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4"
        style={{ top: 'calc(var(--safe-top) + 12px)' }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`glass pointer-events-auto flex max-w-md items-center gap-3 px-4 py-3 text-sm ${color[t.kind]}`}
            style={{ background: 'rgb(13 20 36 / 0.92)' }}
          >
            <span>{t.text}</span>
            {t.action && (
              <button
                className="font-semibold text-primary-2"
                onClick={() => {
                  t.action?.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
