import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api'
import { capitalizeFirst } from '@/lib/format-text'
import { X } from 'lucide-react'
import type { SchemeBenefit } from '@/types/models'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  benefit: SchemeBenefit | null
  onSave: () => void
}

export function EditBenefitModal({ open, onOpenChange, benefit, onSave }: Props) {
  const [coverageAmount, setCoverageAmount] = useState('')
  const [coverageLimitCount, setCoverageLimitCount] = useState('')
  const [coveragePeriod, setCoveragePeriod] = useState('YEARLY')
  const [deductibleAmount, setDeductibleAmount] = useState('')
  const [copaymentPercentage, setCopaymentPercentage] = useState('')
  const [copaymentFixed, setCopaymentFixed] = useState('')
  const [requiresPreauth, setRequiresPreauth] = useState(false)
  const [preauthLimit, setPreauthLimit] = useState('')
  const [waitingPeriodDays, setWaitingPeriodDays] = useState('')
  const [networkOnly, setNetworkOnly] = useState(false)
  const [effectiveDate, setEffectiveDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !benefit) {
      // Reset form when modal closes
      resetForm()
      return
    }

    // Pre-fill form with benefit data
    setCoverageAmount(benefit.coverage_amount?.toString() || '')
    setCoverageLimitCount(benefit.coverage_limit_count?.toString() || '')
    setCoveragePeriod(benefit.coverage_period || 'YEARLY')
    setDeductibleAmount(benefit.deductible_amount?.toString() || '0')
    setCopaymentPercentage(benefit.copayment_percentage?.toString() || '0')
    setCopaymentFixed(benefit.copayment_fixed?.toString() || '0')
    setRequiresPreauth(benefit.requires_preauth || false)
    setPreauthLimit(benefit.preauth_limit?.toString() || '')
    setWaitingPeriodDays(benefit.waiting_period_days?.toString() || '0')
    setNetworkOnly(benefit.network_only || false)
    setEffectiveDate(benefit.effective_date ? benefit.effective_date.slice(0, 10) : '')
    setExpiryDate(benefit.expiry_date ? benefit.expiry_date.slice(0, 10) : '')
    setIsActive(benefit.is_active)
  }, [open, benefit])

  function resetForm() {
    setCoverageAmount('')
    setCoverageLimitCount('')
    setCoveragePeriod('YEARLY')
    setDeductibleAmount('0')
    setCopaymentPercentage('0')
    setCopaymentFixed('0')
    setRequiresPreauth(false)
    setPreauthLimit('')
    setWaitingPeriodDays('0')
    setNetworkOnly(false)
    setEffectiveDate('')
    setExpiryDate('')
    setIsActive(true)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!benefit) return

    setError(null)
    setSaving(true)

    try {
      const updateData: Partial<SchemeBenefit> = {
        coverage_amount: coverageAmount ? Number(coverageAmount) : undefined,
        coverage_limit_count: coverageLimitCount ? Number(coverageLimitCount) : undefined,
        coverage_period: coveragePeriod as any,
        deductible_amount: Number(deductibleAmount) || 0,
        copayment_percentage: Number(copaymentPercentage) || 0,
        copayment_fixed: Number(copaymentFixed) || 0,
        requires_preauth: requiresPreauth,
        preauth_limit: preauthLimit ? Number(preauthLimit) : undefined,
        waiting_period_days: Number(waitingPeriodDays) || 0,
        network_only: networkOnly,
        effective_date: effectiveDate || undefined,
        expiry_date: expiryDate || undefined,
        is_active: isActive,
      }

      await api.patch(`/api/schemes/benefits/${benefit.id}/`, updateData)
      onSave()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to update benefit')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !benefit) return null

  return (
    <div 
      className="fixed inset-0 z-50 grid p-4 place-items-center bg-black/40"
      onClick={() => onOpenChange(false)}
    >
      <Card 
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
          <CardTitle>Edit Benefit: {capitalizeFirst(benefit.benefit_type_detail?.name)}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="w-6 h-6 p-0 hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm rounded-md text-destructive bg-destructive/10">
                {error}
              </div>
            )}

            {/* Coverage Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Coverage Settings</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="coverageAmount">Coverage Amount (MWK)</Label>
                  <Input
                    id="coverageAmount"
                    type="number"
                    value={coverageAmount}
                    onChange={(e) => setCoverageAmount(e.target.value)}
                    placeholder="e.g. 500000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coverageLimitCount">Limit Count</Label>
                  <Input
                    id="coverageLimitCount"
                    type="number"
                    value={coverageLimitCount}
                    onChange={(e) => setCoverageLimitCount(e.target.value)}
                    placeholder="e.g. 12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coveragePeriod">Coverage Period</Label>
                  <select 
                    id="coveragePeriod"
                    className="w-full px-3 text-sm border rounded-md h-9 bg-background" 
                    value={coveragePeriod} 
                    onChange={(e) => setCoveragePeriod(e.target.value)}
                  >
                    <option value="PER_VISIT">Per Visit</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="LIFETIME">Lifetime</option>
                    <option value="BENEFIT_YEAR">Benefit Year</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Patient Costs */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Patient Costs</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="deductibleAmount">Deductible Amount (MWK)</Label>
                  <Input
                    id="deductibleAmount"
                    type="number"
                    value={deductibleAmount}
                    onChange={(e) => setDeductibleAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="copaymentPercentage">Copayment Percentage (%)</Label>
                  <Input
                    id="copaymentPercentage"
                    type="number"
                    step="0.01"
                    max="100"
                    value={copaymentPercentage}
                    onChange={(e) => setCopaymentPercentage(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="copaymentFixed">Fixed Copayment (MWK)</Label>
                  <Input
                    id="copaymentFixed"
                    type="number"
                    value={copaymentFixed}
                    onChange={(e) => setCopaymentFixed(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Authorization & Restrictions */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Authorization & Restrictions</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requiresPreauth"
                      checked={requiresPreauth}
                      onChange={setRequiresPreauth}
                    />
                    <Label htmlFor="requiresPreauth">Requires Pre-authorization</Label>
                  </div>
                  {requiresPreauth && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="preauthLimit">Pre-auth Limit (MWK)</Label>
                      <Input
                        id="preauthLimit"
                        type="number"
                        value={preauthLimit}
                        onChange={(e) => setPreauthLimit(e.target.value)}
                        placeholder="Amount requiring pre-auth"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="networkOnly"
                      checked={networkOnly}
                      onChange={setNetworkOnly}
                    />
                    <Label htmlFor="networkOnly">Network Providers Only</Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="waitingPeriodDays">Waiting Period (Days)</Label>
                    <Input
                      id="waitingPeriodDays"
                      type="number"
                      value={waitingPeriodDays}
                      onChange={(e) => setWaitingPeriodDays(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dates & Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Dates & Status</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="effectiveDate">Effective Date</Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isActive"
                      checked={isActive}
                      onChange={setIsActive}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}