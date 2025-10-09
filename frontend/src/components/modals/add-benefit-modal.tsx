import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api'
import { X } from 'lucide-react'
import type { SchemeCategory, BenefitType } from '@/types/models'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  scheme: SchemeCategory | null
  onSave: () => void
}

export function AddBenefitModal({ open, onOpenChange, scheme, onSave }: Props) {
  // Benefit Type Selection (from manage-schemes-modal)
  const [benefitTypes, setBenefitTypes] = useState<BenefitType[]>([])
  const [benefitType, setBenefitType] = useState<number | ''>('')
  const [newTypeName, setNewTypeName] = useState('')

  // Coverage Settings (from edit-benefit-modal)
  const [coverageAmount, setCoverageAmount] = useState('')
  const [coverageLimitCount, setCoverageLimitCount] = useState('')
  const [coveragePeriod, setCoveragePeriod] = useState('YEARLY')

  // Patient Costs (from edit-benefit-modal)
  const [deductibleAmount, setDeductibleAmount] = useState('')
  const [copaymentPercentage, setCopaymentPercentage] = useState('')
  const [copaymentFixed, setCopaymentFixed] = useState('')

  // Authorization & Restrictions (from edit-benefit-modal)
  const [requiresPreauth, setRequiresPreauth] = useState(false)
  const [preauthLimit, setPreauthLimit] = useState('')
  const [waitingPeriodDays, setWaitingPeriodDays] = useState('')
  const [networkOnly, setNetworkOnly] = useState(false)

  // Dates & Status (from edit-benefit-modal)
  const [effectiveDate, setEffectiveDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      resetForm()
      return
    }

    // Load benefit types when modal opens
    api.get<BenefitType[]>('/api/schemes/benefit-types/')
      .then((resp: any) => setBenefitTypes(resp.results ?? resp))
      .catch(() => setBenefitTypes([]))
  }, [open])

  function resetForm() {
    setBenefitType('')
    setNewTypeName('')
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

  async function ensureBenefitType(): Promise<number> {
    if (benefitType) return benefitType as number
    if (!newTypeName.trim()) throw new Error('Select a benefit type or enter a new one')
    
    const created = await api.post<BenefitType>('/api/schemes/benefit-types/', { 
      name: newTypeName.trim() 
    })
    
    // Update list and select it
    setBenefitTypes([created, ...benefitTypes])
    setNewTypeName('')
    setBenefitType(created.id)
    return created.id
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scheme) return

    setError(null)
    setSaving(true)

    try {
      const btId = await ensureBenefitType()
      
      const benefitData = {
        scheme: scheme.id,
        benefit_type: btId,
        coverage_amount: coverageAmount ? Number(coverageAmount) : undefined,
        coverage_limit_count: coverageLimitCount ? Number(coverageLimitCount) : undefined,
        coverage_period: coveragePeriod,
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

      await api.post('/api/schemes/benefits/', benefitData)
      onSave()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to add benefit')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !scheme) return null

  return (
    <div 
      className="fixed inset-0 z-50 grid p-4 place-items-center bg-black/40"
      onClick={() => onOpenChange(false)}
    >
      <Card 
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Add Benefit to {scheme.name}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm rounded-md text-destructive bg-destructive/10">
                {error}
              </div>
            )}

            {/* Benefit Type Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Benefit Type</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Benefit Type</Label>
                  <select
                    className="w-full px-3 text-sm border rounded-md h-9 bg-background"
                    value={benefitType === '' ? (newTypeName ? 'new' : '') : benefitType}
                    onChange={(e) => {
                      if (e.target.value === 'new') {
                        setBenefitType('');
                      } else {
                        setBenefitType(e.target.value ? Number(e.target.value) : '');
                        setNewTypeName('');
                      }
                    }}
                  >
                    <option value="">Select benefit type…</option>
                    {benefitTypes.map((bt) => (
                      <option key={bt.id} value={bt.id}>
                        {bt.name}
                      </option>
                    ))}
                    <option value="new">+ Add new benefit type…</option>
                  </select>
                </div>
                {benefitType === '' && (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Enter new type name"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        style={{
                          width: `${Math.max(12, newTypeName.length * 0.75 + 2)}ch`,
                          minWidth: '12ch',
                          maxWidth: '100%',
                          transition: 'width 0.2s',
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await ensureBenefitType();
                        } catch (e) {}
                      }}
                      disabled={!newTypeName.trim()}
                    >
                      Add Benefit Type
                    </Button>
                  </div>
                )}
              </div>
            </div>

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
                {saving ? 'Adding...' : 'Add Benefit'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}