import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { Mail } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AddMemberModal } from '@/components/modals/add-member-modal'
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

  if (loading) return <Skeleton className="w-full h-24" />
  if (error) return <div className="text-xs text-destructive">{error}</div>
  if (!claims.length) return <div className="text-xs text-muted-foreground">No claims found.</div>

  return (
    <div className="space-y-2">
      <div className="mb-1 font-medium">Recent Claims with Subscription Context</div>
      <Table>
        <Thead>
          <Tr>
            <Th>Date</Th>
            <Th>Service</Th>
            <Th>Cost</Th>
            <Th>Status</Th>
            <Th>Subscription Tier</Th>
            <Th>Utilization</Th>
            <Th>Remaining</Th>
          </Tr>
        </Thead>
        <Tbody>
          {claims.slice(0, 5).map((c) => {
            const subscription = c.subscription_context
            const utilization = subscription?.utilization_info
            
            return (
              <Tr key={c.id}>
                <Td>{c.date_of_service ? new Date(c.date_of_service).toLocaleDateString() : '—'}</Td>
                <Td>{c.service_type_name || '—'}</Td>
                <Td>{formatCurrency(c.cost)}</Td>
                <Td><Badge variant={
                  c.status === 'APPROVED' ? 'success' :
                  c.status === 'PENDING' ? 'warning' :
                  c.status === 'REJECTED' ? 'destructive' : 'outline'
                }>{c.status}</Badge></Td>
                <Td>
                  {subscription?.has_subscription ? (
                    <div className="text-xs">
                      <div className="font-medium">{subscription.tier_name}</div>
                      <div className="text-muted-foreground">Level {subscription.tier_level}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No subscription</span>
                  )}
                </Td>
                <Td>
                  {utilization ? (
                    <div className="space-y-1">
                      <div className="text-xs">
                        {formatCurrency(utilization.used_amount)} / {formatCurrency(utilization.benefit_limit)}
                      </div>
                      <div className="w-16 h-1.5 bg-muted rounded">
                        <div 
                          className={`h-1.5 rounded ${
                            utilization.utilization_percentage > 90 ? 'bg-destructive' :
                            utilization.utilization_percentage > 70 ? 'bg-warning' : 'bg-success'
                          }`}
                          style={{ width: `${Math.min(utilization.utilization_percentage, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {utilization.utilization_percentage.toFixed(1)}%
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </Td>
                <Td>
                  {utilization ? (
                    <div className="text-xs">
                      <div className="font-medium">{formatCurrency(utilization.remaining_amount)}</div>
                      {utilization.remaining_amount < (utilization.benefit_limit * 0.1) && (
                        <div className="text-destructive">Low balance</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
    </div>
  )
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
  const [showAdd, setShowAdd] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [prev, setPrev] = useState<string | null>(null)
  const [ordering, setOrdering] = useState<string>('-id')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string>(() => localStorage.getItem('members:search') || '')
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [balances, setBalances] = useState<Record<number, number | null>>({})
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
    const loadingBalances: Record<number, number | null> = {}
    memberList.forEach(member => {
      if (balances[member.id] === undefined) {
        loadingBalances[member.id] = null // null indicates loading
      }
    })
    if (Object.keys(loadingBalances).length > 0) {
      setBalances((prev) => ({ ...prev, ...loadingBalances }))
    }

    const balancePromises = memberList.map(async (member) => {
      if (balances[member.id] === undefined) {
        try {
          const res = await api.get<any>(`/api/patients/${member.id}/coverage-balance/`)
          const totalRemaining = (res.balances || [])
            .map((b: any) => (typeof b.remaining_amount === 'number' ? b.remaining_amount : 0))
            .reduce((a: number, b: number) => a + b, 0)
          return { memberId: member.id, balance: totalRemaining }
        } catch {
          return { memberId: member.id, balance: 0 }
        }
      }
      return null
    })

    const results = await Promise.all(balancePromises)
    const newBalances: Record<number, number> = {}
    
    results.forEach((result) => {
      if (result) {
        newBalances[result.memberId] = result.balance
      }
    })

    if (Object.keys(newBalances).length > 0) {
      setBalances((prev) => ({ ...prev, ...newBalances }))
    }
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
        <Thead>
                  <Tr>
          <Th><button onClick={() => setOrdering(ordering === 'user__username' ? '-user__username' : 'user__username')}>Member</button></Th>
          <Th><button onClick={() => setOrdering(ordering === 'member_id' ? '-member_id' : 'member_id')}>Member ID</button></Th>
          <Th><button onClick={() => setOrdering(ordering === 'scheme__name' ? '-scheme__name' : 'scheme__name')}>Scheme</button></Th>
          <Th><button onClick={() => setOrdering(ordering === 'user__date_joined' ? '-user__date_joined' : 'user__date_joined')}>Subscription start</button></Th>
          <Th>Next renewal</Th>
                    <Th>Status</Th>
                    <Th>Benefit balance</Th>
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
                      <Td>{m.member_id}</Td>
                      <Td>{m.scheme_name}</Td>
                      <Td>{m.user_date_joined ? new Date(m.user_date_joined).toLocaleDateString() : '—'}</Td>
                      <Td>{m.next_renewal ? new Date(m.next_renewal).toLocaleDateString() : '—'}</Td>
                      <Td><Badge variant={m.status === 'ACTIVE' ? 'success' : m.status === 'SUSPENDED' ? 'warning' : 'info'}>{m.status?.charAt(0) + m.status?.slice(1).toLowerCase()}</Badge></Td>
                      <Td title="Sum of remaining amounts across benefits">
                        {balances[m.id] === null ? (
                          <span className="text-xs text-muted-foreground">Loading…</span>
                        ) : (
                          formatCurrency(balances[m.id] || 0)
                        )}
                      </Td>
                      <Td>{m.last_claim_date ? new Date(m.last_claim_date).toLocaleDateString() : '—'}</Td>
                      <Td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <UIButton variant="ghost" className="px-2">⋮</UIButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { patchMember(m.id, { status: m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }) }}>Toggle Status</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditing({ id: m.id, first_name: m.first_name, last_name: m.last_name })}>Edit Details</DropdownMenuItem>
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
                <SubscriptionCoverageCard patientId={selectedMember.id} />
                <BenefitUtilizationTracking patientId={selectedMember.id} />
                <SubscriptionManagement patientId={selectedMember.id} />
                <MemberBenefitUtilization memberId={selectedMember.id} />
                <MemberClaimsHistory memberId={selectedMember.id} />
                <MemberCommunication member={selectedMember} />
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
    </div>
  )
}
