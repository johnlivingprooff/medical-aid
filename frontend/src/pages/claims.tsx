import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { formatFullName } from '@/lib/format-name'
import { capitalizeFirst } from '@/lib/format-text'
import { QuickActions } from '@/components/layout/quick-actions'
import { ClaimActionsMenu } from '@/components/claims/claim-actions-menu'
import ClaimDetailsModal from '@/components/modals/claim-details-modal'
import { useAuth } from '@/components/auth/auth-context'
import type { Claim } from '@/types/models'

// Lazy load heavy components
const SubmitClaimModal = lazy(() => import('@/components/modals/submit-claim-modal').then(module => ({ default: module.SubmitClaimModal })))

// Loading component for lazy-loaded components
const ModalLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
  </div>
)

export default function Claims() {
  const { user } = useAuth()
  const [claims, setClaims] = useState<Claim[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [prev, setPrev] = useState<string | null>(null)
  const [ordering, setOrdering] = useState<string>('-date_submitted')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [showClaim, setShowClaim] = useState(false)
  const [showClaimDetails, setShowClaimDetails] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  
  // Data for different tabs based on user role
  const [providersData, setProvidersData] = useState<any[] | null>(null)
  const [providersLoading, setProvidersLoading] = useState(false)
  const [providersError, setProvidersError] = useState<string | null>(null)
  const [schemesData, setSchemesData] = useState<any[] | null>(null)
  const [schemesLoading, setSchemesLoading] = useState(false)
  const [schemesError, setSchemesError] = useState<string | null>(null)
  const [membersData, setMembersData] = useState<any[] | null>(null)
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState<string | null>(null)

  // Determine what tabs should be shown based on user role
  const getAvailableTabs = () => {
    const tabs = [{ value: 'claims', label: 'Claims' }]
    
    if (user?.role === 'ADMIN') {
      tabs.push(
        { value: 'providers', label: 'Providers' },
        { value: 'schemes', label: 'Schemes' },
        { value: 'members', label: 'Members' }
      )
    } else if (user?.role === 'PROVIDER') {
      tabs.push({ value: 'providers', label: 'My Practice' })
    }
    // Patients only see claims tab
    
    return tabs
  }

  const handleClaimUpdate = (updatedClaim: Claim) => {
    setClaims(prevClaims => 
      prevClaims.map(claim => 
        claim.id === updatedClaim.id ? updatedClaim : claim
      )
    )
  }

  const handleViewClaimDetails = (claim: Claim) => {
    setSelectedClaim(claim)
    setShowClaimDetails(true)
  }


  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
  const params = new URLSearchParams()
  params.set('ordering', ordering)
  if (filters.search) params.set('search', filters.search)
  if (filters.status) params.set('status', filters.status)
  api.get<any>(`/api/claims/?${params.toString()}`)
      .then((data) => { if (!mounted) return; setClaims((data.results ?? data) as Claim[]); setNext(data.next ?? null); setPrev(data.previous ?? null) })
      .catch((e) => { if (!mounted) return; setError(e.message || 'Failed to load claims') })
      .finally(() => { if (!mounted) return; setLoading(false) })
    return () => { mounted = false }
  }, [ordering, filters])

  useEffect(() => {
    // Load providers analytics - only for admins and providers
    if (!user || !['ADMIN', 'PROVIDER'].includes(user.role)) return
    
    let mounted = true
    setProvidersLoading(true)
    setProvidersError(null)
    api.get<any>('/api/core/analytics/providers/')
      .then(d => { if (!mounted) return; setProvidersData(d.results ?? d) })
      .catch(e => { if (!mounted) return; setProvidersError(e.message || 'Failed to load providers') })
      .finally(() => { if (!mounted) return; setProvidersLoading(false) })
    return () => { mounted = false }
  }, [user])

  useEffect(() => {
    // Load schemes overview - only for admins
    if (!user || user.role !== 'ADMIN') return
    
    let mounted = true
    setSchemesLoading(true)
    setSchemesError(null)
    api.get<any>('/api/core/analytics/schemes/overview/')
      .then(d => { if (!mounted) return; setSchemesData(d.results ?? d) })
      .catch(e => { if (!mounted) return; setSchemesError(e.message || 'Failed to load schemes') })
      .finally(() => { if (!mounted) return; setSchemesLoading(false) })
    return () => { mounted = false }
  }, [user])

  useEffect(() => {
    // Load members analytics - only for admins
    if (!user || user.role !== 'ADMIN') return
    
    let mounted = true
    setMembersLoading(true)
    setMembersError(null)
    api.get<any>('/api/core/analytics/members/')
      .then(d => { if (!mounted) return; setMembersData(d.results ?? d) })
      .catch(e => { if (!mounted) return; setMembersError(e.message || 'Failed to load members') })
      .finally(() => { if (!mounted) return; setMembersLoading(false) })
    return () => { mounted = false }
  }, [user])

  const filtered = useMemo(() => {
    let list = claims
    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter(c => 
        `${c.id}`.includes(q) || 
        c.patient_detail?.user_username?.toLowerCase().includes(q) || 
        c.patient_detail?.member_id?.toLowerCase().includes(q) || 
        c.patient_detail?.user_first_name?.toLowerCase().includes(q) ||
        c.patient_detail?.user_last_name?.toLowerCase().includes(q) ||
        formatFullName(c.patient_detail?.user_first_name, c.patient_detail?.user_last_name).toLowerCase().includes(q) ||
        c.service_type_name?.toLowerCase().includes(q)
      )
    }
    if (filters.status) list = list.filter(c => c.status === filters.status)
    return list
  }, [claims, filters])

  const availableTabs = getAvailableTabs()
  
  // If user is not authenticated, show loading or redirect
  if (!user) {
    return <div className="flex items-center justify-center h-96">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claims Management</h1>
          <p className="text-muted-foreground">
            {user.role === 'PATIENT' && 'View and track your submitted claims'}
            {user.role === 'PROVIDER' && 'Manage claims submitted to your practice'}
            {user.role === 'ADMIN' && 'Comprehensive claims management and analytics'}
          </p>
        </div>
        {(user.role === 'PROVIDER' || user.role === 'PATIENT') && (
          <Button onClick={() => setShowClaim(true)}>Submit Claim</Button>
        )}
      </div>

      <Tabs defaultValue="claims" className="space-y-4">
        <TabsList>
          {availableTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="claims">
          <Card>
            <CardHeader>
              <CardTitle>
                {user.role === 'PATIENT' && 'My Claims'}
                {user.role === 'PROVIDER' && 'Claims to Review'}
                {user.role === 'ADMIN' && 'All Claims'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}
              <div className="flex items-center gap-4">
                <Input
                  placeholder="Search claims..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="max-w-sm"
                />
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="rounded border px-3 py-2"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="INVESTIGATING">Investigating</option>
                  <option value="REQUIRES_PREAUTH">Requires Pre-auth</option>
                </select>
              </div>
              <div className="border rounded-lg">
                <Table>
                  <Thead>
                    <Tr>
                      <Th><button onClick={() => setOrdering(ordering === 'id' ? '-id' : 'id')}>Claim ID</button></Th>
                      <Th>Member</Th>
                      {user.role === 'ADMIN' && <Th>Provider</Th>}
                      <Th>Service</Th>
                      <Th><button onClick={() => setOrdering(ordering === 'date_submitted' ? '-date_submitted' : 'date_submitted')}>Date</button></Th>
                      <Th className="text-right"><button onClick={() => setOrdering(ordering === 'cost' ? '-cost' : 'cost')}>Amount</button></Th>
                      <Th>Status</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {loading && Array.from({ length: 8 }).map((_, i) => (
                      <Tr key={i}><Td colSpan={user.role === 'ADMIN' ? 8 : 7} className="text-xs text-muted-foreground">Loading…</Td></Tr>
                    ))}
                    {!loading && filtered.map((c) => (
                      <Tr key={c.id}>
                        <Td>#{c.id}</Td>
                        <Td>{formatFullName(c.patient_detail?.user_first_name, c.patient_detail?.user_last_name)}</Td>
                        {user.role === 'ADMIN' && <Td>{c.provider_facility_name || c.provider_username || `#${c.provider}`}</Td>}
                        <Td>{capitalizeFirst(c.service_type_name)}</Td>
                        <Td>{new Date(c.date_submitted).toLocaleDateString()}</Td>
                        <Td className="text-right">{formatCurrency(c.cost)}</Td>
                        <Td>
                          <Badge variant={c.status === 'APPROVED' ? 'success' : c.status === 'PENDING' ? 'warning' : 'destructive'}>
                            {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                          </Badge>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <button className="text-accent hover:underline" onClick={() => handleViewClaimDetails(c)}>View Details</button>
                            <ClaimActionsMenu
                              claim={c}
                              userRole={user.role}
                              userId={user.id}
                              onClaimUpdate={handleClaimUpdate}
                              onViewDetails={handleViewClaimDetails}
                            />
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
              <Separator className="my-3" />
              <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={!prev} onClick={() => prev && api.get<any>(prev).then((r) => { setClaims(r.results ?? r); setNext(r.next ?? null); setPrev(r.previous ?? null) })}>Prev</button>
                <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={!next} onClick={() => next && api.get<any>(next).then((r) => { setClaims(r.results ?? r); setNext(r.next ?? null); setPrev(r.previous ?? null) })}>Next</button>
              </div>
              {!loading && filtered.length === 0 && (
                <div className="text-center text-sm text-muted-foreground">
                  {user.role === 'PATIENT' && 'No claims found. '}
                  {user.role === 'PROVIDER' && 'No claims to review. '}
                  {user.role === 'ADMIN' && 'No claims match filters. '}
                  {(user.role === 'PROVIDER' || user.role === 'PATIENT') && (
                    <button className="text-accent underline" onClick={() => setShowClaim(true)}>Submit Claim</button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schemes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schemes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Scheme</Th>
                      <Th>Members</Th>
                      <Th>Claims (30d)</Th>
                      <Th className="text-right">Amount (30d)</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {schemesLoading && Array.from({ length: 6 }).map((_, i) => (
                      <Tr key={i}><Td colSpan={4} className="text-xs text-muted-foreground">Loading…</Td></Tr>
                    ))}
                    {!schemesLoading && (schemesData ?? []).map((s: any) => (
                      <Tr key={s.id}>
                        <Td>{s.name}</Td>
                        <Td>{s.members_count}</Td>
                        <Td>{s.total_claims_30d}</Td>
                        <Td className="text-right">{formatCurrency(s.total_amount_30d || 0)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="providers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Providers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Provider</Th>
                      <Th>Claims</Th>
                      <Th>Approval %</Th>
                      <Th className="text-right">Approved Amount</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {providersLoading && Array.from({ length: 6 }).map((_, i) => (
                      <Tr key={i}><Td colSpan={4} className="text-xs text-muted-foreground">Loading…</Td></Tr>
                    ))}
                    {!providersLoading && (providersData ?? []).map((p: any) => (
                      <Tr key={p.provider_id}>
                        <Td>{p.provider}</Td>
                        <Td>{p.total_claims}</Td>
                        <Td>{(p.approval_rate * 100).toFixed(1)}%</Td>
                        <Td className="text-right">{formatCurrency(p.approved_amount || 0)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Member</Th>
                      <Th>Scheme</Th>
                      <Th>Claims</Th>
                      <Th className="text-right">Approved Amount</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {membersLoading && Array.from({ length: 6 }).map((_, i) => (
                      <Tr key={i}><Td colSpan={4} className="text-xs text-muted-foreground">Loading…</Td></Tr>
                    ))}
                    {!membersLoading && (membersData ?? []).map((m: any) => (
                      <Tr key={m.member_id}>
                        <Td>{m.member}</Td>
                        <Td>{m.scheme}</Td>
                        <Td>{m.total_claims}</Td>
                        <Td className="text-right">{formatCurrency(m.approved_amount || 0)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Suspense fallback={<ModalLoader />}>
        <SubmitClaimModal open={showClaim} onOpenChange={setShowClaim} />
      </Suspense>
      <ClaimDetailsModal open={showClaimDetails} onOpenChange={setShowClaimDetails} claim={selectedClaim} />
    </div>
  )
}
