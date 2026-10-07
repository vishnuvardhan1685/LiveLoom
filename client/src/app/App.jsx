import { BrowserRouter, useRoutes } from 'react-router-dom'
import { AuthProvider }   from '@/app/providers/AuthProvider'
import { YjsProvider }    from '@/app/providers/YjsProvider'
import { SocketProvider } from '@/app/providers/SocketProvider'
import { routes }         from '@/app/router'
import { Toaster }        from '@/components/Toast'
import { ErrorBoundary }  from '@/components/ErrorBoundary'
import { ServerWakingScreen } from '@/components/ServerWakingScreen'

function AppRoutes() {
  return useRoutes(routes)
}

export function App() {
  return (
    <ErrorBoundary>
      <ServerWakingScreen>
        <BrowserRouter>
          <AuthProvider>
            <YjsProvider>
              <SocketProvider>
                <AppRoutes />
                {/* Global toast notification portal — must be outside routes */}
                <Toaster />
              </SocketProvider>
            </YjsProvider>
          </AuthProvider>
        </BrowserRouter>
      </ServerWakingScreen>
    </ErrorBoundary>
  )
}
