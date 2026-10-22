// Логика отправки пушей без привязки к Supabase и Deno: так её можно проверить обычным Node.
import webpush from 'web-push'

export interface VapidKeys {
  publicKey: string
  privateKey: string
}

export interface StoredSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export type SendResult =
  | { ok: true }
  | { ok: false; gone: boolean; status?: number; error: string }

export function bytesToB64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlToBytes(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Ключи VAPID: пара ECDSA P-256. Публичный ключ для браузера — 65 байт (0x04 || X || Y),
 * приватный — 32 байта (параметр d из JWK), оба в base64url.
 */
export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  if (!jwk.x || !jwk.y || !jwk.d) throw new Error('Не удалось получить ключи VAPID')
  const x = b64urlToBytes(jwk.x)
  const y = b64urlToBytes(jwk.y)
  const pub = new Uint8Array(65)
  pub[0] = 4
  pub.set(x, 1)
  pub.set(y, 33)
  return { publicKey: bytesToB64url(pub), privateKey: jwk.d }
}

export async function sendPush(
  sub: Pick<StoredSubscription, 'endpoint' | 'p256dh' | 'auth'>,
  payload: PushPayload,
  vapid: VapidKeys,
  subject: string,
): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: { subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        TTL: 60 * 60 * 12, // если устройство офлайн, напоминание живёт 12 часов
        urgency: 'normal',
      },
    )
    return { ok: true }
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string }
    const status = typeof err.statusCode === 'number' ? err.statusCode : undefined
    return {
      ok: false,
      // 404 и 410: подписка больше не существует (приложение удалено или разрешение отозвано)
      gone: status === 404 || status === 410,
      status,
      error: String(err.body || err.message || e).slice(0, 300),
    }
  }
}

export interface DeliverySummary {
  sent: number
  failed: number
  removed: number
  errors: string[]
  goneIds: string[]
}

/** Отправляет сообщение на все подписки и возвращает итог, включая подписки для удаления. */
export async function deliver(
  subs: StoredSubscription[],
  payload: PushPayload,
  vapid: VapidKeys,
  subject: string,
): Promise<DeliverySummary> {
  const summary: DeliverySummary = { sent: 0, failed: 0, removed: 0, errors: [], goneIds: [] }
  for (const sub of subs) {
    const res = await sendPush(sub, payload, vapid, subject)
    if (res.ok) {
      summary.sent++
      continue
    }
    summary.failed++
    if (res.gone) summary.goneIds.push(sub.id)
    if (summary.errors.length < 3) summary.errors.push(`${res.status ?? 'ошибка'}: ${res.error}`)
  }
  summary.removed = summary.goneIds.length
  return summary
}

/** Сравнение секретов за постоянное время, чтобы не подсказывать по времени ответа. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
