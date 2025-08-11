import { Bell, ChevronDown, Search, SunMedium, Moon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '@/lib/auth'
import logo from '@/assets/icon.ico'

export function Header() {
  const [dark, setDark] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const preferDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored ? stored === 'dark' : preferDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

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
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <div className="flex items-center gap-2 md:hidden">
          {true
            ? <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground font-semibold">A</div>
            : <img src={logo} alt="Alo-Medical" style={{ width: 50 }} />}
          <span className="text-sm font-semibold">Alo‑Medical</span>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground font-semibold">A</div>
          <div className="text-sm font-semibold">Med‑Aid Management Tool</div>
        </div>
        <div className="flex-1" />
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder='Search e.g. scheme:VIP status:pending provider:MedCare' className="pl-9 pr-24" aria-label="Smart search" />
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggleTheme} aria-pressed={dark}>
                  <SunMedium className="h-5 w-5 hidden dark:block" />
                  <Moon className="h-5 w-5 dark:hidden" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">3</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar>
                  <AvatarFallback>AD</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm md:inline">Admin</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Help</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
