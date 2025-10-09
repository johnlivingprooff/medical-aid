import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { subscriptionApi } from '@/lib/api'
import type { MemberSubscription, SubscriptionUsageStats, BenefitCategory } from '@/types/models'
import { formatCurrency } from '@/lib/currency'
import { Skeleton } from '@/components/ui/skeleton'

interface BenefitUtilizationTrackingProps {
  patientId?: number;
  className?: string;
}

export function BenefitUtilizationTracking({ patientId, className }: BenefitUtilizationTrackingProps) {
  const [subscription, setSubscription] = useState<MemberSubscription | null>(null)
  const [usageStats, setUsageStats] = useState<SubscriptionUsageStats | null>(null)
  const [benefitCategories, setBenefitCategories] = useState<BenefitCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) {
      setSubscription(null)
      setUsageStats(null)
      setError(null)
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        // Reset state when patientId changes
        setSubscription(null)
        setUsageStats(null)

        // Load subscription data
        const subscriptionResponse = await subscriptionApi.getMemberSubscriptions({ patient: patientId })
        const subscriptionData = subscriptionResponse.results[0] // Get first active subscription
        setSubscription(subscriptionData)

        // Load usage statistics
        if (subscriptionData) {
          const usageData = await subscriptionApi.getSubscriptionUsage(subscriptionData.id)
          setUsageStats(usageData)
        }

        // Load benefit categories
        const categoriesResponse = await subscriptionApi.getSubscriptionTiers()
        // For now, we'll use subscription tiers as benefit categories
        // In a real implementation, we'd have separate benefit categories
        setBenefitCategories([])

      } catch (err: any) {
        setError(err.message || 'Failed to load utilization data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [patientId])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Benefit Utilization Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="w-full h-32" />
            <Skeleton className="w-full h-24" />
            <Skeleton className="w-full h-20" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !subscription || !usageStats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Benefit Utilization Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {error || 'No subscription data available'}
          </div>
        </CardContent>
      </Card>
    )
  }

  const overallUtilization = usageStats.max_coverage_per_year 
    ? (usageStats.coverage_used_this_year / usageStats.max_coverage_per_year) * 100 
    : 0
  const remainingAmount = usageStats.max_coverage_per_year 
    ? usageStats.max_coverage_per_year - usageStats.coverage_used_this_year 
    : 0

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Benefit Utilization Tracking
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          {subscription.tier_detail.name} • {subscription.subscription_type}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Utilization Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Total Used</div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(usageStats.coverage_used_this_year)}
            </div>
            <div className="text-xs text-muted-foreground">
              of {formatCurrency(usageStats.max_coverage_per_year || 0)} limit
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Remaining</div>
            <div className={`text-2xl font-bold ${
              remainingAmount < ((usageStats.max_coverage_per_year || 0) * 0.1) ? 'text-destructive' :
              remainingAmount < ((usageStats.max_coverage_per_year || 0) * 0.25) ? 'text-warning' : 'text-success'
            }`}>
              {formatCurrency(remainingAmount)}
            </div>
            <div className="text-xs text-muted-foreground">
              Available balance
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Utilization Rate</div>
            <div className="flex items-center gap-2">
              <div className={`text-2xl font-bold ${
                overallUtilization > 90 ? 'text-destructive' :
                overallUtilization > 70 ? 'text-warning' : 'text-success'
              }`}>
                {overallUtilization.toFixed(1)}%
              </div>
              {overallUtilization > 80 ? (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              ) : overallUtilization < 30 ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <TrendingUp className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Overall usage
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Utilization</span>
            <span>{overallUtilization.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                overallUtilization > 90 ? 'bg-destructive' :
                overallUtilization > 70 ? 'bg-warning' : 'bg-success'
              }`}
              style={{ width: `${Math.min(overallUtilization, 100)}%` }}
            />
          </div>
        </div>

        {/* Claims This Month */}
        <div className="space-y-4">
          <h4 className="font-medium">Monthly Usage</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center p-4 border rounded">
              <div className="text-sm text-muted-foreground">Claims This Month</div>
              <div className="text-2xl font-bold">{usageStats.claims_this_month}</div>
              <div className="text-xs text-muted-foreground">
                of {usageStats.max_claims_per_month || 'unlimited'} allowed
              </div>
            </div>
            <div className="text-center p-4 border rounded">
              <div className="text-sm text-muted-foreground">Coverage Used</div>
              <div className="text-2xl font-bold">{formatCurrency(usageStats.coverage_used_this_year)}</div>
              <div className="text-xs text-muted-foreground">
                of {formatCurrency(usageStats.max_coverage_per_year || 0)} annual limit
              </div>
            </div>
          </div>
        </div>

        {/* Usage Trends */}
        {usageStats.claims_this_month > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Usage Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded">
                <div className="text-sm text-muted-foreground">Monthly Claim Rate</div>
                <div className="text-lg font-bold">
                  {usageStats.max_claims_per_month 
                    ? `${usageStats.claims_this_month}/${usageStats.max_claims_per_month}` 
                    : usageStats.claims_this_month
                  }
                </div>
                <div className="text-xs text-muted-foreground">claims this month</div>
              </div>
              <div className="text-center p-4 border rounded">
                <div className="text-sm text-muted-foreground">Annual Utilization</div>
                <div className="text-lg font-bold">{overallUtilization.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">of yearly limit</div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="space-y-3">
          <h4 className="font-medium">Recommendations</h4>
          <div className="space-y-2">
            {overallUtilization > 90 && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-destructive">High Utilization Alert</div>
                  <div className="text-muted-foreground">
                    You're approaching your annual limit. Consider upgrading your subscription tier for higher limits.
                  </div>
                </div>
              </div>
            )}

            {remainingAmount < ((usageStats.max_coverage_per_year || 0) * 0.2) && (
              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-warning">Low Balance Warning</div>
                  <div className="text-muted-foreground">
                    You have less than 20% of your benefits remaining. Plan your healthcare expenses accordingly.
                  </div>
                </div>
              </div>
            )}

            {usageStats.max_claims_per_month && usageStats.claims_this_month > (usageStats.max_claims_per_month * 0.8) && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded">
                <BarChart3 className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-blue-900">Monthly Claim Limit</div>
                  <div className="text-blue-700">
                    You're approaching your monthly claim limit. Consider spacing out non-urgent procedures.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}