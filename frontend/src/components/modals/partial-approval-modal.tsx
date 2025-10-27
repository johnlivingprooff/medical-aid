import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import type { Claim, CoverageBalance } from '@/types/models'

interface Props {
  claim: Claim
  onClose: () => void
  onApproved: (updatedClaim: Claim) => void
}

export function PartialApprovalModal({ claim, onClose, onApproved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<{ remaining?: number; coverage_amount?: number } | null>(null)
  const [approvedAmount, setApprovedAmount] = useState<string>('')

  const claimAmount = useMemo(() => Number(claim.cost || 0), [claim.cost])

  useEffect(() => {
    let isMounted = true
    const fetchCoverage = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get<CoverageBalance>(`/api/patients/${claim.patient}/coverage-balance/`)
        const match = res.balances.find(b => b.benefit_type === claim.service_type)
        const remaining = match?.remaining_amount ?? undefined
        const coverage_amount = match?.coverage_amount ?? undefined
        if (isMounted) {
          setCoverage({ remaining, coverage_amount })
          const def = Math.min(claimAmount, Number(remaining ?? 0))
          setApprovedAmount(def > 0 ? String(def) : '')
        }
      } catch (e: any) {
        console.warn('Failed to load coverage balance', e)
        if (isMounted) setCoverage(null)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchCoverage()
    return () => { isMounted = false }
  }, [claim.patient, claim.service_type, claimAmount])

  const remaining = coverage?.remaining ?? undefined

  const approve = async () => {
    setLoading(true)
    setError(null)
    try {
      // Backend computes the approved amount itself; we call without payload
      const res = await api.post<{ detail: string; claim: Claim; approved_amount: number; member_responsibility: number }>(
        `/api/claims/${claim.id}/approve-coverage-limit/`
      )
      onApproved(res.claim)
    } catch (e: any) {
      const msg = e?.message || 'Failed to approve up to coverage limit'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Approve up to coverage limit</CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 border border-red-200 bg-red-50 rounded-md p-3 text-sm flex items-start">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Claim amount</Label>
                <Input value={claimAmount.toFixed(2)} readOnly />
              </div>
              <div>
                <Label>Remaining coverage (est.)</Label>
                <Input value={remaining !== undefined ? Number(remaining).toFixed(2) : '—'} readOnly />
              </div>
            </div>

            <div>
              <Label>Approved amount</Label>
              <Input 
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                readOnly
                title="Amount is determined by backend to the lesser of remaining coverage and claim amount"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Amount is auto-calculated on the server as the lesser of remaining coverage and claim amount.
              </p>
            </div>

            <Separator />

            <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
              <div className="text-sm text-emerald-800">
                Provider will receive an alert with the approved amount and the member’s balance due.
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button onClick={approve} disabled={loading}>{loading ? 'Approving…' : 'Approve up to limit'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
