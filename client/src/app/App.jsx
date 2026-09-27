import { BrowserRouter, useRoutes } from 'react-router-dom'
import { AuthProvider }   from '@/app/providers/AuthProvider'
import { YjsProvider }    from '@/app/providers/YjsProvider'
import { SocketProvider } from '@/app/providers/SocketProvider'
import { routes }         from '@/app/router'

function AppRoutes() {
  return useRoutes(routes)
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <YjsProvider>
          <SocketProvider>
            <AppRoutes />
          </SocketProvider>
        </YjsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
