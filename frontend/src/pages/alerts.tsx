import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatRelativeTime } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  // Replace USD/$ currency notations with MWK for display on this page
  const toMWK = (text: string): string => {
    if (!text) return text
    let out = text
    // Replace standalone 'USD' (case-insensitive) with 'MWK'
    out = out.replace(/\bUSD\b/gi, 'MWK')
    // Replace 'US$' with 'MWK '
    out = out.replace(/US\$/gi, 'MWK ')
    // Replace '$' only when it's used as a currency indicator before a number
    // e.g., "$1,234.56" -> "MWK 1,234.56" or "$ 120" -> "MWK 120"
    out = out.replace(/\$\s*(?=\d)/g, 'MWK ')
    return out
  }

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [patientModalOpen, setPatientModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [patientLoading, setPatientLoading] = useState(false)

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

  const openPatientModal = async (patientId: number) => {
    setPatientLoading(true)
    setSelectedPatient(null)
    setPatientModalOpen(true)
    try {
      const resp = await api.get<any>(`/api/patients/${patientId}/`)
      setSelectedPatient(resp)
    } catch (e: any) {
      setSelectedPatient({ error: e?.message || 'Failed to load patient' })
    } finally {
      setPatientLoading(false)
    }
  }

  const openDetailsModal = (alert: Alert) => {
    setSelectedAlert(alert)
    setDetailsModalOpen(true)
  }

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
                      <div className="font-medium">{toMWK(alert.message)}</div>
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
                          <button className="text-accent hover:underline" onClick={() => openPatientModal(alert.patient_id!)}>View Patient</button>
                          <span className="text-muted-foreground">•</span>
                        </>
                      )}
                      <button className="text-accent hover:underline" onClick={() => openDetailsModal(alert)}>View Details</button>
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

      {/* Patient Modal */}
      <Dialog open={patientModalOpen} onOpenChange={setPatientModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Patient Summary</DialogTitle>
            <DialogDescription>Key information for the selected patient.</DialogDescription>
          </DialogHeader>
          {patientLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : selectedPatient?.error ? (
            <div className="text-destructive text-sm">{selectedPatient.error}</div>
          ) : selectedPatient ? (
            <div className="text-sm space-y-2">
              <div>
                <span className="font-medium">Member:</span>{' '}
                {selectedPatient.user?.first_name || selectedPatient.user?.last_name
                  ? `${selectedPatient.user?.first_name || ''} ${selectedPatient.user?.last_name || ''}`.trim()
                  : selectedPatient.user?.username}
              </div>
              <div>
                <span className="font-medium">Member ID:</span> {selectedPatient.member_id}
              </div>
              <div>
                <span className="font-medium">Scheme:</span> {selectedPatient.scheme?.name || '—'}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {selectedPatient.phone || '—'}
              </div>
              {selectedPatient.member_subscription && (
                <div className="mt-2 p-2 rounded border">
                  <div className="font-medium mb-1">Subscription</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Tier:</span> {selectedPatient.member_subscription?.tier?.name || '—'}</div>
                    <div><span className="text-muted-foreground">Status:</span> {selectedPatient.member_subscription?.status || '—'}</div>
                    <div><span className="text-muted-foreground">Since:</span> {selectedPatient.member_subscription?.start_date || '—'}</div>
                    <div><span className="text-muted-foreground">Expires:</span> {selectedPatient.member_subscription?.end_date || '—'}</div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Alert Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alert Details</DialogTitle>
            <DialogDescription>More information about this alert.</DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="text-sm space-y-2">
              <div><span className="font-medium">Type:</span> {selectedAlert.type}</div>
              <div><span className="font-medium">Severity:</span> <Badge variant={selectedAlert.severity === 'HIGH' ? 'destructive' : selectedAlert.severity === 'MEDIUM' ? 'warning' : 'default'}>{selectedAlert.severity}</Badge></div>
              <div className="whitespace-pre-wrap"><span className="font-medium">Message:</span> {toMWK(selectedAlert.message)}</div>
              <div className="text-muted-foreground">{formatRelativeTime(selectedAlert.created_at)}</div>
              {selectedAlert.patient_id && (
                <div><span className="font-medium">Patient ID:</span> {selectedAlert.patient_id}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
