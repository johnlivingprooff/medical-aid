import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { formatFullName } from '@/lib/format-name'
import { BarChart3, Users, DollarSign, TrendingUp } from 'lucide-react'

interface MemberAnalytics {
  member_id: number
  member: string
  user_first_name?: string
  user_last_name?: string
  member_full_name?: string
  scheme: string
  total_claims: number
  approved_amount: number
}

interface SchemeOverview {
  id: number
  name: string
  description: string
  members_count: number
  total_claims_30d: number
  total_amount_30d: number
  utilization_percent: number
  breakdown: Array<{ name: string; percent: number }>
}

export default function Analytics() {
  const [memberAnalytics, setMemberAnalytics] = useState<MemberAnalytics[]>([])
  const [schemeOverview, setSchemeOverview] = useState<SchemeOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

        const [membersResponse, schemesResponse] = await Promise.all([
          api.get<{ results: MemberAnalytics[] }>('/api/core/analytics/members/'),
          api.get<SchemeOverview[]>('/api/core/analytics/schemes/overview/')
        ])

        setMemberAnalytics(membersResponse.results)
        setSchemeOverview(schemesResponse)
      } catch (error) {
        console.error('Error fetching analytics:', error)
        setError('Failed to load analytics data')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Charts and KPIs highlighting utilization and performance.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Charts and KPIs highlighting utilization and performance.</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-destructive">{error}</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate summary metrics
  const totalMembers = (memberAnalytics || []).length
  const totalClaims = (memberAnalytics || []).reduce((sum, m) => sum + (m.total_claims || 0), 0)
  const totalAmount = (memberAnalytics || []).reduce((sum, m) => sum + (m.approved_amount || 0), 0)
  const avgClaimsPerMember = totalMembers > 0 ? (totalClaims / totalMembers).toFixed(1) : '0'

  // Top members by claim amount
  const topMembers = [...(memberAnalytics || [])]
    .sort((a, b) => b.approved_amount - a.approved_amount)
    .slice(0, 10)

  // Top schemes by utilization
  const topSchemes = [...(schemeOverview || [])]
    .sort((a, b) => b.utilization_percent - a.utilization_percent)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <h1>Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Charts and KPIs highlighting utilization and performance.</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{totalMembers}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Claims</p>
                <p className="text-2xl font-bold">{totalClaims}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Claims/Member</p>
                <p className="text-2xl font-bold">{avgClaimsPerMember}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Members by Claim Value</CardTitle>
            <CardDescription>Members with highest approved claim amounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topMembers.map((member, index) => (
                <div key={member.member_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-6">#{index + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{formatFullName(member.user_first_name, member.user_last_name) || member.member_full_name || member.member}</p>
                      <p className="text-xs text-muted-foreground">{member.scheme}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(member.approved_amount)}</p>
                    <p className="text-xs text-muted-foreground">{member.total_claims} claims</p>
                  </div>
                </div>
              ))}
              {topMembers.length === 0 && (
                <div className="text-center text-muted-foreground py-8">No member data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheme Utilization</CardTitle>
            <CardDescription>Schemes ranked by utilization rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topSchemes.map((scheme, index) => (
                <div key={scheme.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-6">#{index + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{scheme.name}</p>
                      <p className="text-xs text-muted-foreground">{scheme.members_count} members</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{scheme.utilization_percent.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(scheme.total_amount_30d)}</p>
                  </div>
                </div>
              ))}
              {topSchemes.length === 0 && (
                <div className="text-center text-muted-foreground py-8">No scheme data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
