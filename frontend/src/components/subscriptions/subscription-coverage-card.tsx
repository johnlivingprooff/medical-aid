import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { subscriptionApi } from '@/lib/api'
import type { MemberSubscription, SubscriptionUsageStats } from '@/types/models'
import { formatCurrency } from '@/lib/currency'
import { Skeleton } from '@/components/ui/skeleton'

interface SubscriptionCoverageCardProps {
  patientId?: number;
  className?: string;
}

export function SubscriptionCoverageCard({ patientId, className }: SubscriptionCoverageCardProps) {
  const [subscription, setSubscription] = useState<MemberSubscription | null>(null)
  const [usageStats, setUsageStats] = useState<SubscriptionUsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) return

    const loadSubscriptionData = async () => {
      try {
        setLoading(true)
        setError(null)

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

    loadSubscriptionData()
  }, [patientId])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
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
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This member doesn't have an active subscription. Please contact support to set up a subscription.
          </p>
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
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
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
          <Button variant="outline" size="sm" className="flex-1">
            <TrendingUp className="w-4 h-4 mr-2" />
            View Details
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <CreditCard className="w-4 h-4 mr-2" />
            Upgrade
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}