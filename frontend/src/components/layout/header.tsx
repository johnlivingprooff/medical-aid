import { Bell, ChevronDown, SunMedium, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '@/lib/auth'
import logo from '@/assets/icon.ico'
import { api } from '@/lib/api'
import { useAuth } from '@/components/auth/auth-context'
import { SearchBar } from '@/components/ui/search-bar'

export function Header() {
  const [dark, setDark] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [alerts, setAlerts] = useState<Array<{ id: number; message: string; severity: string; created_at: string }>>([])
  const [alertsOpen, setAlertsOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const preferDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored ? stored === 'dark' : preferDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  useEffect(() => {
    if (!isAdmin || !alertsOpen) return
    api.get<any>('/api/core/alerts/')
      .then((resp) => setAlerts(resp.results ?? resp ?? []))
      .catch(() => setAlerts([]))
  }, [isAdmin, alertsOpen])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  function onLogout() {
    logout()
    navigate('/login', { replace: true })
  }
  const initials = (user?.username || '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U'
  const displayName = user?.username || 'User'

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex items-center gap-3 px-4 mx-auto h-14 max-w-7xl">
        <div className="flex items-center gap-2 md:hidden">
          {true
            ? <div className="flex items-center justify-center w-8 h-8 font-semibold rounded-md bg-accent text-accent-foreground">A</div>
            : <img src={logo} alt="Alo-Medical" style={{ width: 50 }} />}
          <span className="text-sm font-semibold">Alo‑Medical</span>
        </div>
        <div className="items-center hidden gap-3 md:flex">
          {/* <div className="flex items-center justify-center w-8 h-8 font-semibold rounded-md bg-accent text-accent-foreground">A</div> */}
          <div className="text-sm font-semibold">Med‑Aid Management Tool</div>
        </div>
        <div className="flex-1" />
        <div className="flex-1 max-w-xl">
          <SearchBar 
            placeholder="Search schemes, claims, members, providers..."
            className="w-full"
            compact={true}
          />
        </div>
        <div className="flex items-center justify-end flex-1 gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggleTheme} aria-pressed={dark}>
                  <SunMedium className="hidden w-5 h-5 dark:block" />
                  <Moon className="w-5 h-5 dark:hidden" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isAdmin && (
            <DropdownMenu open={alertsOpen} onOpenChange={setAlertsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                  <Bell className="w-5 h-5" />
                  {alerts.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">{Math.min(9, alerts.length)}</span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Alerts</div>
                <div className="h-px my-1 bg-border" />
                {alerts.length === 0 ? (
                  <div className="px-2 py-6 text-sm text-center text-muted-foreground">No alerts</div>
                ) : (
                  alerts.slice(0, 6).map((a) => (
                    <DropdownMenuItem key={a.id} className="leading-5 whitespace-normal">
                      <div className="flex items-start gap-2">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${a.severity === 'HIGH' ? 'bg-destructive' : a.severity === 'MEDIUM' ? 'bg-warning' : 'bg-info'}`} />
                        <div>
                          <div className="text-sm">{a.message}</div>
                          <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
                <div className="h-px my-1 bg-border" />
                <DropdownMenuItem onClick={() => navigate('/alerts')}>View all alerts</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm md:inline">{displayName}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/help')}>Help</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
