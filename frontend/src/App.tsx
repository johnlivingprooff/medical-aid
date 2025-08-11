import { AppShell } from '@/components/layout/app-shell'
import { AppRoutes } from '@/routes'
import { AuthProvider } from '@/components/auth/auth-context'
import { useLocation } from 'react-router-dom'

export default function App() {
  const location = useLocation()
  const isLogin = location.pathname === '/login'
  return (
    <AuthProvider>
      {isLogin ? (
        <AppRoutes />
      ) : (
        <AppShell>
          <AppRoutes />
        </AppShell>
      )}
    </AuthProvider>
  )
}
