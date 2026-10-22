// Supabase Edge Function «push».
//
// Действия (поле action в JSON):
//   public-key      — публичный ключ VAPID для подписки в браузере (при первом вызове ключи создаются)
//   test            — тестовое уведомление для текущего пользователя (нужен токен входа)
//   send-reminders  — вечерние напоминания; вызывается из pg_cron, защищено секретом x-cron-secret
//
// Функция развёрнута без проверки JWT на уровне платформы (--no-verify-jwt): публичный ключ не секрет,
// а остальные действия проверяют доступ сами.
import { createClient } from '@supabase/supabase-js'
import { deliver, generateVapidKeys, safeEqual, type StoredSubscription } from './core.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// В VAPID нужен контакт отправителя: mailto: или https-адрес. По умолчанию — адрес проекта.
const SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? SUPABASE_URL

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

interface Config {
  vapid_public: string
  vapid_private: string
  cron_secret: string
}

async function readConfig() {
  const { data, error } = await db
    .from('push_config')
    .select('vapid_public,vapid_private,cron_secret')
    .eq('id', true)
    .maybeSingle()
  if (error) throw new Error(`push_config: ${error.message}`)
  if (!data) throw new Error('Таблица push_config пуста: выполни миграцию 0003_push.sql')
  return data as { vapid_public: string | null; vapid_private: string | null; cron_secret: string }
}

/** Возвращает настройки; при первом запуске сам создаёт ключи VAPID. */
async function getConfig(): Promise<Config> {
  let cfg = await readConfig()
  if (!cfg.vapid_public || !cfg.vapid_private) {
    const keys = await generateVapidKeys()
    // условие is null защищает от гонки: если параллельный запрос уже записал ключи, мы их не затираем
    await db
      .from('push_config')
      .update({ vapid_public: keys.publicKey, vapid_private: keys.privateKey })
      .eq('id', true)
      .is('vapid_public', null)
    cfg = await readConfig()
  }
  return cfg as Config
}

async function subscriptionsFor(userIds: string[]): Promise<StoredSubscription[]> {
  if (userIds.length === 0) return []
  const { data, error } = await db
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .in('user_id', userIds)
  if (error) throw new Error(`push_subscriptions: ${error.message}`)
  return (data ?? []) as StoredSubscription[]
}

async function removeGone(ids: string[]) {
  if (ids.length === 0) return
  await db.from('push_subscriptions').delete().in('id', ids)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const action = (body as { action?: string })?.action
    const cfg = await getConfig()
    const vapid = { publicKey: cfg.vapid_public, privateKey: cfg.vapid_private }

    if (action === 'public-key') {
      return json({ publicKey: cfg.vapid_public })
    }

    if (action === 'test') {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      const { data, error } = await db.auth.getUser(token)
      if (error || !data?.user) return json({ error: 'Нужно войти в приложение' }, 401)

      const subs = await subscriptionsFor([data.user.id])
      if (subs.length === 0) return json({ sent: 0, failed: 0, removed: 0, errors: ['Нет подписанных устройств'] })

      const result = await deliver(
        subs,
        { title: 'Мои финансы', body: 'Уведомления работают 🎉', url: '/', tag: 'test' },
        vapid,
        SUBJECT,
      )
      await removeGone(result.goneIds)
      return json({ sent: result.sent, failed: result.failed, removed: result.removed, errors: result.errors })
    }

    if (action === 'send-reminders') {
      const provided = req.headers.get('x-cron-secret') ?? ''
      if (!safeEqual(provided, cfg.cron_secret)) return json({ error: 'forbidden' }, 403)

      const { data, error } = await db.rpc('users_due_for_reminder')
      if (error) throw new Error(`users_due_for_reminder: ${error.message}`)
      // setof uuid приходит массивом строк; на всякий случай поддерживаем и массив объектов
      const userIds = ((data ?? []) as unknown[]).map((row) =>
        typeof row === 'string' ? row : String(Object.values(row as Record<string, unknown>)[0]),
      )

      const subs = await subscriptionsFor(userIds)
      const result = await deliver(
        subs,
        {
          title: 'Мои финансы',
          body: 'Сегодня ещё нет операций. Внеси траты, пока не забыл 💸',
          url: '/',
          tag: 'daily-reminder',
        },
        vapid,
        SUBJECT,
      )
      await removeGone(result.goneIds)
      return json({ users: userIds.length, sent: result.sent, failed: result.failed, removed: result.removed })
    }

    return json({ error: 'Неизвестное действие' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
