import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { ManageSchemesModal } from '@/components/modals/manage-schemes-modal'

type Member = { id: number; username: string; joined: string; next_renewal: string; amount_spent_12m: number }
type Scheme = { id: number; name: string; description?: string; price: number; members: Member[] }

export default function SchemeDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [scheme, setScheme] = useState<Scheme | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setLoading(true)
    setError(null)
    api.get<Scheme>(`/api/schemes/categories/${id}/details/`)
      .then((data) => { if (mounted) setScheme(data) })
      .catch((e: any) => { if (mounted) setError(e.message || 'Failed to load scheme') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [id])

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (error) return <div className="text-sm text-destructive">{error}</div>
  if (!scheme) return null

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1>{scheme.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{scheme.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/schemes')}>Back</Button>
          <Button onClick={() => setShowEdit(true)}>Edit</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Scheme Price</CardTitle>
            <CardDescription>Sum of benefit limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(scheme.price || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Consumption based on approved claims in the last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {scheme.members?.length ? scheme.members.map((m) => {
              const percent = scheme.price ? Math.min(100, Math.round((m.amount_spent_12m / scheme.price) * 100)) : 0
              const bar = percent > 70 ? 'bg-destructive' : 'bg-success'
              return (
                <div key={m.id} className="rounded border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">{m.username}</div>
                    <div className="text-muted-foreground">{percent}% used</div>
                  </div>
                  <div className="mt-2 h-2 rounded bg-muted">
                    <div className={`h-2 rounded ${bar}`} style={{ width: `${percent}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Joined {new Date(m.joined).toLocaleDateString()} • Next renewal {new Date(m.next_renewal).toLocaleDateString()}</div>
                </div>
              )
            }) : (
              <div className="text-sm text-muted-foreground">No members yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
  <ManageSchemesModal open={showEdit} onOpenChange={setShowEdit} schemeId={scheme.id} />
    </div>
  )
}
