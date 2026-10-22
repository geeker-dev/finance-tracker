import { supabase } from './supabase'

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** На iPhone пуши работают только у приложения, добавленного на экран «Домой». */
export function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function urlBase64ToBytes(b64: string) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function callPush<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('push', { body })
  if (error) {
    // у FunctionsHttpError тело ответа с описанием ошибки лежит в context
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json().catch(() => null)
      if (j?.error) throw new Error(String(j.error))
    }
    throw new Error('Сервер уведомлений недоступен. Проверь, что функция push развёрнута.')
  }
  return data as T
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('Этот браузер не поддерживает уведомления')
  // запрос разрешения обязан идти первым и прямо из нажатия, иначе iOS его проигнорирует
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Разрешение не выдано. Включи уведомления в настройках iPhone.')

  const { publicKey } = await callPush<{ publicKey: string }>({ action: 'public-key' })
  const reg = await navigator.serviceWorker.ready
  // старая подписка могла быть создана с другим ключом сервера
  const old = await reg.pushManager.getSubscription()
  if (old) await old.unsubscribe()
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBytes(publicKey),
  })

  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) throw new Error('Не удалось получить данные подписки')
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: json.endpoint, p256dh, auth }, { onConflict: 'endpoint' })
  if (error) throw error
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestPush() {
  return callPush<{ sent: number; failed: number; errors?: string[] }>({ action: 'test' })
}
