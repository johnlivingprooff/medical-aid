/**
 * Verify Members Modal
 * Allows providers to search and verify member eligibility and subscription status
 */

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { X, Search, User, Shield, Calendar, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { formatFullName } from '@/lib/format-name'

interface Patient {
  id: number
  user_username: string
  user_first_name: string
  user_last_name: string
  member_id: string
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED'
  scheme_name: string
  enrollment_date: string
  relationship: 'PRINCIPAL' | 'SPOUSE' | 'CHILD' | 'DEPENDENT'
  member_subscription?: {
    id: number
    tier_name: string
    subscription_type: 'MONTHLY' | 'YEARLY'
    status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'EXPIRED'
    start_date: string
    end_date: string
    claims_this_month: number
    coverage_used_this_year: number
    tier_max_claims_per_month?: number
    tier_max_coverage_per_year?: number
  }
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function VerifyMembersModal({ open, onOpenChange }: Props) {
  const [members, setMembers] = useState<Patient[]>([])
  const [filteredMembers, setFilteredMembers] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<Patient | null>(null)
  const detailsRef = useRef<HTMLDivElement>(null)

  // Handle member selection with smooth scroll
  const handleSelectMember = (member: Patient) => {
    setSelectedMember(member)
    // Scroll to details section after a small delay to ensure it's rendered
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }

  // Load all members when modal opens
  useEffect(() => {
    if (open) {
      loadMembers()
    }
  }, [open])

  // Filter members based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMembers(members)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = members.filter(
      (m) =>
        m.member_id.toLowerCase().includes(query) ||
        m.user_username.toLowerCase().includes(query) ||
        m.user_first_name.toLowerCase().includes(query) ||
        m.user_last_name.toLowerCase().includes(query) ||
        formatFullName(m.user_first_name, m.user_last_name).toLowerCase().includes(query) ||
        m.scheme_name.toLowerCase().includes(query)
    )
    setFilteredMembers(filtered)
  }, [searchQuery, members])

  const loadMembers = async () => {
    setLoading(true)
    try {
      // Fetch all patients with their subscription information
      const response = await api.get<any>('/api/patients/')
      const patients = response.results || response
      setMembers(patients)
      setFilteredMembers(patients)
    } catch (error: any) {
      console.error('Failed to load members:', error)
      setMembers([])
      setFilteredMembers([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success'
      case 'SUSPENDED':
        return 'warning'
      case 'INACTIVE':
      case 'CANCELLED':
      case 'EXPIRED':
        return 'destructive'
      case 'TERMINATED':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString()
  }

  const getSubscriptionInfo = (member: Patient) => {
    if (!member.member_subscription) {
      return {
        hasSubscription: false,
        tierName: '—',
        status: '—',
        remainingClaims: '—',
        remainingCoverage: '—',
      }
    }

    const sub = member.member_subscription
    const remainingClaims =
      sub.tier_max_claims_per_month !== null && sub.tier_max_claims_per_month !== undefined
        ? sub.tier_max_claims_per_month - sub.claims_this_month
        : '∞'

    const remainingCoverage =
      sub.tier_max_coverage_per_year !== null && sub.tier_max_coverage_per_year !== undefined
        ? formatCurrency(sub.tier_max_coverage_per_year - sub.coverage_used_this_year)
        : '∞'

    return {
      hasSubscription: true,
      tierName: sub.tier_name,
      status: sub.status,
      subscriptionType: sub.subscription_type,
      startDate: sub.start_date,
      endDate: sub.end_date,
      remainingClaims,
      remainingCoverage,
      claimsThisMonth: sub.claims_this_month,
      coverageUsed: sub.coverage_used_this_year,
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 grid p-4 overflow-y-auto place-items-center bg-black/40"
      onClick={() => onOpenChange(false)}
    >
      <Card
        className="w-full max-w-6xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Verify Members
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="w-6 h-6"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Members</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by member ID, name, or scheme..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Found {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Members Table */}
          <div className="max-h-[500px] overflow-y-auto border rounded-md">
            <Table>
              <Thead className="sticky top-0 bg-background">
                <Tr>
                  <Th>Member ID</Th>
                  <Th>Name</Th>
                  <Th>Scheme</Th>
                  <Th>Status</Th>
                  <Th>Subscription</Th>
                  <Th>Tier</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Tr key={i}>
                      <Td colSpan={7}>
                        <Skeleton className="w-full h-4" />
                      </Td>
                    </Tr>
                  ))
                ) : filteredMembers.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} className="py-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-8 h-8" />
                        <p>No members found</p>
                      </div>
                    </Td>
                  </Tr>
                ) : (
                  filteredMembers.map((member) => {
                    const subInfo = getSubscriptionInfo(member)
                    return (
                      <Tr
                        key={member.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSelectMember(member)}
                      >
                        <Td className="font-medium">{member.member_id}</Td>
                        <Td>{formatFullName(member.user_first_name, member.user_last_name)}</Td>
                        <Td>{member.scheme_name}</Td>
                        <Td>
                          <Badge variant={getStatusVariant(member.status)}>
                            {member.status}
                          </Badge>
                        </Td>
                        <Td>
                          {subInfo.hasSubscription ? (
                            <Badge variant={getStatusVariant(subInfo.status)}>
                              {subInfo.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">No subscription</span>
                          )}
                        </Td>
                        <Td>
                          {subInfo.hasSubscription ? (
                            <span className="text-sm">{subInfo.tierName}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Td>
                        <Td>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectMember(member)
                            }}
                          >
                            View Details
                          </Button>
                        </Td>
                      </Tr>
                    )
                  })
                )}
              </Tbody>
            </Table>
          </div>

          {/* Member Details Panel */}
          {selectedMember && (
            <div 
              ref={detailsRef}
              className="mt-4"
            >
              <Card className="border-2 border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="w-4 h-4" />
                    Member Details: {formatFullName(selectedMember.user_first_name, selectedMember.user_last_name)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Basic Information */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Basic Information</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Full Name:</span>
                        <span className="font-medium">{formatFullName(selectedMember.user_first_name, selectedMember.user_last_name)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Username:</span>
                        <span className="font-medium text-muted-foreground text-xs">{selectedMember.user_username}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Member ID:</span>
                        <span className="font-medium">{selectedMember.member_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Relationship:</span>
                        <span className="font-medium">{selectedMember.relationship}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Scheme:</span>
                        <span className="font-medium">{selectedMember.scheme_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={getStatusVariant(selectedMember.status)}>
                          {selectedMember.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Enrolled:</span>
                        <span className="font-medium">{formatDate(selectedMember.enrollment_date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Subscription Information */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Subscription Information</h4>
                    {selectedMember.member_subscription ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tier:</span>
                          <span className="font-medium">
                            {selectedMember.member_subscription.tier_name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-medium">
                            {selectedMember.member_subscription.subscription_type}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant={getStatusVariant(selectedMember.member_subscription.status)}>
                            {selectedMember.member_subscription.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Start Date:</span>
                          <span className="font-medium">
                            {formatDate(selectedMember.member_subscription.start_date)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">End Date:</span>
                          <span className="font-medium">
                            {formatDate(selectedMember.member_subscription.end_date)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-sm text-center text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                        No active subscription
                      </div>
                    )}
                  </div>
                </div>

                {/* Usage Statistics */}
                {selectedMember.member_subscription && (
                  <div className="pt-4 space-y-2 border-t">
                    <h4 className="text-sm font-semibold">Usage Statistics</h4>
                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Claims this month:</span>
                          <span className="font-medium">
                            {selectedMember.member_subscription.claims_this_month}
                            {selectedMember.member_subscription.tier_max_claims_per_month && (
                              <span className="text-muted-foreground">
                                {' / '}
                                {selectedMember.member_subscription.tier_max_claims_per_month}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Remaining claims:</span>
                          <span className="font-medium">
                            {getSubscriptionInfo(selectedMember).remainingClaims}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Coverage used:</span>
                          <span className="font-medium">
                            {formatCurrency(selectedMember.member_subscription.coverage_used_this_year)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Remaining coverage:</span>
                          <span className="font-medium">
                            {getSubscriptionInfo(selectedMember).remainingCoverage}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button variant="outline" onClick={() => setSelectedMember(null)}>
                    Close Details
                  </Button>
                </div>
              </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
