import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ManageSchemesModal } from '@/components/modals/manage-schemes-modal'
import { formatCurrency } from '@/lib/currency'
import { api } from '@/lib/api'

type SchemeOverview = {
  id: number
  name: string
  description: string
  members_count: number
  total_amount_30d: number
  total_claims_30d: number
  utilization_percent: number
  breakdown: Array<{ name: string; percent: number }>
  price?: number
  is_active?: boolean
}

export default function Schemes() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [schemes, setSchemes] = useState<SchemeOverview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    const params = showInactive ? '?show_inactive=true' : ''
    api.get<SchemeOverview[]>(`/api/core/analytics/schemes/overview/${params}`)
      .then((data) => { if (mounted) setSchemes(data) })
      .catch((e: any) => { if (mounted) setError(e.message || 'Failed to load schemes') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [showInactive])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1>Schemes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Explore scheme performance and utilization.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive schemes
          </label>
          <Button onClick={() => setOpen(true)}><Settings2 className="w-4 h-4 mr-2" /> Create Scheme</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && [0,1,2].map((i) => (
          <Card key={`shimmer-${i}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="w-24 h-4 rounded animate-pulse bg-muted" />
                <Badge variant="info">Loading…</Badge>
              </div>
              <CardDescription><span className="inline-block w-48 h-3 rounded animate-pulse bg-muted" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded bg-muted" />
              <div className="h-2 rounded bg-muted" />
              <div className="h-2 rounded bg-muted" />
              <div className="text-xs text-muted-foreground">&nbsp;</div>
            </CardContent>
          </Card>
        ))}
        {!loading && error && (
          <div className="text-sm col-span-full text-destructive">{error}</div>
        )}
        {!loading && !error && schemes.map((s, i) => (
          <Card key={s.id} className={!s.is_active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {s.name}
                  {!s.is_active && <Badge variant="outline">Inactive</Badge>}
                </CardTitle>
                <Badge variant="info">Utilization {Math.round(s.utilization_percent)}%</Badge>
              </div>
              <CardDescription>{s.members_count.toLocaleString()} members • Scheme value {formatCurrency(s.price || 0)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.breakdown.slice(0,3).map((b, idx) => (
                <div key={b.name + idx}>
                  <div className="flex justify-between mb-1 text-xs text-muted-foreground"><span>{b.name}</span><span>{Math.round(b.percent)}%</span></div>
                  <div className="h-2 rounded bg-muted"><div className={`h-2 rounded ${idx===0?'bg-accent':idx===1?'bg-success':'bg-warning'}`} style={{ width: `${Math.min(100, Math.max(0, b.percent))}%` }} /></div>
                </div>
              ))}
              <div className="text-xs underline cursor-pointer text-accent" onClick={() => navigate(`/schemes/${s.id}`)}>Open details</div>
            </CardContent>
          </Card>
        ))}
      </div>
  <ManageSchemesModal open={open} onOpenChange={setOpen} />
  </div>
  )
}
