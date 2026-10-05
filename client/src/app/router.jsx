import { Navigate, useLocation } from 'react-router-dom'
import { LoginPage }          from '@/pages/auth/LoginPage'
import { SignupPage }          from '@/pages/auth/SignupPage'
import { ForgotPasswordPage }  from '@/pages/auth/ForgotPasswordPage'
import { DashboardPage }       from '@/pages/dashboard/DashboardPage'
import { EditorPage }          from '@/pages/editor/EditorPage'
import { JoinPage }            from '@/pages/JoinPage'
import { useAuthContext }      from '@/app/providers/AuthProvider'

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
  { path: '/room/:roomId',    element: <RequireAuth><EditorPage /></RequireAuth> },
  { path: '/join/:token',     element: <JoinPage /> },  // handles its own auth check
]
