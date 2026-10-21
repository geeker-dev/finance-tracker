import { useRegisterSW } from 'virtual:pwa-register/react'

// Тост «Доступна новая версия», чтобы не застрять на старом service worker.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // проверяем обновления раз в час, пока приложение открыто
      if (reg) setInterval(() => reg.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      className="fixed inset-x-0 z-[110] flex justify-center px-4"
      style={{ bottom: 'calc(var(--safe-bottom) + 100px)' }}
    >
      <div className="glass flex items-center gap-3 px-4 py-3 text-sm" style={{ background: 'rgb(13 20 36 / 0.95)' }}>
        <span>Доступна новая версия</span>
        <button className="font-semibold text-lime" onClick={() => updateServiceWorker(true)}>
          Обновить
        </button>
      </div>
    </div>
  )
}
