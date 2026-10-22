import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported, sendTestPush } from '../lib/push'
import { supabase } from '../lib/supabase'

interface Settings {
  enabled: boolean
  reminder_hour: number
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)

export default function Notifications() {
  const { session } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [subscribed, setSubscribed] = useState<boolean | null>(pushSupported() ? null : false)
  const [busy, setBusy] = useState(false)

  const supported = pushSupported()
  const needInstall = isIos() && !isStandalone()

  useEffect(() => {
    if (!supported) return
    currentSubscription().then((s) => setSubscribed(Boolean(s)), () => setSubscribed(false))
  }, [supported])

  const settings = useQuery({
    queryKey: ['push_settings'],
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from('push_settings').select('enabled,reminder_hour').maybeSingle()
      if (error) throw error
      return data ?? { enabled: true, reminder_hour: 21 }
    },
  })
  const s = settings.data ?? { enabled: true, reminder_hour: 21 }

  async function saveSettings(next: Settings) {
    const uid = session?.user.id
    if (!uid) return
    qc.setQueryData(['push_settings'], next)
    const { error } = await supabase
      .from('push_settings')
      .upsert({ user_id: uid, ...next, updated_at: new Date().toISOString() })
    if (error) {
      toast.show(error.message, 'error')
      qc.invalidateQueries({ queryKey: ['push_settings'] })
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Не получилось', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggle = () =>
    run(async () => {
      if (subscribed) {
        await disablePush()
        setSubscribed(false)
        toast.show('Уведомления выключены на этом устройстве')
      } else {
        await enablePush()
        // при первом включении сразу сохраняем настройки по умолчанию, чтобы cron знал о пользователе
        await saveSettings(s)
        setSubscribed(true)
        toast.show('Уведомления включены')
      }
    })

  const test = () =>
    run(async () => {
      const r = await sendTestPush()
      if (r.sent > 0) toast.show('Отправлено, уведомление скоро придёт')
      else toast.show(r.errors?.[0] ?? 'Не удалось отправить', 'error')
    })

  return (
    <div>
      <PageHeader title="Напоминания" />

      {needInstall && (
        <div className="glass mb-4 p-4 text-sm">
          На iPhone уведомления работают только в приложении с экрана «Домой». Открой сайт в Safari, нажми «Поделиться» →
          «На экран “Домой”», запусти оттуда и вернись на эту страницу.
        </div>
      )}
      {!supported && !needInstall && (
        <div className="glass mb-4 p-4 text-sm">Этот браузер не поддерживает уведомления.</div>
      )}

      <div className="glass space-y-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="font-semibold">Уведомления на этом устройстве</div>
            <div className="text-sm text-muted">
              {subscribed === null ? 'Проверяю…' : subscribed ? 'Включены' : 'Выключены'}
            </div>
          </div>
          <button
            className={subscribed ? 'btn btn-ghost' : 'btn btn-primary'}
            disabled={busy || !supported || needInstall || subscribed === null}
            onClick={toggle}
          >
            {subscribed ? 'Выключить' : 'Включить'}
          </button>
        </div>

        <div className="border-t border-white/10 pt-4">
          <label className="flex items-center gap-3">
            <span className="flex-1">
              <span className="block font-semibold">Вечернее напоминание</span>
              <span className="block text-sm text-muted">Придёт, только если за сегодня нет ни одной операции</span>
            </span>
            <input
              type="checkbox"
              className="h-6 w-6 accent-[var(--color-accent,#4f8cff)]"
              checked={s.enabled}
              onChange={(e) => saveSettings({ ...s, enabled: e.target.checked })}
            />
          </label>

          <label className="mt-4 flex items-center gap-3">
            <span className="flex-1 font-semibold">Время (Киев)</span>
            <select
              className="input w-28"
              value={s.reminder_hour}
              disabled={!s.enabled}
              onChange={(e) => saveSettings({ ...s, reminder_hour: Number(e.target.value) })}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>
        </div>

        {subscribed && (
          <button className="btn btn-ghost w-full" disabled={busy} onClick={test}>
            Отправить тестовое уведомление
          </button>
        )}
      </div>
    </div>
  )
}
