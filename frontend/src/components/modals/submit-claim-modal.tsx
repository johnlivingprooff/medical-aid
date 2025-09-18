import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { X } from 'lucide-react'

type Props = { open: boolean; onOpenChange: (v: boolean) => void }
type BenefitType = { id: number; name: string }

export function SubmitClaimModal({ open, onOpenChange }: Props) {
  const [patient, setPatient] = useState<number | ''>('')
  const [serviceType, setServiceType] = useState<number | ''>('')
  const [cost, setCost] = useState('')
  const [patients, setPatients] = useState<Array<{ id: number; user_username: string }>>([])
  const [checking, setChecking] = useState(false)
  const [approved, setApproved] = useState<boolean | null>(null)
  const [payable, setPayable] = useState<number | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [benefitTypes, setBenefitTypes] = useState<BenefitType[]>([])

  useEffect(() => {
    if (!open) return
    api.get<any>('/api/patients/')
      .then((resp) => setPatients(resp.results ?? resp))
      .catch(() => setPatients([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    api.get<BenefitType[]>('/api/schemes/benefit-types/')
      .then((resp: any) => {
        const list = resp.results ?? resp
        setBenefitTypes(list)
        if (!serviceType && list.length) setServiceType(list[0].id)
      })
      .catch(() => setBenefitTypes([]))
  }, [open])

  async function validateClaim() {
    setChecking(true)
    setError(null)
    try {
      const res = await api.post<any>('/api/claims/validate/', {
        patient,
        service_type: serviceType,
        cost: Number(cost),
      })
      setApproved(res.approved)
      setPayable(res.payable)
      setReason(res.reason)
    } catch (e: any) {
      setError(e.message || 'Validation failed')
    } finally {
      setChecking(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/claims/', {
        patient,
        service_type: serviceType,
        cost: Number(cost),
      })
      onOpenChange(false)
      setPatient(''); setServiceType(''); setCost(''); setApproved(null); setPayable(null); setReason(null)
    } catch (e: any) {
      setError(e.message || 'Failed to submit claim')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <div 
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={() => onOpenChange(false)}
    >
      <Card 
        className="w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Submit Claim</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-y-auto">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patient">Member</Label>
              <select id="patient" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={patient} onChange={(e) => setPatient(Number(e.target.value))} required>
                <option value="" disabled>Select…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.user_username}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type</Label>
          <select id="serviceType" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={serviceType} onChange={(e) => setServiceType(Number(e.target.value))}>
                  {benefitTypes
                    .filter((bt) => bt.name.toLowerCase() !== 'add new')
                    .map((bt) => (
            <option key={bt.id} value={bt.id}>
                        {bt.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost (MWK)</Label>
                <Input id="cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="25000" required />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={validateClaim} disabled={checking || !patient || !cost || !serviceType}>Check Coverage</Button>
              {approved !== null && (
                <span className="text-sm">{approved ? `Approved • Payable ${formatCurrency(payable || 0)}` : `Rejected • ${reason}`}</span>
              )}
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !patient || !cost || !serviceType}>{saving ? 'Submitting…' : 'Submit Claim'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
