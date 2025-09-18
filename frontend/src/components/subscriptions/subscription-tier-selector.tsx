import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, Star, Zap, Shield, Crown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { subscriptionApi } from '@/lib/api'
import type { SubscriptionTier } from '@/types/models'
import { formatCurrency } from '@/lib/currency'
import { Skeleton } from '@/components/ui/skeleton'

interface SubscriptionTierSelectorProps {
  schemeId: number;
  selectedTierId?: number;
  onTierSelect: (tierId: number) => void;
  className?: string;
}

export function SubscriptionTierSelector({
  schemeId,
  selectedTierId,
  onTierSelect,
  className
}: SubscriptionTierSelectorProps) {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadTiers = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await subscriptionApi.getSubscriptionTiers({
          scheme: schemeId,
          is_active: true
        })

        setTiers(response.results || [])
      } catch (err: any) {
        setError(err.message || 'Failed to load subscription tiers')
      } finally {
        setLoading(false)
      }
    }

    if (schemeId) {
      loadTiers()
    }
  }, [schemeId])

  const getTierIcon = (tierType: string) => {
    switch (tierType) {
      case 'BASIC':
        return <Shield className="w-5 h-5 text-blue-500" />
      case 'STANDARD':
        return <Star className="w-5 h-5 text-green-500" />
      case 'PREMIUM':
        return <Zap className="w-5 h-5 text-purple-500" />
      case 'ENTERPRISE':
        return <Crown className="w-5 h-5 text-yellow-500" />
      default:
        return <Shield className="w-5 h-5 text-gray-500" />
    }
  }

  const getTierColor = (tierType: string) => {
    switch (tierType) {
      case 'BASIC':
        return 'border-blue-200 bg-blue-50'
      case 'STANDARD':
        return 'border-green-200 bg-green-50'
      case 'PREMIUM':
        return 'border-purple-200 bg-purple-50'
      case 'ENTERPRISE':
        return 'border-yellow-200 bg-yellow-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Choose Your Subscription Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="w-full h-48" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Shield className="w-5 h-5" />
            Subscription Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!tiers.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Choose Your Subscription Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-muted-foreground">
            No subscription plans are currently available for this scheme.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5" />
          Choose Your Subscription Plan
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Select the plan that best fits your healthcare needs
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                selectedTierId === tier.id
                  ? 'border-primary bg-primary/5 shadow-md'
                  : `border-gray-200 hover:border-primary/50 ${getTierColor(tier.tier_type)}`
              }`}
              onClick={() => onTierSelect(tier.id)}
            >
              {/* Selected indicator */}
              {selectedTierId === tier.id && (
                <div className="absolute top-2 right-2">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
              )}

              {/* Tier header */}
              <div className="flex items-center gap-3 mb-3">
                {getTierIcon(tier.tier_type)}
                <div>
                  <div className="font-semibold">{tier.name}</div>
                  <Badge variant="outline" className="text-xs">
                    {tier.tier_type}
                  </Badge>
                </div>
              </div>

              {/* Pricing */}
              <div className="mb-3">
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(tier.monthly_price)}
                </div>
                <div className="text-sm text-muted-foreground">per month</div>
                <div className="text-xs text-muted-foreground mt-1">
                  or {formatCurrency(tier.yearly_price)} yearly
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Up to {tier.max_dependents} dependents</span>
                </div>

                {tier.max_claims_per_month && (
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{tier.max_claims_per_month} claims per month</span>
                  </div>
                )}

                {tier.max_coverage_per_year && (
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{formatCurrency(tier.max_coverage_per_year)} annual coverage</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{tier.benefit_categories.length} benefit categories</span>
                </div>
              </div>

              {/* Description */}
              {tier.description && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {tier.description}
                </div>
              )}

              {/* Select button */}
              <Button
                className="w-full mt-4"
                variant={selectedTierId === tier.id ? "default" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onTierSelect(tier.id)
                }}
              >
                {selectedTierId === tier.id ? 'Selected' : 'Select Plan'}
              </Button>
            </div>
          ))}
        </div>

        {/* Summary */}
        {selectedTierId && (
          <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="text-sm font-medium mb-2">Plan Summary</div>
            {(() => {
              const selectedTier = tiers.find(t => t.id === selectedTierId)
              if (!selectedTier) return null

              return (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Plan:</span>
                    <span className="ml-2 font-medium">{selectedTier.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monthly:</span>
                    <span className="ml-2 font-medium">{formatCurrency(selectedTier.monthly_price)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Coverage:</span>
                    <span className="ml-2 font-medium">
                      {selectedTier.max_coverage_per_year
                        ? formatCurrency(selectedTier.max_coverage_per_year)
                        : 'Unlimited'
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dependents:</span>
                    <span className="ml-2 font-medium">{selectedTier.max_dependents}</span>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}