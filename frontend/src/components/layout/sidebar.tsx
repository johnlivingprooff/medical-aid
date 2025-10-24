import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, FileCheck2, BadgePercent, Users2, Building2, BarChart3, FileText, Bell, Settings, ShieldCheck, FileCode, Activity, ChevronLeft, ChevronRight 
} from 'lucide-react'
import logo from '@/assets/icon.ico'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/claims', label: 'Claims', icon: FileCheck2 },
  { to: '/schemes', label: 'Schemes', icon: BadgePercent },
  { to: '/members', label: 'Members', icon: Users2 },
  { to: '/providers', label: 'Providers', icon: Building2 },
  { to: '/provider-network', label: 'Network Health', icon: Activity },
  { to: '/edi-transactions', label: 'EDI Transactions', icon: FileCode },
  { to: '/credentialing', label: 'Credentialing', icon: ShieldCheck },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
]

import { useAuth } from '@/components/auth/auth-context'

export function Sidebar() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const role = user?.role || 'GUEST'
  const allowed = new Set<string>(
    role === 'ADMIN' ? nav.map(n => n.to) :
  role === 'PROVIDER' ? ['/', '/claims', '/members', '/credentialing'] :
  role === 'PATIENT' ? ['/', '/claims'] :
    []
  )
  return (
    <aside className={cn(
      "sticky top-0 hidden h-screen shrink-0 border-r border-border bg-card/50 shadow-sm md:block transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className={cn(
        "flex h-14 items-center gap-2 border-b border-border",
        collapsed ? "justify-center px-2" : "px-3"
      )}>
        {!collapsed && (
          <>
            <img src={logo} alt="Alo-Medical" style={{ width: 40 }} />
            <div>
              <div className="text-sm font-semibold leading-5">Alo‑Medical</div>
              <div className="text-xs text-muted-foreground leading-4">Med‑Aid Admin</div>
            </div>
          </>
        )}
        {collapsed && (
          <img src={logo} alt="Alo-Medical" style={{ width: 32 }} />
        )}
      </div>
      <nav className={cn(
        "mt-2 flex flex-col gap-1",
        collapsed ? "px-2" : "px-2"
      )}>
        <TooltipProvider delayDuration={0}>
          {nav.filter(item => allowed.has(item.to)).map((item) => (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive && 'bg-muted text-foreground',
                      collapsed && 'justify-center px-0'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="bg-muted text-foreground border-border">
                  {item.label}
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>
      <div className={cn(
        "absolute bottom-4 left-0 right-0 flex",
        collapsed ? "justify-center px-2" : "justify-end px-3"
      )}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}
