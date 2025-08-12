import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AddMemberModal } from '@/components/modals/add-member-modal'
import { formatCurrency } from '@/lib/currency'
import { api } from '@/lib/api'
import { Button as UIButton } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EditMemberModal } from '../components/modals/edit-member-modal'

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
  const [balances, setBalances] = useState<Record<number, number>>({})
  const [editing, setEditing] = useState<{ id: number; first_name?: string; last_name?: string } | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    const url = `/api/patients/?ordering=${encodeURIComponent(ordering)}${search ? `&search=${encodeURIComponent(search)}` : ''}`
    api.get<any>(url)
      .then((resp: any) => { if (!mounted) return; const results = resp.results ?? resp; setMembers(results); setNext(resp.next ?? null); setPrev(resp.previous ?? null) })
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
    try {
      const res = await api.get<any>(`/api/patients/${memberId}/coverage-balance/`)
      // naive sum of remaining_amounts where defined
      const totalRemaining = (res.balances || [])
        .map((b: any) => (typeof b.remaining_amount === 'number' ? b.remaining_amount : 0))
        .reduce((a: number, b: number) => a + b, 0)
      setBalances((prev) => ({ ...prev, [memberId]: totalRemaining }))
    } catch {}
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
          <div className="w-64 hidden sm:block"><Input placeholder="Search members" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Button onClick={() => setShowAdd(true)}><UserPlus className="h-4 w-4 mr-2" /> Add Member</Button>
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
                    <Tr key={m.id} className="relative">
                      <Td>{m.user_username}</Td>
                      <Td>{m.member_id}</Td>
                      <Td>{m.scheme_name}</Td>
                      <Td>{m.user_date_joined ? new Date(m.user_date_joined).toLocaleDateString() : '—'}</Td>
                      <Td>{m.next_renewal ? new Date(m.next_renewal).toLocaleDateString() : '—'}</Td>
                      <Td><Badge variant={m.status === 'ACTIVE' ? 'success' : m.status === 'SUSPENDED' ? 'warning' : 'info'}>{m.status?.charAt(0) + m.status?.slice(1).toLowerCase()}</Badge></Td>
                      <Td title="Sum of remaining amounts across benefits">{formatCurrency(balances[m.id] ?? 0)}</Td>
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
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={!prev} onClick={() => prev && api.get<any>(prev).then((r) => { setMembers(r.results); setNext(r.next ?? null); setPrev(r.previous ?? null) })}>Prev</button>
              <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={!next} onClick={() => next && api.get<any>(next).then((r) => { setMembers(r.results); setNext(r.next ?? null); setPrev(r.previous ?? null) })}>Next</button>
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
            <div>
              <div className="font-medium">John Banda</div>
              <div className="text-muted-foreground">MBR-1001 • VIP • Active</div>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Benefit balances</div>
              <div className="mb-2 h-2 rounded bg-muted"><div className="h-2 rounded bg-accent" style={{ width: '64%' }} /></div>
              <div className="mb-2 h-2 rounded bg-muted"><div className="h-2 rounded bg-success" style={{ width: '42%' }} /></div>
              <div className="mb-2 h-2 rounded bg-muted"><div className="h-2 rounded bg-warning" style={{ width: '28%' }} /></div>
            </div>
            <div className="text-xs text-accent underline">Open full profile</div>
          </CardContent>
        </Card>
      </div>
  <AddMemberModal open={showAdd} onOpenChange={setShowAdd} />
    </div>
  )
}
