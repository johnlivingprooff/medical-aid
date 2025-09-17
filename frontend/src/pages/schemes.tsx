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
}

export default function Schemes() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [schemes, setSchemes] = useState<SchemeOverview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    api.get<SchemeOverview[]>('/api/core/analytics/schemes/overview/')
      .then((data) => { if (mounted) setSchemes(data) })
      .catch((e: any) => { if (mounted) setError(e.message || 'Failed to load schemes') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1>Schemes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Explore scheme performance and utilization.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Settings2 className="h-4 w-4 mr-2" /> Manage Schemes</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && [0,1,2].map((i) => (
          <Card key={`shimmer-${i}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <Badge variant="info">Loading…</Badge>
              </div>
              <CardDescription><span className="inline-block h-3 w-48 animate-pulse rounded bg-muted" /></CardDescription>
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
          <div className="col-span-full text-sm text-destructive">{error}</div>
        )}
        {!loading && !error && schemes.map((s, i) => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{s.name}</CardTitle>
                <Badge variant="info">Utilization {Math.round(s.utilization_percent)}%</Badge>
              </div>
              <CardDescription>{s.members_count.toLocaleString()} members • Scheme value {formatCurrency(s.price || 0)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.breakdown.slice(0,3).map((b, idx) => (
                <div key={b.name + idx}>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{b.name}</span><span>{Math.round(b.percent)}%</span></div>
                  <div className="h-2 rounded bg-muted"><div className={`h-2 rounded ${idx===0?'bg-accent':idx===1?'bg-success':'bg-warning'}`} style={{ width: `${Math.min(100, Math.max(0, b.percent))}%` }} /></div>
                </div>
              ))}
              <div className="text-xs text-accent underline cursor-pointer" onClick={() => navigate(`/schemes/${s.id}`)}>Open details</div>
            </CardContent>
          </Card>
        ))}
      </div>
  <ManageSchemesModal open={open} onOpenChange={setOpen} />
  </div>
  )
}
