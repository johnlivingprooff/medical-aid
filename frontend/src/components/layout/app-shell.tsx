import { Sidebar } from './sidebar'
import { Header } from './header'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="grainy-overlay" />
      <div className="flex">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header />
          <main id="main" className={cn('container mx-auto w-full max-w-7xl px-4 pb-12 pt-6 md:pt-8')}>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
