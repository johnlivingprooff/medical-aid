import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table'
import { api, subscriptionApi } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { Plus, Edit, Trash2, Users, DollarSign } from 'lucide-react'
import type { SubscriptionTier, SchemeCategory, BenefitCategory } from '@/types/models'

interface SubscriptionTierFormData {
  name: string
  scheme: string // Changed to string for Select component compatibility
  tier_type: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE'
  description: string
  monthly_price: string // Changed to string for input handling
  yearly_price: string // Changed to string for input handling
  max_dependents: string // Changed to string for input handling
  max_claims_per_month: string // Changed to string for input handling
  max_coverage_per_year: string // Changed to string for input handling
  benefit_categories: number[]
  is_active: boolean
  sort_order: string // Changed to string for input handling
}

export default function SubscriptionTiersAdmin() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([])
  const [schemes, setSchemes] = useState<SchemeCategory[]>([])
  const [benefitCategories, setBenefitCategories] = useState<BenefitCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<SubscriptionTierFormData>({
    name: '',
    scheme: '',
    tier_type: 'BASIC',
    description: '',
    monthly_price: '',
    yearly_price: '',
    max_dependents: '',
    max_claims_per_month: '',
    max_coverage_per_year: '',
    benefit_categories: [],
    is_active: true,
    sort_order: '0'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [tiersResponse, schemesResponse, categoriesResponse] = await Promise.all([
        subscriptionApi.getSubscriptionTiers(),
        api.get('/api/schemes/categories/'),
        subscriptionApi.getBenefitCategories()
      ])

      setTiers(tiersResponse.results || tiersResponse)
      setSchemes((schemesResponse as any).results || schemesResponse)
      setBenefitCategories(categoriesResponse.results || categoriesResponse)
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      scheme: '',
      tier_type: 'BASIC',
      description: '',
      monthly_price: '',
      yearly_price: '',
      max_dependents: '',
      max_claims_per_month: '',
      max_coverage_per_year: '',
      benefit_categories: [],
      is_active: true,
      sort_order: '0'
    })
    setEditingTier(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setShowCreateDialog(true)
  }

  const openEditDialog = (tier: SubscriptionTier) => {
    setFormData({
      name: tier.name,
      scheme: tier.scheme.toString(),
      tier_type: tier.tier_type,
      description: tier.description,
      monthly_price: tier.monthly_price.toString(),
      yearly_price: tier.yearly_price.toString(),
      max_dependents: tier.max_dependents.toString(),
      max_claims_per_month: tier.max_claims_per_month?.toString() || '',
      max_coverage_per_year: tier.max_coverage_per_year?.toString() || '',
      benefit_categories: tier.benefit_category_ids || [],
      is_active: tier.is_active,
      sort_order: tier.sort_order.toString()
    })
    setEditingTier(tier)
    setShowCreateDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      // Convert form data to proper types for API
      const data = {
        name: formData.name,
        scheme: parseInt(formData.scheme),
        tier_type: formData.tier_type,
        description: formData.description,
        monthly_price: parseFloat(formData.monthly_price),
        yearly_price: parseFloat(formData.yearly_price),
        max_dependents: parseInt(formData.max_dependents),
        max_claims_per_month: formData.max_claims_per_month ? parseInt(formData.max_claims_per_month) : undefined,
        max_coverage_per_year: formData.max_coverage_per_year ? parseFloat(formData.max_coverage_per_year) : undefined,
        benefit_category_ids: formData.benefit_categories,
        is_active: formData.is_active,
        sort_order: parseInt(formData.sort_order)
      }

      if (editingTier) {
        await subscriptionApi.updateSubscriptionTier(editingTier.id, data)
      } else {
        await subscriptionApi.createSubscriptionTier(data)
      }

      await loadData()
      setShowCreateDialog(false)
      resetForm()
    } catch (err: any) {
      setError(err.message || 'Failed to save subscription tier')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tier: SubscriptionTier) => {
    if (!confirm(`Are you sure you want to delete "${tier.name}"?`)) return

    try {
      await subscriptionApi.deleteSubscriptionTier(tier.id)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to delete subscription tier')
    }
  }

  const getSchemeName = (schemeId: number) => {
    const scheme = schemes.find(s => s.id === schemeId)
    return scheme?.name || 'Unknown'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Subscription Tiers Management</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-8 bg-muted rounded"></div>
              <div className="h-8 bg-muted rounded"></div>
              <div className="h-8 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription Tiers Management</h1>
          <p className="text-muted-foreground">Create and manage subscription tiers for medical aid schemes</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Tier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTier ? 'Edit' : 'Create'} Subscription Tier</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="scheme">Scheme</Label>
                  <Select
                    value={formData.scheme}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, scheme: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scheme" />
                    </SelectTrigger>
                    <SelectContent>
                      {schemes.map(scheme => (
                        <SelectItem key={scheme.id} value={scheme.id.toString()}>
                          {scheme.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="tier_type">Tier Type</Label>
                <Select
                  value={formData.tier_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tier_type: value as 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASIC">Basic</SelectItem>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="PREMIUM">Premium</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="monthly_price">Monthly Price</Label>
                  <Input
                    id="monthly_price"
                    type="number"
                    step="0.01"
                    value={formData.monthly_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthly_price: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="yearly_price">Yearly Price</Label>
                  <Input
                    id="yearly_price"
                    type="number"
                    step="0.01"
                    value={formData.yearly_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, yearly_price: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max_dependents">Max Dependents</Label>
                  <Input
                    id="max_dependents"
                    type="number"
                    value={formData.max_dependents}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_dependents: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max_claims_per_month">Max Claims/Month</Label>
                  <Input
                    id="max_claims_per_month"
                    type="number"
                    value={formData.max_claims_per_month}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_claims_per_month: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="max_coverage_per_year">Max Coverage/Year</Label>
                  <Input
                    id="max_coverage_per_year"
                    type="number"
                    step="0.01"
                    value={formData.max_coverage_per_year}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_coverage_per_year: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Benefit Categories</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {benefitCategories.map(category => (
                    <label key={category.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.benefit_categories.includes(category.id)}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setFormData(prev => ({
                            ...prev,
                            benefit_categories: checked
                              ? [...prev.benefit_categories, category.id]
                              : prev.benefit_categories.filter(id => id !== category.id)
                          }))
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{category.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : (editingTier ? 'Update' : 'Create')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Subscription Tiers ({tiers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Scheme</Th>
                <Th>Type</Th>
                <Th>Pricing</Th>
                <Th>Dependents</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {tiers.map(tier => (
                <Tr key={tier.id}>
                  <Td className="font-medium">{tier.name}</Td>
                  <Td>{getSchemeName(tier.scheme)}</Td>
                  <Td>
                    <Badge variant={
                      tier.tier_type === 'PREMIUM' ? 'default' :
                      tier.tier_type === 'ENTERPRISE' ? 'info' :
                      tier.tier_type === 'STANDARD' ? 'outline' : 'outline'
                    }>
                      {tier.tier_type}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="text-sm">
                      <div>{formatCurrency(tier.monthly_price)}/mo</div>
                      <div className="text-muted-foreground">{formatCurrency(tier.yearly_price)}/yr</div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {tier.max_dependents}
                    </div>
                  </Td>
                  <Td>
                    <Badge variant={tier.is_active ? 'success' : 'outline'}>
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(tier)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(tier)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          {tiers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No subscription tiers found. Create your first tier to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}