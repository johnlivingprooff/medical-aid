import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from '@/pages/dashboard'
import Claims from '@/pages/claims'
import Schemes from '@/pages/schemes'
import SchemeDetails from '@/pages/scheme-details'
import Providers from '@/pages/providers'
import Members from '@/pages/members'
import Analytics from '@/pages/analytics'
import Reports from '@/pages/reports'
import Alerts from '@/pages/alerts'
import Settings from '@/pages/settings'
import Admin from '@/pages/admin'
import Login from '@/pages/login'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/components/auth/auth-context'

function RoleRoute({ allow, children }: { allow: string[]; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!allow.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/claims" element={<Claims />} />
        <Route path="/schemes" element={<RoleRoute allow={["ADMIN"]}><Schemes /></RoleRoute>} />
        <Route path="/schemes/:id" element={<RoleRoute allow={["ADMIN"]}><SchemeDetails /></RoleRoute>} />
        <Route path="/providers" element={<RoleRoute allow={["ADMIN","PROVIDER"]}><Providers /></RoleRoute>} />
        <Route path="/members" element={<RoleRoute allow={["ADMIN"]}><Members /></RoleRoute>} />
        <Route path="/analytics" element={<RoleRoute allow={["ADMIN"]}><Analytics /></RoleRoute>} />
        <Route path="/reports" element={<RoleRoute allow={["ADMIN"]}><Reports /></RoleRoute>} />
  <Route path="/alerts" element={<Alerts />} />
  <Route path="/settings" element={<RoleRoute allow={["ADMIN"]}><Settings /></RoleRoute>} />
        <Route path="/admin" element={<RoleRoute allow={["ADMIN"]}><Admin /></RoleRoute>} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
