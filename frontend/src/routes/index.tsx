import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/components/auth/auth-context'

// Lazy load page components for code splitting
const Dashboard = lazy(() => import('@/pages/dashboard'))
const Claims = lazy(() => import('@/pages/claims'))
const Schemes = lazy(() => import('@/pages/schemes'))
const SchemeDetails = lazy(() => import('@/pages/scheme-details'))
const Providers = lazy(() => import('@/pages/providers'))
const Members = lazy(() => import('@/pages/members'))
const Analytics = lazy(() => import('@/pages/analytics'))
const Reports = lazy(() => import('@/pages/reports'))
const Alerts = lazy(() => import('@/pages/alerts'))
const Settings = lazy(() => import('@/pages/settings'))
const Admin = lazy(() => import('@/pages/admin'))
const SubscriptionTiersAdmin = lazy(() => import('@/pages/subscription-tiers-admin'))
const Login = lazy(() => import('@/pages/login'))

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
)

function RoleRoute({ allow, children }: { allow: string[]; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!allow.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
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
          <Route path="/admin/subscription-tiers" element={<RoleRoute allow={["ADMIN"]}><SubscriptionTiersAdmin /></RoleRoute>} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
