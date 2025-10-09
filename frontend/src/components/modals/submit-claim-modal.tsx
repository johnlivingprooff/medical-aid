import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { X } from 'lucide-react'

type Props = { open: boolean; onOpenChange: (v: boolean) => void }
type BenefitType = { id: number; name: string }
type Patient = { 
  id: number; 
  user_username: string; 
  scheme: number;
  member_id: string;
  first_name?: string;
  last_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  scheme_name?: string;
}

export function SubmitClaimModal({ open, onOpenChange }: Props) {
  const [patient, setPatient] = useState<number | ''>('')
  const [serviceType, setServiceType] = useState<number | ''>('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [checking, setChecking] = useState(false)
  const [approved, setApproved] = useState<boolean | null>(null)
  const [payable, setPayable] = useState<number | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [benefitTypes, setBenefitTypes] = useState<BenefitType[]>([])
  const [loadingBenefits, setLoadingBenefits] = useState(false)

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

  // Filter benefit types when patient changes
  useEffect(() => {
    if (!patient || !open) {
      setBenefitTypes([])
      setServiceType('')
      setLoadingBenefits(false)
      return
    }

    // Find the selected patient's scheme
    const selectedPatient = patients.find(p => p.id === patient)
    if (!selectedPatient) return

    setLoadingBenefits(true)
    setError(null)

    // Fetch benefit types available for the patient's scheme
    api.get<BenefitType[]>(`/api/schemes/categories/${selectedPatient.scheme}/benefit-types/`)
      .then((resp: any) => {
        const list = resp.results ?? resp
        setBenefitTypes(list)
        // Reset service type selection when scheme changes
        setServiceType(list.length > 0 ? list[0].id : '')
        // Clear previous validation results
        setApproved(null)
        setPayable(null)
        setReason(null)
      })
      .catch((e: any) => {
        setBenefitTypes([])
        setServiceType('')
        setError(e.message || 'Failed to load available services for this member')
      })
      .finally(() => {
        setLoadingBenefits(false)
      })
  }, [patient, patients, open])

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
        notes: notes.trim() || undefined, // Only send notes if not empty
      })
      onOpenChange(false)
      setPatient(''); setServiceType(''); setCost(''); setNotes(''); setApproved(null); setPayable(null); setReason(null)
    } catch (e: any) {
      setError(e.message || 'Failed to submit claim')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <div 
      className="fixed inset-0 z-50 grid p-4 place-items-center bg-black/40"
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
            className="w-6 h-6"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-y-auto">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patient">Member</Label>
              <SearchableSelect
                options={patients.map(p => {
                  const firstName = p.user_first_name || p.first_name || ''
                  const lastName = p.user_last_name || p.last_name || ''
                  const fullName = firstName && lastName ? `${firstName} ${lastName}` : ''
                  const displayName = fullName || p.user_username
                  
                  // Create searchable text that includes all relevant fields
                  const searchableText = [
                    displayName,
                    p.user_username,
                    p.member_id,
                    p.scheme_name,
                    firstName,
                    lastName
                  ].filter(Boolean).join(' ')
                  
                  return {
                    value: p.id,
                    label: displayName,
                    subtitle: `${p.member_id}${p.scheme_name ? ` • ${p.scheme_name}` : ''}`,
                    searchableText // Add this for enhanced searching
                  }
                })}
                value={patient}
                onChange={(value) => setPatient(Number(value))}
                placeholder="Search for a member..."
                searchPlaceholder="Type member name, ID, username, or scheme..."
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type</Label>
                <select 
                  id="serviceType" 
                  className="w-full px-3 text-sm border rounded-md h-9 bg-background" 
                  value={serviceType} 
                  onChange={(e) => setServiceType(Number(e.target.value))}
                  disabled={loadingBenefits || !patient}
                >
                  {loadingBenefits ? (
                    <option value="" disabled>Loading available services...</option>
                  ) : !patient ? (
                    <option value="" disabled>Select a member first</option>
                  ) : benefitTypes.length === 0 ? (
                    <option value="" disabled>No services available for this member's scheme</option>
                  ) : (
                    <>
                      <option value="" disabled>Select service type...</option>
                      {benefitTypes
                        .filter((bt) => bt.name.toLowerCase() !== 'add new')
                        .map((bt) => (
                          <option key={bt.id} value={bt.id}>
                            {bt.name}
                          </option>
                        ))}
                    </>
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost (MWK)</Label>
                <Input id="cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="25000" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <textarea
                id="notes"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes about this claim..."
                maxLength={500}
              />
              <div className="text-xs text-right text-muted-foreground">
                {notes.length}/500 characters
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={validateClaim} disabled={checking || !patient || !cost || !serviceType}>Check Coverage</Button>
              {approved !== null && (
                <span className={`text-sm ${
                  approved 
                    ? 'text-green-600' 
                    : reason?.toLowerCase().includes('pre-authorization') || reason?.toLowerCase().includes('pre-auth')
                      ? 'text-yellow-600'
                      : 'text-destructive'
                }`}>
                  {approved 
                    ? `Approved • Payable ${formatCurrency(payable || 0)}` 
                    : reason?.toLowerCase().includes('pre-authorization') || reason?.toLowerCase().includes('pre-auth')
                      ? `Pending Approval • ${reason}`
                      : `Rejected • ${reason}`
                  }
                </span>
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
