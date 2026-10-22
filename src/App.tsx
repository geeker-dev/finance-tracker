import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AddSheetProvider } from './components/AddTransactionSheet'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import UpdatePrompt from './components/UpdatePrompt'
import { isConfigured } from './lib/supabase'
import Accounts from './pages/Accounts'
import Budgets from './pages/Budgets'
import Goals from './pages/Goals'
import History from './pages/History'
import Home from './pages/Home'
import Login from './pages/Login'
import More from './pages/More'
import Notifications from './pages/Notifications'
import Stats from './pages/Stats'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // кэш чтения живёт неделю — приложение открывается и без сети
      retry: 1,
    },
  },
})

// Офлайн (MVP): только кэш чтения в IndexedDB. Записи требуют сети.
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => get<string>(k).then((v) => v ?? null),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
  key: 'finance-cache-v1',
})

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <div className="app-bg min-h-dvh" />
  if (!session) return <Login />
  return (
    <AddSheetProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="history" element={<History />} />
          <Route path="stats" element={<Stats />} />
          <Route path="more" element={<More />} />
          <Route path="more/accounts" element={<Accounts />} />
          <Route path="more/budgets" element={<Budgets />} />
          <Route path="more/goals" element={<Goals />} />
          <Route path="more/notifications" element={<Notifications />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AddSheetProvider>
  )
}

function SetupMissing() {
  return (
    <div className="app-bg flex min-h-dvh items-center px-6">
      <div className="glass mx-auto max-w-sm p-6">
        <h1 className="text-xl font-bold">Не настроен Supabase</h1>
        <p className="mt-2 text-muted">
          Создай файл <code>.env</code> по образцу <code>.env.example</code> и укажи{' '}
          <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <SetupMissing />
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Gate />
            <UpdatePrompt />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </PersistQueryClientProvider>
  )
}
