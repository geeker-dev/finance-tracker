import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

// В клиенте используется только публичный anon key; доступ к данным защищён RLS.
export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // вход по коду из письма, ссылки не используются
    detectSessionInUrl: false,
  },
})
