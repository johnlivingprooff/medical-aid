import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, Clock, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { subscriptionApi } from '@/lib/api'
import type { MemberSubscription, SubscriptionUsageStats } from '@/types/models'
import { formatCurrency } from '@/lib/currency'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface SubscriptionCoverageCardProps {
  patientId?: number;
  member?: any; // Member object with scheme information
  className?: string;
}

export function SubscriptionCoverageCard({ patientId, member, className }: SubscriptionCoverageCardProps) {
  const [subscription, setSubscription] = useState<MemberSubscription | null>(null)
  const [usageStats, setUsageStats] = useState<SubscriptionUsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [showSetupDialog, setShowSetupDialog] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [availableTiers, setAvailableTiers] = useState<any[]>([])
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const [subscriptionType, setSubscriptionType] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [settingUp, setSettingUp] = useState(false)

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)
      setError(null)
      // Reset state when patientId changes
      setSubscription(null)
      setUsageStats(null)

      // Get patient's subscription
      const subscriptionsResponse = await subscriptionApi.getMemberSubscriptions({
        patient: patientId,
        status: 'ACTIVE'
      })

      if (subscriptionsResponse.results && subscriptionsResponse.results.length > 0) {
        const activeSubscription = subscriptionsResponse.results[0]
        setSubscription(activeSubscription)

        // Get usage statistics
        const usageResponse = await subscriptionApi.getSubscriptionUsage(activeSubscription.id)
        setUsageStats(usageResponse)
      } else {
        setSubscription(null)
        setUsageStats(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription data')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableTiers = async () => {
    if (!member?.scheme) return
    
    try {
      const tiersResponse = await subscriptionApi.getSubscriptionTiers({ 
        scheme: member.scheme, 
        is_active: true 
      })
      setAvailableTiers(tiersResponse.results || [])
    } catch (err) {
      console.error('Failed to load subscription tiers:', err)
      setAvailableTiers([])
    }
  }

  const handleSetupSubscription = async () => {
    if (!patientId || !selectedTier) return
    
    try {
      setSettingUp(true)
      const subscriptionData = {
        patient_id: patientId,
        tier_id: selectedTier,
        subscription_type: subscriptionType
      }
      
      await subscriptionApi.createMemberSubscription(subscriptionData)
      
      // Refresh subscription data
      await loadSubscriptionData()
      
      // Close dialog and reset form
      setShowSetupDialog(false)
      setSelectedTier(null)
      setSubscriptionType('MONTHLY')
    } catch (err) {
      console.error('Failed to create subscription:', err)
      setError(err instanceof Error ? err.message : 'Failed to create subscription')
    } finally {
      setSettingUp(false)
    }
  }

  useEffect(() => {
    if (!patientId) {
      setSubscription(null)
      setUsageStats(null)
      setError(null)
      setLoading(false)
      return
    }

    loadSubscriptionData()
  }, [patientId])

  useEffect(() => {
    if (member?.scheme) {
      loadAvailableTiers()
    }
  }, [member?.scheme])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="w-48 h-6" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-3/4 h-4" />
          <Skeleton className="w-1/2 h-4" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Subscription Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!subscription) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            No Active Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This member doesn't have an active subscription.
          </p>
          {member?.scheme_name && (
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm font-medium">Current Scheme</p>
              <p className="text-sm text-muted-foreground">{member.scheme_name}</p>
            </div>
          )}
          <div className="flex gap-2">
            <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Set Up Subscription
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Up Subscription</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {member?.scheme_name && (
                    <div>
                      <Label>Member's Scheme</Label>
                      <p className="text-sm text-muted-foreground">{member.scheme_name}</p>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="tier-select">Select Subscription Tier</Label>
                    <select
                      id="tier-select"
                      value={selectedTier?.toString() || ""}
                      onChange={(e) => setSelectedTier(e.target.value ? parseInt(e.target.value) : null)}
                      className="flex w-full h-10 px-3 py-2 text-sm border rounded-md border-input bg-background ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Choose a tier...</option>
                      {availableTiers.length === 0 ? (
                        <option disabled>No tiers available</option>
                      ) : (
                        availableTiers.map((tier) => (
                          <option key={tier.id} value={tier.id.toString()}>
                            {tier.name} - {formatCurrency(tier.monthly_price)}/month
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="type-select">Subscription Type</Label>
                    <select
                      id="type-select"
                      value={subscriptionType}
                      onChange={(e) => setSubscriptionType(e.target.value as 'MONTHLY' | 'YEARLY')}
                      className="flex w-full h-10 px-3 py-2 text-sm border rounded-md border-input bg-background ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Choose subscription type...</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSetupSubscription} 
                      disabled={!selectedTier || settingUp}
                    >
                      {settingUp ? 'Setting up...' : 'Create Subscription'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm">
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'SUSPENDED':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'EXPIRED':
        return <Clock className="w-4 h-4 text-red-500" />
      default:
        return <CreditCard className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusVariant = (status: string): "default" | "success" | "warning" | "destructive" | "outline" => {
    switch (status) {
      case 'ACTIVE':
        return 'success'
      case 'SUSPENDED':
        return 'warning'
      case 'EXPIRED':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  // Calculate coverage utilization percentage
  const coverageUsed = usageStats?.coverage_used_this_year || 0
  const coverageLimit = usageStats?.max_coverage_per_year || subscription.tier_detail?.max_coverage_per_year
  const coveragePercentage = coverageLimit ? (coverageUsed / coverageLimit) * 100 : 0

  // Calculate claims utilization percentage
  const claimsUsed = usageStats?.claims_this_month || 0
  const claimsLimit = usageStats?.max_claims_per_month || subscription.tier_detail?.max_claims_per_month
  const claimsPercentage = claimsLimit ? (claimsUsed / claimsLimit) * 100 : 0

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Subscription Coverage
          </div>
          <Badge variant={getStatusVariant(subscription.status)} className="flex items-center gap-1">
            {getStatusIcon(subscription.status)}
            {subscription.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Subscription Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Tier</p>
            <p className="text-lg font-semibold">{subscription.tier_detail?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Type</p>
            <p className="text-lg font-semibold">{subscription.subscription_type}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Monthly Cost</p>
            <p className="text-lg font-semibold">
              {formatCurrency(subscription.tier_detail?.monthly_price || 0)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Renewal Date</p>
            <p className="text-sm font-semibold">
              {new Date(subscription.end_date).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Coverage Utilization */}
        {coverageLimit && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Annual Coverage Used</span>
              <span>
                {formatCurrency(coverageUsed)} / {formatCurrency(coverageLimit)}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 transition-all duration-300 bg-blue-600 rounded-full"
                style={{ width: `${Math.min(coveragePercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency((coverageLimit - coverageUsed))} remaining
            </p>
          </div>
        )}

        {/* Monthly Claims */}
        {claimsLimit && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Monthly Claims</span>
              <span>
                {claimsUsed} / {claimsLimit}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 transition-all duration-300 bg-green-600 rounded-full"
                style={{ width: `${Math.min(claimsPercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {claimsLimit - claimsUsed} claims remaining this month
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <TrendingUp className="w-4 h-4 mr-2" />
                View Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Subscription Details</DialogTitle>
              </DialogHeader>
              <SubscriptionDetailsContent subscription={subscription} usageStats={usageStats} />
            </DialogContent>
          </Dialog>
          
          <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1" disabled={upgrading}>
                <CreditCard className="w-4 h-4 mr-2" />
                {upgrading ? 'Processing...' : 'Upgrade'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Upgrade Subscription</DialogTitle>
              </DialogHeader>
              <SubscriptionUpgradeContent 
                subscription={subscription} 
                patientId={patientId} 
                onUpgradeSuccess={() => {
                  setShowUpgradeDialog(false)
                  // Reload subscription data
                  if (patientId) {
                    loadSubscriptionData()
                  }
                }}
                upgrading={upgrading}
                setUpgrading={setUpgrading}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}

// Subscription Details Modal Content
function SubscriptionDetailsContent({ subscription, usageStats }: { 
  subscription: MemberSubscription | null, 
  usageStats: SubscriptionUsageStats | null 
}) {
  if (!subscription || !usageStats) {
    return <div className="p-4 text-center text-muted-foreground">No subscription data available</div>
  }

  const coverageUsed = usageStats.coverage_used_this_year || 0
  const coverageLimit = usageStats.max_coverage_per_year || 0
  const utilization = coverageLimit ? (coverageUsed / coverageLimit) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Subscription Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="mb-2 font-medium">Plan Details</h4>
          <div className="space-y-1 text-sm">
            <div>Tier: <span className="font-medium">{subscription.tier_detail.name}</span></div>
            <div>Type: <span className="font-medium">{subscription.subscription_type}</span></div>
            <div>Status: <Badge variant="success">{subscription.status}</Badge></div>
          </div>
        </div>
        <div>
          <h4 className="mb-2 font-medium">Billing</h4>
          <div className="space-y-1 text-sm">
            <div>Monthly: <span className="font-medium">{formatCurrency(subscription.tier_detail.monthly_price)}</span></div>
            <div>Yearly: <span className="font-medium">{formatCurrency(subscription.tier_detail.yearly_price)}</span></div>
            <div>Start Date: <span className="font-medium">{new Date(subscription.start_date).toLocaleDateString()}</span></div>
          </div>
        </div>
      </div>

      {/* Usage Statistics */}
      <div>
        <h4 className="mb-3 font-medium">Usage Statistics</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="p-4 text-center rounded bg-muted">
            <div className="text-2xl font-bold text-primary">{formatCurrency(coverageUsed)}</div>
            <div className="text-sm text-muted-foreground">Used This Year</div>
          </div>
          <div className="p-4 text-center rounded bg-muted">
            <div className="text-2xl font-bold text-success">{formatCurrency(coverageLimit - coverageUsed)}</div>
            <div className="text-sm text-muted-foreground">Remaining</div>
          </div>
          <div className="p-4 text-center rounded bg-muted">
            <div className="text-2xl font-bold">{utilization.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Utilization</div>
          </div>
        </div>
      </div>

      {/* Coverage Breakdown */}
      <div>
        <h4 className="mb-3 font-medium">Coverage Details</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span>Annual Coverage Limit</span>
            <span className="font-medium">{formatCurrency(coverageLimit)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Monthly Claims Limit</span>
            <span className="font-medium">{usageStats.max_claims_per_month || 'Unlimited'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Claims This Month</span>
            <span className="font-medium">{usageStats.claims_this_month}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Subscription Upgrade Modal Content
function SubscriptionUpgradeContent({ 
  subscription, 
  patientId, 
  onUpgradeSuccess, 
  upgrading, 
  setUpgrading 
}: { 
  subscription: MemberSubscription | null, 
  patientId: number | undefined,
  onUpgradeSuccess: () => void,
  upgrading: boolean,
  setUpgrading: (upgrading: boolean) => void
}) {
  const [availableTiers, setAvailableTiers] = useState<any[]>([])
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTiers = async () => {
      if (!subscription) return
      
      try {
        setLoading(true)
        const tiersResponse = await subscriptionApi.getSubscriptionTiers({ 
          scheme: subscription.tier_detail.scheme,
          is_active: true 
        })
        
        // Filter out current tier and lower tiers
        const upgradeTiers = tiersResponse.results.filter((tier: any) => 
          tier.monthly_price > subscription.tier_detail.monthly_price
        )
        setAvailableTiers(upgradeTiers)
      } catch (error) {
        console.error('Failed to load upgrade tiers:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTiers()
  }, [subscription])

  const handleUpgrade = async () => {
    if (!selectedTier || !subscription) return
    
    try {
      setUpgrading(true)
      await subscriptionApi.upgradeSubscription(subscription.id, {
        new_tier_id: selectedTier
      })
      onUpgradeSuccess()
    } catch (error) {
      console.error('Upgrade failed:', error)
    } finally {
      setUpgrading(false)
    }
  }

  if (!subscription) {
    return <div className="p-4 text-center text-muted-foreground">No subscription to upgrade</div>
  }

  if (loading) {
    return <div className="p-4 text-center">Loading upgrade options...</div>
  }

  if (availableTiers.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>You're already on the highest tier available!</p>
        <p className="mt-2 text-sm">Current plan: <span className="font-medium">{subscription.tier_detail.name}</span></p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 font-medium">Current Plan</h4>
        <div className="p-3 rounded bg-muted">
          <div className="font-medium">{subscription.tier_detail.name}</div>
          <div className="text-sm text-muted-foreground">
            {formatCurrency(subscription.tier_detail.monthly_price)}/month
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-medium">Available Upgrades</h4>
        <div className="space-y-2">
          {availableTiers.map((tier: any) => (
            <label
              key={tier.id}
              className={`flex items-center space-x-3 p-3 rounded border cursor-pointer ${
                selectedTier === tier.id ? 'border-primary bg-primary/5' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="upgrade-tier"
                value={tier.id}
                checked={selectedTier === tier.id}
                onChange={() => setSelectedTier(tier.id)}
                className="text-primary"
              />
              <div className="flex-1">
                <div className="font-medium">{tier.name}</div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(tier.monthly_price)}/month • 
                  {formatCurrency(tier.max_coverage_per_year)} annual coverage
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button 
          onClick={handleUpgrade} 
          disabled={!selectedTier || upgrading}
          className="flex-1"
        >
          {upgrading ? 'Processing...' : 'Confirm Upgrade'}
        </Button>
      </div>
    </div>
  )
}