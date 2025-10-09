import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserPlus, Users, ArrowRight } from 'lucide-react'
import { Mail } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { AddMemberModal } from '@/components/modals/add-member-modal'
import { AddDependentModal } from '@/components/modals/add-dependent-modal'
import { ChangeSchemeModal } from '@/components/modals/change-scheme-modal'
import { formatCurrency } from '@/lib/currency'
import { api } from '@/lib/api'
import { Button as UIButton } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EditMemberModal } from '../components/modals/edit-member-modal'
import { Skeleton } from '@/components/ui/skeleton'
import { SubscriptionCoverageCard } from '@/components/subscriptions/subscription-coverage-card'
import { BenefitUtilizationTracking } from '@/components/subscriptions/benefit-utilization-tracking'
import { SubscriptionManagement } from '@/components/subscriptions/subscription-management'

function MemberClaimsHistory({ memberId }: { memberId: number }) {
  const [claims, setClaims] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get<any>(`/api/claims/?patient=${memberId}&ordering=-date_submitted`)
      .then((resp) => {
        setClaims(resp.results ?? resp)
      })
      .catch((e) => setError(e.message || 'Failed to load claims'))
      .finally(() => setLoading(false))
  }, [memberId])

  // Table removed as per user request. Future implementation:
  // - Show recent claims with subscription context, including:
  //   - Date, service, cost, status, subscription tier, utilization, remaining
  //   - Visual indicators for utilization and low balance
  //   - Integration with backend claim and subscription APIs
  //   - Filtering, sorting, and pagination for claims
  //   - Role-based access and context-aware rendering
  // Uncomment and implement when feature is required.
  return null;
}

function MemberBenefitUtilization({ memberId }: { memberId: number }) {
  const [benefits, setBenefits] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get<any>(`/api/patients/${memberId}/coverage-balance/`)
      .then((res) => setBenefits(res.balances || []))
      .catch((e) => setError(e.message || 'Failed to load benefits'))
      .finally(() => setLoading(false))
  }, [memberId])

  if (loading) return <Skeleton className="w-full h-16" />
  if (error) return <div className="text-xs text-destructive">{error}</div>
  if (!benefits.length) return <div className="text-xs text-muted-foreground">No benefits found.</div>

  return (
    <div className="space-y-2">
      <div className="mb-1 font-medium">Benefit Utilization</div>
      <Table>
        <Thead>
          <Tr>
            <Th>Benefit</Th>
            <Th>Used</Th>
            <Th>Remaining</Th>
            <Th>Limit</Th>
          </Tr>
        </Thead>
        <Tbody>
          {benefits.map((b) => (
            <Tr key={b.benefit_type}>
              <Td>{b.benefit_type_name}</Td>
              <Td>{formatCurrency(b.used_amount)}</Td>
              <Td>{formatCurrency(b.remaining_amount)}</Td>
              <Td>{b.coverage_limit_count ?? '—'}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  )
}

function MemberCommunication({ member }: { member: any }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendMessage() {
    setSending(true)
    setError(null)
    try {
      await api.post(`/api/patients/${member.id}/messages/`, {
        subject: '',
        message,
      })
      setSent(true)
      setMessage('')
    } catch (e: any) {
      setError(e.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2 mb-1 font-medium"><Mail className="w-4 h-4" /> Message Member</div>
      <textarea
        className="w-full p-2 text-sm border rounded"
        rows={2}
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Type a message to this member..."
        disabled={sending}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={sendMessage} disabled={sending || !message.trim()}>
          Send
        </Button>
        {sent && <span className="text-xs text-success">Sent!</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}

export default function Members() {
  const { user } = useAuth()
  const [showAdd, setShowAdd] = useState(false)
  const [showAddDependent, setShowAddDependent] = useState(false)
  const [showChangeScheme, setShowChangeScheme] = useState(false)
  const [memberForDependent, setMemberForDependent] = useState<any | null>(null)
  const [memberForSchemeChange, setMemberForSchemeChange] = useState<any | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [prev, setPrev] = useState<string | null>(null)
  const [ordering, setOrdering] = useState<string>('-id')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string>(() => localStorage.getItem('members:search') || '')
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [balances, setBalances] = useState<Record<number, number | null>>({})
  const [dependentEligibility, setDependentEligibility] = useState<Record<number, {
    can_add: boolean;
    current_count: number;
    max_allowed: number;
    remaining: number;
    reason?: string;
    tier_name: string;
  } | null>>({})
  const [editing, setEditing] = useState<{ id: number; first_name?: string; last_name?: string } | null>(null)
  const [selectedMember, setSelectedMember] = useState<any | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    const url = `/api/patients/?ordering=${encodeURIComponent(ordering)}${search ? `&search=${encodeURIComponent(search)}` : ''}`
    api.get<any>(url)
      .then((resp: any) => { 
        if (!mounted) return; 
        const results = resp.results ?? resp; 
        setMembers(results); 
        setNext(resp.next ?? null); 
        setPrev(resp.previous ?? null);
        // Load balances for all members
        if (results.length > 0) {
          loadAllBalances(results)
          loadAllDependentEligibility(results)
        }
      })
      .catch((e) => { if (!mounted) return; setError(e.message || 'Failed to load members') })
      .finally(() => { if (!mounted) return; setLoading(false) })
    return () => { mounted = false }
  }, [showAdd, ordering, search])

  useEffect(() => { localStorage.setItem('members:search', search) }, [search])

  const filtered = useMemo(() => {
    if (!search) return members
    const q = search.toLowerCase()
    return members.filter((m) => (m.user_username || '').toLowerCase().includes(q) || (m.member_id || '').toLowerCase().includes(q))
  }, [members, search])

  async function loadBalance(memberId: number) {
    if (balances[memberId] !== undefined) return
    setBalances((prev) => ({ ...prev, [memberId]: null })) // Set loading state
    try {
      const res = await api.get<any>(`/api/patients/${memberId}/coverage-balance/`)
      // naive sum of remaining_amounts where defined
      const totalRemaining = (res.balances || [])
        .map((b: any) => (typeof b.remaining_amount === 'number' ? b.remaining_amount : 0))
        .reduce((a: number, b: number) => a + b, 0)
      setBalances((prev) => ({ ...prev, [memberId]: totalRemaining }))
    } catch {
      setBalances((prev) => ({ ...prev, [memberId]: 0 }))
    }
  }

  async function loadAllBalances(memberList: any[]) {
    // Set loading state for all members
    const loadingState = memberList.reduce((acc: any, member: any) => {
      acc[member.id] = null
      return acc
    }, {})
    setBalances(loadingState)
    
    // Load balances for all members in parallel
    const balancePromises = memberList.map(async (member: any) => {
      try {
        const res = await api.get<any>(`/api/patients/${member.id}/coverage-balance/`)
        const totalRemaining = (res.balances || [])
          .map((b: any) => (typeof b.remaining_amount === 'number' ? b.remaining_amount : 0))
          .reduce((a: number, b: number) => a + b, 0)
        return { id: member.id, balance: totalRemaining }
      } catch {
        return { id: member.id, balance: 0 }
      }
    })
    
    const results = await Promise.all(balancePromises)
    const balanceMap = results.reduce((acc: any, { id, balance }: any) => {
      acc[id] = balance
      return acc
    }, {})
    setBalances(balanceMap)
  }

  async function checkDependentEligibility(memberId: number) {
    if (dependentEligibility[memberId] !== undefined) return
    setDependentEligibility((prev) => ({ ...prev, [memberId]: null })) // Set loading state
    try {
      const res = await api.get<any>(`/api/patients/${memberId}/can-add-dependent/`)
      setDependentEligibility((prev) => ({ ...prev, [memberId]: res }))
    } catch {
      setDependentEligibility((prev) => ({ ...prev, [memberId]: {
        can_add: false,
        current_count: 0,
        max_allowed: 0,
        remaining: 0,
        reason: 'Failed to check eligibility',
        tier_name: 'Unknown'
      }}))
    }
  }

  async function loadAllDependentEligibility(memberList: any[]) {
    // Only check for principal members
    const principalMembers = memberList.filter((m: any) => m.relationship === 'PRINCIPAL')
    
    // Set loading state
    const loadingState = principalMembers.reduce((acc: any, member: any) => {
      acc[member.id] = null
      return acc
    }, {})
    setDependentEligibility(loadingState)
    
    // Load eligibility for all principal members in parallel
    const eligibilityPromises = principalMembers.map(async (member: any) => {
      try {
        const res = await api.get<any>(`/api/patients/${member.id}/can-add-dependent/`)
        return { id: member.id, eligibility: res }
      } catch {
        return { 
          id: member.id, 
          eligibility: {
            can_add: false,
            current_count: 0,
            max_allowed: 0,
            remaining: 0,
            reason: 'Failed to check eligibility',
            tier_name: 'Unknown'
          }
        }
      }
    })
    
    const results = await Promise.all(eligibilityPromises)
    const eligibilityMap = results.reduce((acc: any, { id, eligibility }: any) => {
      acc[id] = eligibility
      return acc
    }, {})
    setDependentEligibility(eligibilityMap)
  }

  function toggleMenu(id: number) {
    setOpenMenu((prev) => (prev === id ? null : id))
    if (openMenu !== id) void loadBalance(id)
  }

  async function patchMember(id: number, data: any) {
    await api.patch(`/api/patients/${id}/`, data)
    // refresh row
    const res = await api.get<any>(`/api/patients/${id}/`)
    setMembers((list) => list.map((m) => (m.id === id ? res : m)))
  }
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1>Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search and view member details.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden w-64 sm:block"><Input placeholder="Search members" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Button onClick={() => setShowAdd(true)}><UserPlus className="w-4 h-4 mr-2" /> Add Member</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
        <Thead>
                  <Tr>
          <Th><button onClick={() => setOrdering(ordering === 'user__username' ? '-user__username' : 'user__username')}>Member</button></Th>
          {/* <Th><button onClick={() => setOrdering(ordering === 'member_id' ? '-member_id' : 'member_id')}>Member ID</button></Th> */}
          <Th><button onClick={() => setOrdering(ordering === 'user__date_joined' ? '-user__date_joined' : 'user__date_joined')}>Subscription start</button></Th>
          <Th>Next renewal</Th>
                    <Th>Status</Th>
                    <Th>Last claim</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {loading && Array.from({ length: 6 }).map((_, i) => (
                    <Tr key={i}><Td colSpan={8} className="text-xs text-muted-foreground">Loading…</Td></Tr>
                  ))}
                    {!loading && filtered.map((m) => (
                    <Tr 
                      key={m.id} 
                      className={`relative cursor-pointer hover:bg-muted/50 ${selectedMember?.id === m.id ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedMember(m)}
                    >
                      <Td>{m.user_username}</Td>
                      {/* <Td>{m.member_id}</Td> */}
                      <Td>{m.user_date_joined ? new Date(m.user_date_joined).toLocaleDateString() : '—'}</Td>
                      <Td>{m.next_renewal ? new Date(m.next_renewal).toLocaleDateString() : '—'}</Td>
                      <Td><Badge variant={m.status === 'ACTIVE' ? 'success' : m.status === 'SUSPENDED' ? 'warning' : 'info'}>{m.status?.charAt(0) + m.status?.slice(1).toLowerCase()}</Badge></Td>
                      <Td>{m.last_claim_date ? new Date(m.last_claim_date).toLocaleDateString() : '—'}</Td>
                      <Td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <UIButton variant="ghost" className="px-2">⋮</UIButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { patchMember(m.id, { status: m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }) }}>Toggle Status</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditing({ id: m.id, first_name: m.first_name, last_name: m.last_name })}>Edit Details</DropdownMenuItem>
                            {/* Only show Add Dependent for principal members */}
                            {m.relationship === 'PRINCIPAL' && (
                              <DropdownMenuItem 
                                onClick={() => {
                                  // Check eligibility first
                                  const eligibility = dependentEligibility[m.id]
                                  if (eligibility?.can_add) {
                                    setMemberForDependent(m)
                                    setShowAddDependent(true)
                                  }
                                }}
                                disabled={dependentEligibility[m.id] === null || !dependentEligibility[m.id]?.can_add}
                                className={!dependentEligibility[m.id]?.can_add ? 'opacity-50 cursor-not-allowed' : ''}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                {dependentEligibility[m.id] === null ? 'Checking...' : 
                                 dependentEligibility[m.id]?.can_add ? 
                                   `Add Dependent (${dependentEligibility[m.id]?.remaining} remaining)` : 
                                   dependentEligibility[m.id]?.reason || 'Cannot add dependent'}
                              </DropdownMenuItem>
                            )}
                            {/* Only show Change Scheme for admin users */}
                            {user?.role === 'ADMIN' && (
                              <DropdownMenuItem 
                                onClick={() => {
                                  setMemberForSchemeChange(m)
                                  setShowChangeScheme(true)
                                }}
                              >
                                <ArrowRight className="mr-2 h-4 w-4" />
                                Change Scheme
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3 text-sm">
              <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={!prev} onClick={() => prev && api.get<any>(prev).then((r) => { setMembers(r.results); setNext(r.next ?? null); setPrev(r.previous ?? null) })}>Prev</button>
              <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={!next} onClick={() => next && api.get<any>(next).then((r) => { setMembers(r.results); setNext(r.next ?? null); setPrev(r.previous ?? null) })}>Next</button>
            </div>
          </CardContent>
        </Card>
        <EditMemberModal
          open={!!editing}
          onOpenChange={(v: boolean) => !v && setEditing(null)}
          member={editing ? members.find((m) => m.id === editing.id) : null}
          onSave={async (payload: { first_name?: string; last_name?: string; scheme?: number; status?: string }) => { if (editing) { await patchMember(editing.id, payload); setEditing(null) } }}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Member Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {selectedMember ? (
              <>
                <div>
                  <div className="font-medium">
                    {selectedMember.user_first_name || selectedMember.user_last_name 
                      ? `${selectedMember.user_first_name || ''} ${selectedMember.user_last_name || ''}`.trim()
                      : selectedMember.user_username || 'Unknown Member'
                    }
                  </div>
                  <div className="text-muted-foreground">
                    {selectedMember.member_id ? `${selectedMember.member_id} • ` : ''}
                    {selectedMember.scheme_name || 'No Scheme'} • 
                    <span className={`ml-1 ${
                      selectedMember.status === 'ACTIVE' ? 'text-success' :
                      selectedMember.status === 'INACTIVE' ? 'text-muted-foreground' : 'text-warning'
                    }`}>
                      {selectedMember.status || 'Unknown'}
                    </span>
                  </div>
                </div>
                {selectedMember.user_email && (
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Contact</div>
                    <div>{selectedMember.user_email}</div>
                  </div>
                )}
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Benefit balance</div>
                  {balances[selectedMember.id] === null ? (
                    <div className="text-xs text-muted-foreground">Loading balance…</div>
                  ) : balances[selectedMember.id] !== undefined ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Available</span>
                        <span>{formatCurrency(balances[selectedMember.id]!)}</span>
                      </div>
                      <div className="h-2 rounded bg-muted">
                        <div 
                          className="h-2 rounded bg-accent" 
                          style={{ 
                            width: `${Math.min(100, ((balances[selectedMember.id]! || 0) / 10000) * 100)}%` 
                          }} 
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Balance not available</div>
                  )}
                </div>
                <SubscriptionCoverageCard key={`coverage-${selectedMember.id}`} patientId={selectedMember.id} />
                <BenefitUtilizationTracking key={`utilization-${selectedMember.id}`} patientId={selectedMember.id} />
                <SubscriptionManagement key={`management-${selectedMember.id}`} patientId={selectedMember.id} />
                <MemberBenefitUtilization key={`benefits-${selectedMember.id}`} memberId={selectedMember.id} />
                <MemberClaimsHistory key={`claims-${selectedMember.id}`} memberId={selectedMember.id} />
                <MemberCommunication key={`communication-${selectedMember.id}`} member={selectedMember} />
                <div className="text-xs underline cursor-pointer text-accent">View full profile</div>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Click on a member in the table to view their profile
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  <AddMemberModal open={showAdd} onOpenChange={setShowAdd} />
  <AddDependentModal 
    open={showAddDependent} 
    onOpenChange={setShowAddDependent}
    principalMember={memberForDependent}
    onSuccess={() => {
      setShowAddDependent(false)
      setMemberForDependent(null)
      // Refresh the members list
      const url = `/api/patients/?ordering=${encodeURIComponent(ordering)}${search ? `&search=${encodeURIComponent(search)}` : ''}`
      api.get<any>(url).then((resp: any) => {
        const results = resp.results ?? resp
        setMembers(results)
        if (results.length > 0) {
          loadAllBalances(results)
          loadAllDependentEligibility(results) // Also refresh eligibility
        }
      })
    }}
  />
  <ChangeSchemeModal
    open={showChangeScheme}
    onOpenChange={setShowChangeScheme}
    member={memberForSchemeChange}
    onSuccess={() => {
      setShowChangeScheme(false)
      setMemberForSchemeChange(null)
      // Refresh the members list
      const url = `/api/patients/?ordering=${encodeURIComponent(ordering)}${search ? `&search=${encodeURIComponent(search)}` : ''}`
      api.get<any>(url).then((resp: any) => {
        const results = resp.results ?? resp
        setMembers(results)
        if (results.length > 0) {
          loadAllBalances(results)
          loadAllDependentEligibility(results)
        }
      })
    }}
  />
    </div>
  )
}
