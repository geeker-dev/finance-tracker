import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// Вход по 6-значному коду из письма. Ссылки не используем: на iPhone они открываются
// в Safari, а не в установленном на экран «Домой» приложении.
export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    if (error) return setError(error.message)
    setStep('code')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) setError('Неверный или просроченный код')
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
          {step === 'email'
            ? 'Введи почту — пришлём код для входа. Делаешь это один раз.'
            : `Код отправлен на ${email}. Введи 6 цифр из письма.`}
        </p>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="mt-8 space-y-4">
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn btn-primary w-full" disabled={busy || !email}>
              {busy ? 'Отправляем…' : 'Получить код'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-8 space-y-4">
            <input
              className="input text-center text-2xl tracking-[0.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="······"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
            <button className="btn btn-primary w-full" disabled={busy || code.length < 6}>
              {busy ? 'Проверяем…' : 'Войти'}
            </button>
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
            >
              Изменить почту
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      </div>
    </div>
  )
}
