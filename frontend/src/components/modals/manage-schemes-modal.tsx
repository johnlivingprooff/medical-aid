import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

type Props = { open: boolean; onOpenChange: (v: boolean) => void }

type Scheme = { id: number; name: string; description?: string }

export function ManageSchemesModal({ open, onOpenChange }: Props) {
  const [schemes, setSchemes] = useState<Scheme[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const resp = await api.get<any>('/api/schemes/categories/')
    setSchemes(resp.results ?? resp)
  }

  useEffect(() => { if (open) { load().catch(() => {}) } }, [open])

  async function addScheme(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const created = await api.post<Scheme>('/api/schemes/categories/', { name, description })
      setSchemes([created, ...schemes])
      setName(''); setDescription('')
    } catch (e: any) {
      setError(e.message || 'Failed to add scheme')
    } finally { setLoading(false) }
  }

  async function addBenefit(schemeId: number, payload: any) {
    await api.post('/api/schemes/benefits/', { ...payload, scheme: schemeId })
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader><CardTitle>Manage Schemes</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={addScheme} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="name">Scheme Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="desc">Description</Label>
              <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Adding…' : 'Add Scheme'}</Button>
            </div>
            {error && <div className="sm:col-span-3 text-sm text-destructive">{error}</div>}
          </form>

          <div className="space-y-4">
            {schemes.map((s) => (
              <SchemeRow key={s.id} scheme={s} onAddBenefit={(payload) => addBenefit(s.id, payload)} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SchemeRow({ scheme, onAddBenefit }: { scheme: Scheme; onAddBenefit: (payload: any) => Promise<void> }) {
  const [benefitType, setBenefitType] = useState('CONSULTATION')
  const [coverageAmount, setCoverageAmount] = useState('')
  const [coverageLimitCount, setCoverageLimitCount] = useState('')
  const [coveragePeriod, setCoveragePeriod] = useState('YEARLY')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onAddBenefit({
        benefit_type: benefitType,
        coverage_amount: coverageAmount ? Number(coverageAmount) : null,
        coverage_limit_count: coverageLimitCount ? Number(coverageLimitCount) : null,
        coverage_period: coveragePeriod,
      })
      setBenefitType('CONSULTATION'); setCoverageAmount(''); setCoverageLimitCount(''); setCoveragePeriod('YEARLY')
    } catch (e: any) {
      setError(e.message || 'Failed to add benefit')
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 text-sm font-medium">{scheme.name}</div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <div className="space-y-1">
          <Label>Benefit</Label>
          <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={benefitType} onChange={(e) => setBenefitType(e.target.value)}>
            <option value="CONSULTATION">Consultation</option>
            <option value="LAB">Laboratory</option>
            <option value="PHARMACY">Pharmacy</option>
            <option value="INPATIENT">Inpatient</option>
            <option value="IMAGING">Imaging</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Amount (MWK)</Label>
          <Input value={coverageAmount} onChange={(e) => setCoverageAmount(e.target.value)} placeholder="e.g. 500000" />
        </div>
        <div className="space-y-1">
          <Label>Limit count</Label>
          <Input value={coverageLimitCount} onChange={(e) => setCoverageLimitCount(e.target.value)} placeholder="e.g. 12" />
        </div>
        <div className="space-y-1">
          <Label>Period</Label>
          <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={coveragePeriod} onChange={(e) => setCoveragePeriod(e.target.value)}>
            <option value="PER_VISIT">Per Visit</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>
        <div className="flex items-end justify-end gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add Benefit'}</Button>
        </div>
        {error && <div className="sm:col-span-5 text-sm text-destructive">{error}</div>}
      </form>
    </div>
  )
}
