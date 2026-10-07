import { lazy, Suspense } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LoginPage }          from '@/pages/auth/LoginPage'
import { SignupPage }          from '@/pages/auth/SignupPage'
import { ForgotPasswordPage }  from '@/pages/auth/ForgotPasswordPage'
import { DashboardPage }       from '@/pages/dashboard/DashboardPage'
import { JoinPage }            from '@/pages/JoinPage'
import { NotFoundPage }        from '@/pages/NotFoundPage'
import { useAuthContext }      from '@/app/providers/AuthProvider'

const EditorPageLazy = lazy(() => import('@/pages/editor/EditorPage').then((m) => ({ default: m.EditorPage })))

function PageLoader() {
  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center font-mono text-xs gap-3">
      <span className="material-symbols-outlined text-primary text-[32px] animate-spin">sync</span>
      <span className="text-outline uppercase tracking-widest">Loading LiveLoom…</span>
    </div>
  )
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuthContext()
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }
  return children
}

function RequireGuest({ children }) {
  const { isAuthenticated } = useAuthContext()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const returnTo = params.get('returnTo') ?? '/dashboard'
  return isAuthenticated ? <Navigate to={returnTo} replace /> : children
}

export const routes = [
  { path: '/',                element: <Navigate to="/dashboard" replace /> },
  { path: '/login',           element: <RequireGuest><LoginPage /></RequireGuest> },
  { path: '/signup',          element: <RequireGuest><SignupPage /></RequireGuest> },
  { path: '/forgot-password', element: <RequireGuest><ForgotPasswordPage /></RequireGuest> },
  { path: '/dashboard',       element: <RequireAuth><DashboardPage /></RequireAuth> },
  {
    path: '/room/:roomId',
    element: (
      <RequireAuth>
        <Suspense fallback={<PageLoader />}>
          <EditorPageLazy />
        </Suspense>
      </RequireAuth>
    ),
  },
  { path: '/join/:token',     element: <JoinPage /> },
  { path: '*',                element: <NotFoundPage /> },
]
