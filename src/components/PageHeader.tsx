import { useNavigate } from 'react-router-dom'

export default function PageHeader({ title }: { title: string }) {
  const navigate = useNavigate()
  return (
    <header className="mb-5 flex items-center gap-3">
      <button
        aria-label="Назад"
        onClick={() => navigate(-1)}
        className="glass flex h-10 w-10 items-center justify-center rounded-full text-xl"
      >
        ‹
      </button>
      <h1 className="text-2xl font-bold">{title}</h1>
    </header>
  )
}
