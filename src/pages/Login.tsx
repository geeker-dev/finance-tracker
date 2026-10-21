import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// Вход по email и паролю. Сессия хранится долго (refresh token), так что вводить пароль
// нужно один раз на устройство. Регистрация нужна только для первого запуска —
// после создания аккаунта её отключают в настройках Supabase.
export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setError(translate(error.message))
    } else {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) setError(translate(error.message))
      else if (!data.session) setInfo('Аккаунт создан. Подтверди почту по ссылке из письма и войди.')
    }
    setBusy(false)
  }

  return (
    <div
      className="app-bg flex min-h-dvh flex-col justify-center px-6"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto w-full max-w-sm">
        <img src="/favicon.svg" alt="" className="mb-6 h-14 w-14 rounded-2xl" />
        <h1 className="text-3xl font-bold">Мои финансы</h1>
        <p className="mt-2 text-muted">
          {mode === 'signin'
            ? 'Войди один раз — дальше приложение откроется сразу.'
            : 'Первый запуск: создай аккаунт.'}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="Пароль (минимум 8 символов)"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="btn btn-primary w-full" disabled={busy || !email || password.length < 8}>
            {busy ? 'Подожди…' : mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-muted"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setInfo(null)
          }}
        >
          {mode === 'signin' ? 'Первый запуск? Создать аккаунт' : 'Уже есть аккаунт? Войти'}
        </button>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        {info && <p className="mt-4 text-sm text-ok">{info}</p>}
      </div>
    </div>
  )
}

function translate(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Неверная почта или пароль'
  if (m.includes('already registered')) return 'Такой аккаунт уже есть — нажми «Войти»'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Регистрация отключена'
  if (m.includes('email not confirmed')) return 'Почта не подтверждена — открой ссылку из письма'
  if (m.includes('rate limit')) return 'Слишком много попыток, попробуй позже'
  return message
}
