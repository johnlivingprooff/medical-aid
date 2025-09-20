import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { ManageSchemesModal } from '@/components/modals/manage-schemes-modal'
import type { SchemeBenefit, SubscriptionTier } from '@/types/models'

type Member = { id: number; username: string; joined: string; next_renewal: string; amount_spent_12m: number }
type Scheme = { id: number; name: string; description?: string; price: number; members: Member[]; benefits: SchemeBenefit[]; subscription_tiers: SubscriptionTier[] }

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

      {/* <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Scheme Price</CardTitle>
            <CardDescription>Sum of benefit limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(scheme.price || 0)}</div>
          </CardContent>
        </Card>
      </div> */}

      <Card>
        <CardHeader>
          <CardTitle>Benefits Breakdown</CardTitle>
          <CardDescription>Individual benefits and coverage details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {scheme.benefits?.length ? (
              <>
                {/* Total Benefits Summary */}
                <div className="p-4 border-2 rounded-lg border-primary/20 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Total Benefits Value</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(scheme.price || 0)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Active Benefits</div>
                      <div className="text-lg font-semibold">{scheme.benefits.filter(b => b.is_active).length}</div>
                    </div>
                  </div>
                </div>

                {/* Individual Benefits */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {scheme.benefits.map((benefit) => (
                    <div key={benefit.id} className="p-4 border rounded-lg shadow-sm bg-card">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">{benefit.benefit_type_detail.name}</h4>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            benefit.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                          }`}>
                            {benefit.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Coverage Amount</span>
                            <span className="font-medium">
                              {benefit.coverage_amount ? formatCurrency(benefit.coverage_amount) : 'Unlimited'}
                            </span>
                          </div>

                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Period</span>
                            <span className="font-medium">
                              {benefit.coverage_period.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </div>

                          {benefit.coverage_limit_count && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Limit Count</span>
                              <span className="font-medium">{benefit.coverage_limit_count}</span>
                            </div>
                          )}

                          {benefit.waiting_period_days > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Waiting Period</span>
                              <span className="font-medium">{benefit.waiting_period_days} days</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Effective: {new Date(benefit.effective_date).toLocaleDateString()}</span>
                            {benefit.expiry_date && (
                              <span>Expires: {new Date(benefit.expiry_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <div className="text-sm">No benefits configured for this scheme.</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription Tiers</CardTitle>
          <CardDescription>Available subscription options for this scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {scheme.subscription_tiers?.length ? (
              <>
                {/* Subscription Tiers Summary */}
                <div className="p-4 border-2 rounded-lg border-primary/20 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Available Tiers</div>
                      <div className="text-2xl font-bold text-primary">{scheme.subscription_tiers.filter(t => t.is_active).length}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Price Range</div>
                      <div className="text-lg font-semibold">
                        {formatCurrency(Math.min(...scheme.subscription_tiers.filter(t => t.is_active).map(t => t.monthly_price)))} - {formatCurrency(Math.max(...scheme.subscription_tiers.filter(t => t.is_active).map(t => t.monthly_price)))}/month
                      </div>
                    </div>
                  </div>
                </div>

                {/* Individual Subscription Tiers */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {scheme.subscription_tiers.filter(tier => tier.is_active).map((tier) => {
                    const isChildFriendly = tier.max_dependents > 0;
                    return (
                      <div key={tier.id} className={`p-4 border rounded-lg shadow-sm bg-card ${isChildFriendly ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''}`}>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium">{tier.name}</h4>
                              {isChildFriendly && (
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                  👨‍👩‍👧‍👦 Family
                                </span>
                              )}
                            </div>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              tier.tier_type === 'PREMIUM' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                              tier.tier_type === 'ENTERPRISE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                              tier.tier_type === 'STANDARD' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                            }`}>
                              {tier.tier_type}
                            </span>
                          </div>

                          {tier.description && (
                            <p className="text-xs text-muted-foreground">{tier.description}</p>
                          )}

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Monthly:</span>
                              <span className="font-medium">{formatCurrency(tier.monthly_price)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Yearly:</span>
                              <span className="font-medium">{formatCurrency(tier.yearly_price)}</span>
                            </div>
                            {tier.max_dependents > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Max Dependents:</span>
                                <span className="font-medium">{tier.max_dependents}</span>
                              </div>
                            )}
                            {tier.max_coverage_per_year && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Annual Coverage:</span>
                                <span className="font-medium">{formatCurrency(tier.max_coverage_per_year)}</span>
                              </div>
                            )}
                          </div>

                          {tier.benefit_categories?.length > 0 && (
                            <div className="pt-2 border-t">
                              <div className="mb-1 text-xs text-muted-foreground">Includes:</div>
                              <div className="flex flex-wrap gap-1">
                                {tier.benefit_categories.slice(0, 3).map((category) => (
                                  <span key={category.id} className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground">
                                    {category.name}
                                  </span>
                                ))}
                                {tier.benefit_categories.length > 3 && (
                                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground">
                                    +{tier.benefit_categories.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <div className="text-sm">No subscription tiers configured for this scheme.</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                <div key={m.id} className="p-3 border rounded">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">{m.username}</div>
                    <div className="text-muted-foreground">{percent}% used</div>
                  </div>
                  <div className="h-2 mt-2 rounded bg-muted">
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
