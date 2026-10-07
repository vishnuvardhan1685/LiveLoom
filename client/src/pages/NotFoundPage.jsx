import { useNavigate } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Not found')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center p-6 text-center font-mono select-none">
      <div className="w-16 h-16 mb-4 bg-surface-container-high border border-surface-variant flex items-center justify-center text-primary">
        <span className="material-symbols-outlined text-[32px]">extension_off</span>
      </div>
      <span className="text-xs text-outline tracking-widest uppercase mb-2">404 — NOT FOUND</span>
      <h1 className="text-2xl font-bold font-sans text-on-surface mb-3">Page not found</h1>
      <p className="text-xs text-outline max-w-sm mb-6 leading-relaxed">
        The route you are trying to access does not exist or may have been moved.
      </p>
      <button
        onClick={() => navigate('/dashboard')}
        className="ll-btn ll-btn-primary text-xs min-h-[40px] px-5"
      >
        ← BACK TO DASHBOARD
      </button>
    </div>
  )
}
