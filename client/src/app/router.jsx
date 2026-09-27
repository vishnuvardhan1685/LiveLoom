import { Navigate } from 'react-router-dom'
import { LoginPage }          from '@/pages/auth/LoginPage'
import { SignupPage }          from '@/pages/auth/SignupPage'
import { ForgotPasswordPage }  from '@/pages/auth/ForgotPasswordPage'
import { DashboardPage }       from '@/pages/dashboard/DashboardPage'
import { EditorPage }          from '@/pages/editor/EditorPage'
import { useAuthContext }      from '@/app/providers/AuthProvider'

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuthContext()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function RequireGuest({ children }) {
  const { isAuthenticated } = useAuthContext()
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children
}

export const routes = [
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login',           element: <RequireGuest><LoginPage /></RequireGuest> },
  { path: '/signup',          element: <RequireGuest><SignupPage /></RequireGuest> },
  { path: '/forgot-password', element: <RequireGuest><ForgotPasswordPage /></RequireGuest> },
  { path: '/dashboard',       element: <RequireAuth><DashboardPage /></RequireAuth> },
  { path: '/room/:roomId',    element: <RequireAuth><EditorPage /></RequireAuth> },
]
