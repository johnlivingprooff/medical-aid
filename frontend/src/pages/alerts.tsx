import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'

interface Alert {
  id: number
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  message: string
  patient_id: number | null
  created_at: string
  is_read: boolean
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await api.get<{ results: Alert[] }>('/api/alerts/')
        setAlerts(response.results)
      } catch (error) {
        console.error('Error fetching alerts:', error)
        setError('Failed to load alerts')
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [])

  const markAsRead = async (alertId: number) => {
    try {
      // Note: This would need a backend endpoint to mark alerts as read
      // For now, just update the local state
      setAlerts(alerts.map(alert => 
        alert.id === alertId ? { ...alert, is_read: true } : alert
      ))
    } catch (error) {
      console.error('Error marking alert as read:', error)
    }
  }

  const unreadCount = alerts.filter(alert => !alert.is_read).length

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Alerts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real‑time alerts and fraud signals.</p>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Stream</CardTitle>
              <CardDescription>Newest first</CardDescription>
            </div>
            <Skeleton className="h-5 w-8" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  <Skeleton className="h-2.5 w-2.5 rounded-full mt-1" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Alerts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real‑time alerts and fraud signals.</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-destructive">{error}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real‑time alerts and fraud signals.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Stream</CardTitle>
            <CardDescription>Newest first</CardDescription>
          </div>
          <Badge variant={unreadCount > 0 ? "warning" : "default"}>{unreadCount}</Badge>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No alerts to display</div>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {alerts.map((alert) => (
                <li key={alert.id} className={`flex items-start gap-3 py-3 ${!alert.is_read ? 'bg-muted/30' : ''}`}>
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    alert.severity === 'HIGH' ? 'bg-destructive' :
                    alert.severity === 'MEDIUM' ? 'bg-warning' : 'bg-info'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="font-medium">{alert.message}</div>
                      {!alert.is_read && (
                        <Badge variant="info" className="ml-2 text-xs">New</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {alert.type} • {alert.patient_id && `Patient ID: ${alert.patient_id} • `}
                      {formatRelativeTime(alert.created_at)}
                    </div>
                    <div className="mt-2 flex gap-2 text-xs">
                      {alert.patient_id && (
                        <>
                          <button className="text-accent hover:underline">View Patient</button>
                          <span className="text-muted-foreground">•</span>
                        </>
                      )}
                      <button className="text-accent hover:underline">View Details</button>
                      {!alert.is_read && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <button 
                            className="text-accent hover:underline"
                            onClick={() => markAsRead(alert.id)}
                          >
                            Mark Read
                          </button>
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
    </div>
  )
}
