import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { SubmitClaimModal } from '@/components/modals/submit-claim-modal'
import { QuickActions } from '@/components/layout/quick-actions'
import type { Claim } from '@/types/models'

export default function Claims() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [prev, setPrev] = useState<string | null>(null)
  const [ordering, setOrdering] = useState<string>('-date_submitted')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [showClaim, setShowClaim] = useState(false)
  // Providers tab data
  const [providersData, setProvidersData] = useState<any[] | null>(null)
  const [providersLoading, setProvidersLoading] = useState(false)
  const [providersError, setProvidersError] = useState<string | null>(null)
  // Schemes tab data
  const [schemesData, setSchemesData] = useState<any[] | null>(null)
  const [schemesLoading, setSchemesLoading] = useState(false)
  const [schemesError, setSchemesError] = useState<string | null>(null)
  // Members tab data
  const [membersData, setMembersData] = useState<any[] | null>(null)
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState<string | null>(null)


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
    // Load providers analytics
    let mounted = true
    setProvidersLoading(true)
    setProvidersError(null)
    api.get<any>('/api/core/analytics/providers/')
      .then(d => { if (!mounted) return; setProvidersData(d.results ?? d) })
      .catch(e => { if (!mounted) return; setProvidersError(e.message || 'Failed to load providers') })
      .finally(() => { if (!mounted) return; setProvidersLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    // Load schemes overview
    let mounted = true
    setSchemesLoading(true)
    setSchemesError(null)
    api.get<any>('/api/core/analytics/schemes/overview/')
      .then(d => { if (!mounted) return; setSchemesData(d.results ?? d) })
      .catch(e => { if (!mounted) return; setSchemesError(e.message || 'Failed to load schemes') })
      .finally(() => { if (!mounted) return; setSchemesLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    // Load members analytics
    let mounted = true
    setMembersLoading(true)
    setMembersError(null)
    api.get<any>('/api/core/analytics/members/')
      .then(d => { if (!mounted) return; setMembersData(d.results ?? d) })
      .catch(e => { if (!mounted) return; setMembersError(e.message || 'Failed to load members') })
      .finally(() => { if (!mounted) return; setMembersLoading(false) })
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    let list = claims
    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter(c => `${c.id}`.includes(q) || c.patient_detail?.user_username?.toLowerCase().includes(q) || c.patient_detail?.member_id?.toLowerCase().includes(q) || c.service_type_name?.toLowerCase().includes(q))
    }
    if (filters.status) list = list.filter(c => c.status === filters.status)
    return list
  }, [claims, filters])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1>Claims</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review, filter, and act on claims.</p>
        </div>
        <QuickActions />
      </div>

      <Tabs defaultValue="claims">
        <TabsList>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="schemes">Schemes</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="claims">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Input placeholder="Search (ID, member, service)" value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} />
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}>
                  <option value="">All statuses</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <div className="col-span-3" />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Badge>last 7 days</Badge>
                <Badge>last 30 days</Badge>
                <Badge>last 90 days</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Claims Table</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table>
          <Thead>
                    <Tr>
            <Th><button onClick={() => setOrdering(ordering === 'id' ? '-id' : 'id')}>Claim ID</button></Th>
            <Th>Member</Th>
            <Th>Provider</Th>
            <Th>Service</Th>
            <Th><button onClick={() => setOrdering(ordering === 'date_submitted' ? '-date_submitted' : 'date_submitted')}>Date</button></Th>
            <Th className="text-right"><button onClick={() => setOrdering(ordering === 'cost' ? '-cost' : 'cost')}>Amount</button></Th>
                      <Th>Status</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {loading && Array.from({ length: 8 }).map((_, i) => (
                      <Tr key={i}><Td colSpan={8} className="text-xs text-muted-foreground">Loading…</Td></Tr>
                    ))}
                    {!loading && filtered.map((c) => (
                      <Tr key={c.id}>
                        <Td>#{c.id}</Td>
                        <Td>{c.patient_detail?.user_username}</Td>
                        <Td>{c.provider_username || `#${c.provider}`}</Td>
                        <Td>{c.service_type_name}</Td>
                        <Td>{new Date(c.date_submitted).toLocaleDateString()}</Td>
                        <Td className="text-right">{formatCurrency(c.cost)}</Td>
                        <Td>
                          <Badge variant={c.status === 'APPROVED' ? 'success' : c.status === 'PENDING' ? 'warning' : 'destructive'}>
                            {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                          </Badge>
                        </Td>
                        <Td>
                          <Button variant="ghost" className="px-2">⋮</Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
              {/* <div className="mt-3 text-sm text-muted-foreground">Hover a row to reveal actions. Select with checkboxes for bulk actions.</div> */}
              <Separator className="my-3" />
              <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={!prev} onClick={() => prev && api.get<any>(prev).then((r) => { setClaims(r.results ?? r); setNext(r.next ?? null); setPrev(r.previous ?? null) })}>Prev</button>
                <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={!next} onClick={() => next && api.get<any>(next).then((r) => { setClaims(r.results ?? r); setNext(r.next ?? null); setPrev(r.previous ?? null) })}>Next</button>
              </div>
              {!loading && filtered.length === 0 && (
                <div className="text-center text-sm text-muted-foreground">Empty state: No claims match filters. <button className="text-accent underline" onClick={() => setShowClaim(true)}>Submit Claim</button></div>
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
      <SubmitClaimModal open={showClaim} onOpenChange={setShowClaim} />
      
    </div>
  )
}
