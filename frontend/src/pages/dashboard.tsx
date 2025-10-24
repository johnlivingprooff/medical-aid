import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QuickActions } from '@/components/layout/quick-actions'
import { BarChart3, Clock3, DollarSign, Users2, TrendingUp, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useEffect, useMemo, useState } from 'react'
import { getActivityFeed, getDashboardStats, api } from '@/lib/api'
import type { ActivityFeed, DashboardStats } from '@/types/api'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/currency'
import { useAuth } from '@/components/auth/auth-context'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { VerifyMembersModal } from '@/components/modals/verify-members-modal'

function Kpi({ icon: Icon, label, value, delta, subtext, loading }: { icon: any; label: string; value: string | number; delta?: string; subtext?: string; loading?: boolean }) {
  return (
    <Card className="card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
          <div className="mt-1 text-2xl font-semibold">{loading ? <Skeleton className="w-24 h-7" /> : value}</div>
        </div>
        <div className="p-2 rounded-md bg-muted"><Icon className="w-5 h-5 text-muted-foreground" /></div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {delta && <Badge variant={delta.startsWith('+') ? 'success' : 'warning'}>{delta}</Badge>}
          {subtext && <span>{subtext}</span>}
        </div>
        <div className="h-8 mt-2 rounded-md bg-gradient-to-r from-muted to-muted/60" aria-hidden />
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
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [activityPage, setActivityPage] = useState(1)
  const [alertsPage, setAlertsPage] = useState(1)
  const itemsPerPage = 5
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<any>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showVerifyMembers, setShowVerifyMembers] = useState(false)

  // Helper functions for quick date ranges
  const getDateRange = (range: string) => {
    const today = new Date()
    let endDate = new Date(today)
    let startDate = new Date(today)

    switch (range) {
      case 'last7days':
        startDate.setDate(today.getDate() - 7)
        break
      case 'last30days':
        startDate.setDate(today.getDate() - 30)
        break
      case 'last90days':
        startDate.setDate(today.getDate() - 90)
        break
      case 'thisYear':
        startDate = new Date(today.getFullYear(), 0, 1)
        break
      case 'lastYear':
        startDate = new Date(today.getFullYear() - 1, 0, 1)
        endDate.setFullYear(today.getFullYear() - 1, 11, 31)
        break
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        endDate = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      default:
        return { start: '', end: '' }
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  }

  const applyQuickDateRange = (range: string) => {
    const { start, end } = getDateRange(range)
    setStartDate(start)
    setEndDate(end)
    fetchData(start, end)
  }

  const handleViewActivity = (activity: any) => {
    setSelectedActivity(activity)
    setShowActivityModal(true)
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedActivity || !selectedActivity.id) return

    setUpdatingStatus(true)
    try {
      await api.patch(`/api/claims/${selectedActivity.id}/`, { status: newStatus })
      // Refresh the activity feed and dashboard data
      const [s, a] = await Promise.all([
        getDashboardStats(startDate || undefined, endDate || undefined),
        getActivityFeed()
      ])
      setStats(s)
      setActivity(a)
      setShowActivityModal(false)
      setSelectedActivity(null)
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const fetchData = async (start?: string, end?: string) => {
    setLoading(true)
    try {
      const [s, a] = await Promise.all([
        getDashboardStats(start, end),
        getActivityFeed()
      ])
      setStats(s)
      setActivity(a)
    } catch (e) {
      setError((e as Error).message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

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

    fetchData()
    fetchAlerts().then(alerts => { if (mounted) setAlerts(alerts) })
    return () => { mounted = false }
  }, [])

  const handleDateFilter = () => {
    fetchData(startDate || undefined, endDate || undefined)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1>Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operational overview and recent activity for Alo‑Medical.</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'PROVIDER' && (
            <Button onClick={() => setShowVerifyMembers(true)} variant="outline">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Verify Members
            </Button>
          )}
          <QuickActions />
        </div>
      </div>

  {user?.role !== 'PATIENT' && (
    <Card>
      <CardHeader>
        <CardTitle>Date Range Filter</CardTitle>
        <CardDescription>Filter dashboard data by date range - use quick options or custom dates</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Quick Date Range Buttons */}
        <div className="mb-4">
          <div className="mb-2 text-sm font-medium">Quick Select:</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyQuickDateRange('last7days')}
              className="px-3 py-1 text-xs transition-colors rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => applyQuickDateRange('last30days')}
              className="px-3 py-1 text-xs transition-colors rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => applyQuickDateRange('last90days')}
              className="px-3 py-1 text-xs transition-colors rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Last 90 Days
            </button>
            <button
              onClick={() => applyQuickDateRange('thisMonth')}
              className="px-3 py-1 text-xs transition-colors rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              This Month
            </button>
            <button
              onClick={() => applyQuickDateRange('lastMonth')}
              className="px-3 py-1 text-xs transition-colors rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Last Month
            </button>
            <button
              onClick={() => applyQuickDateRange('thisYear')}
              className="px-3 py-1 text-xs transition-colors rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              This Year
            </button>
            <button
              onClick={() => applyQuickDateRange('lastYear')}
              className="px-3 py-1 text-xs transition-colors rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Last Year
            </button>
          </div>
        </div>

        {/* Custom Date Inputs */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="start-date" className="text-sm font-medium">Start Date:</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm border rounded-md border-input"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="end-date" className="text-sm font-medium">End Date:</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm border rounded-md border-input"
            />
          </div>
          <button
            onClick={handleDateFilter}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Apply Filter
          </button>
          <button
            onClick={() => {
              setStartDate('')
              setEndDate('')
              fetchData()
            }}
            className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            Clear
          </button>
        </div>
      </CardContent>
    </Card>
  )}

  {user?.role !== 'PATIENT' && (
  <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi icon={Users2} label="Active Members" value={stats?.kpis.active_members ?? ''} delta="" subtext="total registered" loading={loading} />
        <Kpi icon={BarChart3} label="Total Claims" value={stats?.kpis.total_claims_period ?? ''} delta="" subtext={
          stats?.kpis.data_period === 'all_time' ? 'all time' :
          stats?.kpis.data_period === 'custom' ? `${startDate || 'start'} to ${endDate || 'end'}` :
          'last 30 days'
        } loading={loading} />
  <Kpi icon={DollarSign} label="Claim Value (Approved)" value={formatCurrency(stats?.kpis.claim_value_approved ?? 0)} delta="" subtext={
          stats?.kpis.data_period === 'all_time' ? 'all time' :
          stats?.kpis.data_period === 'custom' ? `${startDate || 'start'} to ${endDate || 'end'}` :
          'last 30 days'
        } loading={loading} />
  <Kpi icon={AlertTriangle} label="Pending Claim Value" value={formatCurrency(stats?.kpis.pending_claim_value ?? 0)} delta="" subtext={
          stats?.kpis.data_period === 'all_time' ? 'all time' :
          stats?.kpis.data_period === 'custom' ? `${startDate || 'start'} to ${endDate || 'end'}` :
          'last 30 days'
        } loading={loading} />
        <Kpi icon={TrendingUp} label="Utilization Rate" value={`${Math.round((stats?.kpis.utilization_rate ?? 0) * 100)}%`} delta="" subtext="of processed claims" loading={loading} />
        <Kpi icon={Clock3} label="Avg. Processing Time" value={`${stats?.kpis.avg_processing_days?.toFixed?.(2) ?? '0.00'} days`} delta="" subtext="goal ≤ 3 days" loading={loading} />
      </section>
  )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Scheme Utilization Analytics</CardTitle>
            <CardDescription>Claim values by medical aid scheme</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Skeleton className="w-full h-48" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats?.scheme_utilization || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="patient__scheme__name"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'total_amount' ? formatCurrency(value) : value,
                      name === 'total_amount' ? 'Total Amount' : 'Total Claims'
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="total_amount"
                    fill="#3b82f6"
                    name="Total Amount"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="total_claims"
                    fill="#10b981"
                    name="Total Claims"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
          {!loading && stats?.scheme_utilization && stats.scheme_utilization.length > 0 && (
            <div className="px-4 pb-4">
              <div className="text-xs text-muted-foreground">
                Top {stats.scheme_utilization.length} schemes by claim volume
              </div>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Claims Status Snapshot</CardTitle>
            <CardDescription>Approved, Pending, Rejected</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Skeleton className="w-32 h-32 rounded-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={Object.entries(stats?.status_snapshot || {}).map(([status, data]) => ({
                      name: status,
                      value: data.count,
                      amount: data.amount
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {Object.entries(stats?.status_snapshot || {}).map(([status], index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          status === 'APPROVED' ? '#22c55e' :
                          status === 'PENDING' ? '#f59e0b' :
                          status === 'REJECTED' ? '#ef4444' :
                          '#6b7280'
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${value} claims (${formatCurrency(props.payload.amount || 0)})`,
                      name
                    ]}
                  />
                  
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {Object.entries(stats?.status_snapshot || {}).map(([status, data]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span
                    className="flex-shrink-0 w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        status === 'APPROVED' ? '#22c55e' :
                        status === 'PENDING' ? '#f59e0b' :
                        status === 'REJECTED' ? '#ef4444' :
                        '#6b7280'
                    }}
                  />
                  <span className="truncate text-[10px] leading-tight">
                    {status.replace('_', ' ')} ({data.count})
                  </span>
                </div>
              ))}
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
                    <Skeleton className="w-3/4 h-4" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <ul className="text-sm divide-y divide-border">
                  {activity?.results.slice((activityPage - 1) * itemsPerPage, activityPage * itemsPerPage).map((e) => (
                    <li key={`${e.type}-${e.id}-${e.timestamp}`} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <div>
                          <div className="font-medium">{e.title}</div>
                          <div className="text-xs text-muted-foreground">{e.provider} • Member: {e.member} • {formatCurrency(e.amount)}</div>
                        </div>
                      </div>
                      <button 
                        className="text-xs underline text-accent hover:text-accent/80"
                        onClick={() => handleViewActivity(e)}
                      >
                        View
                      </button>
                    </li>
                  ))}
                </ul>
                {activity && activity.results.length > itemsPerPage && (
                  <div className="flex items-center justify-between pt-4 mt-4 border-t">
                    <div className="text-xs text-muted-foreground">
                      Showing {Math.min(activityPage * itemsPerPage, activity.results.length)} of {activity.results.length} activities
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                        disabled={activityPage === 1}
                        className="px-3 py-1 text-xs rounded bg-secondary text-secondary-foreground disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setActivityPage(prev => Math.min(Math.ceil(activity.results.length / itemsPerPage), prev + 1))}
                        disabled={activityPage === Math.ceil(activity.results.length / itemsPerPage)}
                        className="px-3 py-1 text-xs rounded bg-secondary text-secondary-foreground disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
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
            <div className="sticky top-0 z-10 px-4 py-2 mb-2 -mx-4 -mt-4 text-xs bg-card text-muted-foreground">Newest first</div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="w-full h-16" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">No alerts to display</div>
            ) : (
              <>
                <ul className="space-y-3 text-sm">
                  {alerts.slice((alertsPage - 1) * itemsPerPage, alertsPage * itemsPerPage).map((alert) => (
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
                        <div className="flex gap-2 mt-2 text-xs">
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
                {alerts.length > itemsPerPage && (
                  <div className="flex items-center justify-between pt-4 mt-4 border-t">
                    <div className="text-xs text-muted-foreground">
                      Showing {Math.min(alertsPage * itemsPerPage, alerts.length)} of {alerts.length} alerts
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAlertsPage(prev => Math.max(1, prev - 1))}
                        disabled={alertsPage === 1}
                        className="px-3 py-1 text-xs rounded bg-secondary text-secondary-foreground disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setAlertsPage(prev => Math.min(Math.ceil(alerts.length / itemsPerPage), prev + 1))}
                        disabled={alertsPage === Math.ceil(alerts.length / itemsPerPage)}
                        className="px-3 py-1 text-xs rounded bg-secondary text-secondary-foreground disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator />
      <div className="text-xs text-muted-foreground">Click KPI cards or chart segments to drill into filtered views.</div>

      {/* Activity Modal */}
      {showActivityModal && selectedActivity && (
        <div className="fixed inset-0 z-50 grid p-4 place-items-center bg-black/40">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Activity Details</CardTitle>
              <CardDescription>
                {selectedActivity.type === 'CLAIM_SUBMITTED' ? 'Claim Submission' : 'Claim Approval'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Type:</span> {selectedActivity.title}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Member:</span> {selectedActivity.member}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Provider:</span> {selectedActivity.provider}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Amount:</span> {formatCurrency(selectedActivity.amount)}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Date:</span> {new Date(selectedActivity.timestamp).toLocaleString()}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Current Status:</span>
                  <Badge 
                    variant={
                      selectedActivity.status === 'APPROVED' ? 'default' :
                      selectedActivity.status === 'PENDING' ? 'info' :
                      selectedActivity.status === 'REJECTED' ? 'destructive' :
                      'outline'
                    }
                    className="ml-2"
                  >
                    {selectedActivity.status}
                  </Badge>
                </div>
              </div>

              {/* Status Update Section - Only for Admin/Provider */}
              {(user?.role === 'ADMIN' || user?.role === 'PROVIDER') && selectedActivity.type === 'CLAIM_SUBMITTED' && (
                <div className="pt-4 space-y-3 border-t">
                  <Label className="text-sm font-medium">Update Status</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={selectedActivity.status === 'APPROVED' ? 'default' : 'outline'}
                      onClick={() => handleStatusUpdate('APPROVED')}
                      disabled={updatingStatus || selectedActivity.status === 'APPROVED'}
                    >
                      {updatingStatus ? 'Updating...' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedActivity.status === 'PENDING' ? 'default' : 'outline'}
                      onClick={() => handleStatusUpdate('PENDING')}
                      disabled={updatingStatus || selectedActivity.status === 'PENDING'}
                    >
                      {updatingStatus ? 'Updating...' : 'Pending'}
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedActivity.status === 'REJECTED' ? 'default' : 'outline'}
                      onClick={() => handleStatusUpdate('REJECTED')}
                      disabled={updatingStatus || selectedActivity.status === 'REJECTED'}
                    >
                      {updatingStatus ? 'Updating...' : 'Reject'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setShowActivityModal(false)
                    setSelectedActivity(null)
                  }}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Verify Members Modal - Provider Only */}
      <VerifyMembersModal 
        open={showVerifyMembers} 
        onOpenChange={setShowVerifyMembers} 
      />
    </div>
  )
}
