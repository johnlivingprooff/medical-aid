import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QuickActions } from '@/components/layout/quick-actions'
import { BarChart3, Clock3, DollarSign, Users2, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useEffect, useState } from 'react'
import { getActivityFeed, getDashboardStats, api } from '@/lib/api'
import type { ActivityFeed, DashboardStats } from '@/types/api'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/currency'
import { useAuth } from '@/components/auth/auth-context'

function Kpi({ icon: Icon, label, value, delta, subtext, loading }: { icon: any; label: string; value: string | number; delta?: string; subtext?: string; loading?: boolean }) {
  return (
    <Card className="card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
          <div className="mt-1 text-2xl font-semibold">{loading ? <Skeleton className="h-7 w-24" /> : value}</div>
        </div>
        <div className="rounded-md bg-muted p-2"><Icon className="h-5 w-5 text-muted-foreground" /></div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {delta && <Badge variant={delta.startsWith('+') ? 'success' : 'warning'}>{delta}</Badge>}
          {subtext && <span>{subtext}</span>}
        </div>
        <div className="mt-2 h-8 rounded-md bg-gradient-to-r from-muted to-muted/60" aria-hidden />
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<ActivityFeed | null>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchAlerts = async () => {
      try {
        const response = await api.get<{ results: any[] }>('/api/alerts/')
        return response.results.slice(0, 5) // Show only 5 most recent
      } catch (error) {
        console.error('Error fetching alerts:', error)
        return []
      }
    }

    Promise.all([getDashboardStats(), getActivityFeed(), fetchAlerts()])
      .then(([s, a, alerts]) => { if (!mounted) return; setStats(s); setActivity(a); setAlerts(alerts); })
      .catch((e) => { if (!mounted) return; setError(e.message || 'Failed to load'); })
      .finally(() => { if (!mounted) return; setLoading(false); })
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1>Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operational overview and recent activity for Alo‑Medical.</p>
        </div>
        <QuickActions />
      </div>

  {user?.role !== 'PATIENT' && (
  <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi icon={Users2} label="Active Members" value={stats?.kpis.active_members ?? ''} delta="" subtext="vs last 30 days" loading={loading} />
        <Kpi icon={BarChart3} label="Total Claims (Period)" value={stats?.kpis.total_claims_period ?? ''} delta="" subtext="vs last 30 days" loading={loading} />
  <Kpi icon={DollarSign} label="Claim Value (Approved)" value={formatCurrency(stats?.kpis.claim_value_approved ?? 0)} delta="" subtext="vs last 30 days" loading={loading} />
  <Kpi icon={AlertTriangle} label="Pending Claim Value" value={formatCurrency(stats?.kpis.pending_claim_value ?? 0)} delta="" subtext="vs last 30 days" loading={loading} />
        <Kpi icon={TrendingUp} label="Utilization Rate" value={`${Math.round((stats?.kpis.utilization_rate ?? 0) * 100)}%`} delta="" subtext="of allocated benefits" loading={loading} />
        <Kpi icon={Clock3} label="Avg. Processing Time" value={`${stats?.kpis.avg_processing_days?.toFixed?.(2) ?? '0.00'} days`} delta="" subtext="goal ≤ 3 days" loading={loading} />
      </section>
  )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Scheme Utilization Analytics</CardTitle>
            <CardDescription>VIP, VVIP, Standard claim values</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 rounded-lg border border-border p-4">
              <div className="h-full w-full rounded-md bg-[linear-gradient(180deg,transparent_95%,hsl(210_16%_90%)_96%),linear-gradient(90deg,transparent_95%,hsl(210_16%_90%)_96%)]" aria-hidden />
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" /> VIP</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> VVIP</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> Standard</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Claims Status Snapshot</CardTitle>
            <CardDescription>Approved, Pending, Rejected</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <div className="relative h-48 w-48">
              <div className="absolute inset-0 rounded-full bg-[conic-gradient(theme(colors.status.approved)_0_220deg,theme(colors.status.pending)_220deg_300deg,theme(colors.status.rejected)_300deg_360deg)]" aria-hidden />
              <div className="absolute inset-4 rounded-full bg-card" />
            </div>
          </CardContent>
          <div className="px-4 pb-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-status-approved" /> Approved</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-status-pending" /> Pending</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-status-rejected" /> Rejected</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Provider submissions, registrations, approvals</CardDescription>
          </CardHeader>
          <CardContent>
            {!activity && loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="py-3">
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {activity?.results.map((e) => (
                  <li key={`${e.type}-${e.id}-${e.timestamp}`} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <div>
                        <div className="font-medium">{e.title}</div>
                        <div className="text-xs text-muted-foreground">{e.provider} • Member: {e.member} • {formatCurrency(e.amount)}</div>
                      </div>
                    </div>
                    <button className="text-xs text-accent underline">View</button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Real‑Time Alerts</CardTitle>
              <CardDescription>Live operational signals</CardDescription>
            </div>
            <Badge variant="warning">{alerts.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-2 bg-card px-4 py-2 text-xs text-muted-foreground">Newest first</div>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">No alerts to display</div>
            ) : (
              <ul className="space-y-3 text-sm">
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${
                      alert.severity === 'HIGH' ? 'bg-destructive' :
                      alert.severity === 'MEDIUM' ? 'bg-warning' : 'bg-info'
                    }`} />
                    <div>
                      <div className="font-medium">{alert.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {alert.patient_id && `Patient ID: ${alert.patient_id} • `}
                        {new Date(alert.created_at).toLocaleString()}
                      </div>
                      <div className="mt-2 flex gap-2 text-xs">
                        <button className="text-accent">View Details</button>
                        {!alert.is_read && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <button className="text-accent">Mark Read</button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator />
      <div className="text-xs text-muted-foreground">Click KPI cards or chart segments to drill into filtered views.</div>
    </div>
  )
}
