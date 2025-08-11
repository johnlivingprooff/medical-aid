import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from '@/pages/dashboard'
import Claims from '@/pages/claims'
import Schemes from '@/pages/schemes'
import Providers from '@/pages/providers'
import Members from '@/pages/members'
import Analytics from '@/pages/analytics'
import Reports from '@/pages/reports'
import Alerts from '@/pages/alerts'
import Settings from '@/pages/settings'
import Admin from '@/pages/admin'
import Login from '@/pages/login'
import { ProtectedRoute } from '@/components/auth/protected-route'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/claims" element={<Claims />} />
        <Route path="/schemes" element={<Schemes />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/members" element={<Members />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
