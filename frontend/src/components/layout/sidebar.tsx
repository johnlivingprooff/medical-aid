import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, FileCheck2, BadgePercent, Users2, Building2, BarChart3, FileText, Bell, Settings, ShieldCheck 
} from 'lucide-react'
import logo from '@/assets/icon.ico'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/claims', label: 'Claims', icon: FileCheck2 },
  { to: '/schemes', label: 'Schemes', icon: BadgePercent },
  { to: '/members', label: 'Members', icon: Users2 },
  { to: '/providers', label: 'Providers', icon: Building2 },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
]

import { useAuth } from '@/components/auth/auth-context'

export function Sidebar() {
  const { user } = useAuth()
  const role = user?.role || 'GUEST'
  const allowed = new Set<string>(
    role === 'ADMIN' ? nav.map(n => n.to) :
  role === 'PROVIDER' ? ['/', '/claims', '/providers', '/alerts'] :
  role === 'PATIENT' ? ['/', '/claims'] :
    []
  )
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-card/50 shadow-sm md:block">
      <div className="flex h-14 items-center gap-2 px-3">
        {/* <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground font-semibold">A</div> */}
        <img src={logo} alt="Alo-Medical" style={{ width: 40 }} />
        <div>
          <div className="text-sm font-semibold leading-5">Alo‑Medical</div>
          <div className="text-xs text-muted-foreground leading-4">Med‑Aid Admin</div>
        </div>
      </div>
      <nav className="mt-2 flex flex-col gap-1 px-2">
  {nav.filter(item => allowed.has(item.to)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive && 'bg-muted text-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
