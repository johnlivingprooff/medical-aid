import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowUp, ArrowDown, Check, Star, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { subscriptionApi } from '@/lib/api'
import type { MemberSubscription, SubscriptionTier } from '@/types/models'
import { formatCurrency } from '@/lib/currency'
import { Skeleton } from '@/components/ui/skeleton'

interface SubscriptionManagementProps {
  patientId?: number;
  className?: string;
}

export function SubscriptionManagement({ patientId, className }: SubscriptionManagementProps) {
  const [currentSubscription, setCurrentSubscription] = useState<MemberSubscription | null>(null)
  const [availableTiers, setAvailableTiers] = useState<SubscriptionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) {
      setCurrentSubscription(null)
      setAvailableTiers([])
      setError(null)
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        // Reset state when patientId changes
        setCurrentSubscription(null)
        setAvailableTiers([])

        // Load current subscription
        const subscriptionResponse = await subscriptionApi.getMemberSubscriptions({ patient: patientId })
        const subscription = subscriptionResponse.results[0] // Get first active subscription
        setCurrentSubscription(subscription)

        // Load available tiers for the scheme
        if (subscription) {
          const tiersResponse = await subscriptionApi.getSubscriptionTiers({ 
            scheme: subscription.tier_detail.scheme,
            is_active: true 
          })
          setAvailableTiers(tiersResponse.results)
        }

      } catch (err: any) {
        setError(err.message || 'Failed to load subscription data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [patientId])

  const handleUpgrade = async (newTierId: number) => {
    if (!currentSubscription) return

    try {
      setUpgrading(true)
      setError(null)

      await subscriptionApi.upgradeSubscription(currentSubscription.id, {
        new_tier_id: newTierId
      })

      // Reload subscription data
      const subscriptionResponse = await subscriptionApi.getMemberSubscriptions({ patient: patientId })
      const updatedSubscription = subscriptionResponse.results[0]
      setCurrentSubscription(updatedSubscription)

    } catch (err: any) {
      setError(err.message || 'Failed to upgrade subscription')
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Subscription Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="w-full h-32" />
            <Skeleton className="w-full h-24" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !currentSubscription) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Subscription Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-destructive font-medium mb-2">Error</div>
            <div className="text-sm">{error || 'No active subscription found'}</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentTier = currentSubscription.tier_detail
  const upgradeOptions = availableTiers.filter(tier => tier.sort_order > currentTier.sort_order)
  const downgradeOptions = availableTiers.filter(tier => tier.sort_order < currentTier.sort_order)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5" />
          Subscription Management
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Manage your subscription tier and benefits
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Subscription */}
        <div className="p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full"></div>
              <span className="font-medium">Current Plan</span>
            </div>
            <Badge variant="default" className="bg-primary">
              {currentTier.tier_type}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Tier</div>
              <div className="font-medium">{currentTier.name}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Monthly Cost</div>
              <div className="font-medium">{formatCurrency(currentTier.monthly_price)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Annual Limit</div>
              <div className="font-medium">
                {currentTier.max_coverage_per_year 
                  ? formatCurrency(currentTier.max_coverage_per_year) 
                  : 'Unlimited'
                }
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Next billing: {currentSubscription.next_payment_date 
              ? new Date(currentSubscription.next_payment_date).toLocaleDateString() 
              : 'N/A'
            }
          </div>
        </div>

        {/* Upgrade Options */}
        {upgradeOptions.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-success" />
              Upgrade Options
            </h4>

            <div className="space-y-3">
              {upgradeOptions.map((tier) => (
                <div key={tier.id} className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                        <Zap className="w-4 h-4 text-success" />
                      </div>
                      <div>
                        <div className="font-medium">{tier.name}</div>
                        <div className="text-sm text-muted-foreground">{tier.tier_type} Tier</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(tier.monthly_price)}</div>
                      <div className="text-sm text-muted-foreground">per month</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <div className="text-muted-foreground">Annual Limit</div>
                      <div className="font-medium">
                        {tier.max_coverage_per_year 
                          ? formatCurrency(tier.max_coverage_per_year) 
                          : 'Unlimited'
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Max Dependents</div>
                      <div className="font-medium">{tier.max_dependents}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Monthly savings: {formatCurrency(currentTier.monthly_price - tier.monthly_price)}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleUpgrade(tier.id)}
                      disabled={upgrading}
                      className="bg-success hover:bg-success/90"
                    >
                      {upgrading ? 'Upgrading...' : 'Upgrade'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Downgrade Options */}
        {downgradeOptions.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-warning" />
              Downgrade Options
            </h4>

            <div className="space-y-3">
              {downgradeOptions.map((tier) => (
                <div key={tier.id} className="p-4 border rounded-lg hover:border-warning/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-warning/10 rounded-full flex items-center justify-center">
                        <ArrowDown className="w-4 h-4 text-warning" />
                      </div>
                      <div>
                        <div className="font-medium">{tier.name}</div>
                        <div className="text-sm text-muted-foreground">{tier.tier_type} Tier</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(tier.monthly_price)}</div>
                      <div className="text-sm text-muted-foreground">per month</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <div className="text-muted-foreground">Annual Limit</div>
                      <div className="font-medium">
                        {tier.max_coverage_per_year 
                          ? formatCurrency(tier.max_coverage_per_year) 
                          : 'Unlimited'
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Max Dependents</div>
                      <div className="font-medium">{tier.max_dependents}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Monthly cost increase: {formatCurrency(tier.monthly_price - currentTier.monthly_price)}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleUpgrade(tier.id)}
                      disabled={upgrading}
                      className="border-warning text-warning hover:bg-warning/10"
                    >
                      {upgrading ? 'Downgrading...' : 'Downgrade'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Options Available */}
        {upgradeOptions.length === 0 && downgradeOptions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Check className="w-12 h-12 mx-auto mb-4 text-success" />
            <div className="font-medium">You're on the optimal plan</div>
            <div className="text-sm">No upgrade or downgrade options available at this time.</div>
          </div>
        )}

        {/* Subscription Status */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subscription Status</span>
            <Badge variant={currentSubscription.status === 'ACTIVE' ? 'success' : 'warning'}>
              {currentSubscription.status}
            </Badge>
          </div>

          {currentSubscription.auto_renew && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Auto Renewal</span>
              <Badge variant="outline">Enabled</Badge>
            </div>
          )}

          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Renewal Date</span>
            <span>
              {currentSubscription.end_date 
                ? new Date(currentSubscription.end_date).toLocaleDateString() 
                : 'N/A'
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}