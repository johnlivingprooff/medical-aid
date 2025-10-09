import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { X, Plus } from 'lucide-react'
import type { SchemeCategory, SubscriptionTier, BenefitCategory } from '@/types/models'

type SchemeForModal = {
  id: number
  name: string
  description?: string
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  scheme: SchemeForModal | null
  onSave: () => void
}

export function AddSubscriptionTierModal({ open, onOpenChange, scheme, onSave }: Props) {
  const [name, setName] = useState('')
  const [tierType, setTierType] = useState<'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE'>('STANDARD')
  const [description, setDescription] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const [yearlyPrice, setYearlyPrice] = useState('')
  const [maxDependents, setMaxDependents] = useState('')
  const [maxClaimsPerMonth, setMaxClaimsPerMonth] = useState('')
  const [maxCoveragePerYear, setMaxCoveragePerYear] = useState('')
  const [sortOrder, setSortOrder] = useState('')
  const [isActive, setIsActive] = useState(true)
  
  const [benefitCategories, setBenefitCategories] = useState<BenefitCategory[]>([])
  const [selectedBenefitCategories, setSelectedBenefitCategories] = useState<number[]>([])
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      resetForm()
      return
    }

    // Load benefit categories when modal opens
    api.get<BenefitCategory[]>('/api/schemes/benefit-categories/')
      .then((resp: any) => setBenefitCategories(resp.results ?? resp))
      .catch(() => setBenefitCategories([]))
  }, [open])

  function resetForm() {
    setName('')
    setTierType('STANDARD')
    setDescription('')
    setMonthlyPrice('')
    setYearlyPrice('')
    setMaxDependents('')
    setMaxClaimsPerMonth('')
    setMaxCoveragePerYear('')
    setSortOrder('')
    setIsActive(true)
    setSelectedBenefitCategories([])
    setError(null)
  }

  // Auto-calculate yearly price when monthly price changes
  useEffect(() => {
    if (monthlyPrice && !yearlyPrice) {
      const monthly = parseFloat(monthlyPrice)
      if (!isNaN(monthly)) {
        // Apply 15% discount for yearly subscription
        setYearlyPrice((monthly * 12 * 0.85).toFixed(2))
      }
    }
  }, [monthlyPrice, yearlyPrice])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scheme) return

    setError(null)
    setSaving(true)

    try {
      const tierData = {
        name: name.trim(),
        scheme: scheme.id,
        tier_type: tierType,
        description: description.trim(),
        monthly_price: monthlyPrice ? parseFloat(monthlyPrice) : 0,
        yearly_price: yearlyPrice ? parseFloat(yearlyPrice) : 0,
        max_dependents: maxDependents ? parseInt(maxDependents) : 0,
        max_claims_per_month: maxClaimsPerMonth ? parseInt(maxClaimsPerMonth) : null,
        max_coverage_per_year: maxCoveragePerYear ? parseFloat(maxCoveragePerYear) : null,
        sort_order: sortOrder ? parseInt(sortOrder) : 0,
        is_active: isActive,
        benefit_category_ids: selectedBenefitCategories,
      }

      await api.post('/api/schemes/subscription-tiers/', tierData)
      onSave()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to add subscription tier')
    } finally {
      setSaving(false)
    }
  }

  function handleBenefitCategoryToggle(categoryId: number) {
    setSelectedBenefitCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  if (!open || !scheme) return null

  return (
    <div 
      className="fixed inset-0 z-50 grid p-4 place-items-center bg-black/40"
      onClick={() => onOpenChange(false)}
    >
      <Card 
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Add Subscription Tier to {scheme.name}</CardTitle>
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

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Basic Information</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Tier Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Premium Family Plan"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tierType">Tier Type</Label>
                  <select 
                    id="tierType"
                    className="w-full px-3 text-sm border rounded-md h-9 bg-background" 
                    value={tierType} 
                    onChange={(e) => setTierType(e.target.value as any)}
                  >
                    <option value="BASIC">Basic</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this tier includes..."
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Pricing</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="monthlyPrice">Monthly Price (MWK)</Label>
                  <Input
                    id="monthlyPrice"
                    type="number"
                    step="0.01"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="e.g. 500.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearlyPrice">Yearly Price (MWK)</Label>
                  <Input
                    id="yearlyPrice"
                    type="number"
                    step="0.01"
                    value={yearlyPrice}
                    onChange={(e) => setYearlyPrice(e.target.value)}
                    placeholder="Auto-calculated or custom"
                    required
                  />
                  {monthlyPrice && yearlyPrice && (
                    <div className="text-xs text-muted-foreground">
                      {((parseFloat(monthlyPrice) * 12 - parseFloat(yearlyPrice)) / (parseFloat(monthlyPrice) * 12) * 100).toFixed(1)}% yearly discount
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Limits */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Limits & Features</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="maxDependents">Max Dependents</Label>
                  <Input
                    id="maxDependents"
                    type="number"
                    value={maxDependents}
                    onChange={(e) => setMaxDependents(e.target.value)}
                    placeholder="0 = unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxClaimsPerMonth">Max Claims/Month</Label>
                  <Input
                    id="maxClaimsPerMonth"
                    type="number"
                    value={maxClaimsPerMonth}
                    onChange={(e) => setMaxClaimsPerMonth(e.target.value)}
                    placeholder="Leave empty = unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxCoveragePerYear">Max Coverage/Year (MWK)</Label>
                  <Input
                    id="maxCoveragePerYear"
                    type="number"
                    step="0.01"
                    value={maxCoveragePerYear}
                    onChange={(e) => setMaxCoveragePerYear(e.target.value)}
                    placeholder="Leave empty = unlimited"
                  />
                </div>
              </div>
            </div>

            {/* Benefit Categories */}
            {benefitCategories.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Included Benefit Categories</h3>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {benefitCategories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`category-${category.id}`}
                        checked={selectedBenefitCategories.includes(category.id)}
                        onChange={() => handleBenefitCategoryToggle(category.id)}
                        className="rounded"
                      />
                      <label htmlFor={`category-${category.id}`} className="text-sm">
                        {category.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Settings</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded"
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
                {saving ? 'Adding...' : 'Add Subscription Tier'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}