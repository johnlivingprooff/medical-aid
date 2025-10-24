import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { credentialingApi } from '@/lib/api'
import type { CredentialingDashboard, CredentialingReview, CredentialingDocument, ProviderNetworkMembership, DocumentExpiryAlert, PaginatedResponse } from '@/types/models'
import { useAuth } from '@/components/auth/auth-context'

export default function CredentialingPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1>Credentialing</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage credentialing reviews, documents, and alerts.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <CredentialingDashboardView />
        </TabsContent>
        <TabsContent value="reviews">
          <CredentialingReviewsView role={user?.role || 'GUEST'} />
        </TabsContent>
        <TabsContent value="documents">
          <CredentialingDocumentsView role={user?.role || 'GUEST'} />
        </TabsContent>
        <TabsContent value="alerts">
          <CredentialingAlertsView />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CredentialingDashboardView() {
  const [data, setData] = useState<CredentialingDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    credentialingApi.getDashboard()
      .then(d => { if (!mounted) return; setData(d) })
      .catch(e => { if (!mounted) return; setError(e.message || 'Failed to load dashboard') })
      .finally(() => { if (!mounted) return; setLoading(false) })
    return () => { mounted = false }
  }, [])

  if (loading) return <Skeleton className="h-40 w-full" />
  if (error) return <EmptyState message={error} />
  if (!data) return <EmptyState message="No dashboard data available." />

  const role = data.user_role

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.overview && (
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between"><span>Total memberships</span><span>{data.overview.total_memberships.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Pending</span><span>{data.overview.pending_credentialing.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Approved</span><span>{data.overview.approved_credentialing.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Rejected</span><span>{data.overview.rejected_credentialing.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Completion rate</span><span>{data.overview.credentialing_completion_rate}%</span></div>
          </CardContent>
        </Card>
      )}

      {data.documents && (
        <Card>
          <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between"><span>Total</span><span>{data.documents.total.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Pending reviews</span><span>{data.documents.pending_reviews.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Reviewed</span><span>{data.documents.reviewed.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Rejected</span><span>{data.documents.rejected.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Completion rate</span><span>{data.documents.review_completion_rate}%</span></div>
          </CardContent>
        </Card>
      )}

      {data.reviews && (
        <Card>
          <CardHeader><CardTitle>Reviews</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between"><span>Total</span><span>{data.reviews.total_reviews.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Pending</span><span>{data.reviews.pending.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>In review</span><span>{data.reviews.in_review.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Completed</span><span>{data.reviews.completed.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Overdue</span><span>{data.reviews.overdue.toLocaleString()}</span></div>
          </CardContent>
        </Card>
      )}

      {data.memberships && (
        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader><CardTitle>My Memberships</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Scheme</Th>
                    <Th>Status</Th>
                    <Th>Docs</Th>
                    <Th>Completion</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {data.memberships.map((m, i) => (
                    <Tr key={i}>
                      <Td>{m.scheme}</Td>
                      <Td><Badge>{m.status}</Badge></Td>
                      <Td>{m.documents.approved}/{m.documents.total} approved ({m.documents.pending} pending, {m.documents.rejected} rejected)</Td>
                      <Td>{m.documents.completion_rate}%</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CredentialingReviewsView({ role }: { role: string }) {
  const [data, setData] = useState<PaginatedResponse<CredentialingReview> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [priority, setPriority] = useState<string>('')

  function load(page?: number) {
    setLoading(true)
    setError(null)
    credentialingApi.getReviews({ status: status || undefined, priority: priority || undefined, page })
      .then(d => setData(d))
      .catch(e => setError(e.message || 'Failed to load reviews'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function doAction(id: number, action: 'APPROVE' | 'REJECT' | 'ESCALATE') {
    const notes = action === 'ESCALATE' ? 'Escalated by reviewer' : ''
    credentialingApi.completeReview(id, { action, notes })
      .then(() => load())
      .catch(e => alert(e.message))
  }

  return (
    <Card>
      <CardHeader><CardTitle>Reviews</CardTitle></CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="IN_REVIEW">In Review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="ESCALATED">Escalated</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={() => load()}>Apply Filters</Button>
        </div>
        {error && <EmptyState message={error} />}
        <div className="overflow-auto">
          {(!loading && (!data?.results || data.results.length === 0)) ? (
            <EmptyState message="No credentialing reviews found." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Document</Th>
                  <Th>Provider</Th>
                  <Th>Scheme</Th>
                  <Th>Status</Th>
                  <Th>Priority</Th>
                  <Th>Due</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <Tr key={i}><Td colSpan={7}><Skeleton className="h-4 w-full" /></Td></Tr>
                ))}
                {!loading && (data?.results || []).map(r => (
                  <Tr key={r.id}>
                    <Td>{r.document_type}</Td>
                    <Td>{r.provider_name}</Td>
                    <Td>{r.scheme_name}</Td>
                    <Td><Badge>{r.status}</Badge></Td>
                    <Td>{r.priority}</Td>
                    <Td>{r.due_date ? new Date(r.due_date).toLocaleDateString() : '—'}</Td>
                    <Td className="space-x-2">
                      {role === 'ADMIN' && (
                        <>
                          <Button size="sm" onClick={() => doAction(r.id, 'APPROVE')}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => doAction(r.id, 'REJECT')}>Reject</Button>
                        </>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CredentialingDocumentsView({ role }: { role: string }) {
  const [docs, setDocs] = useState<PaginatedResponse<CredentialingDocument> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<PaginatedResponse<ProviderNetworkMembership> | null>(null)
  const [docType, setDocType] = useState('')
  const [membership, setMembership] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    Promise.all([
      credentialingApi.getDocuments(),
      role === 'PROVIDER' ? credentialingApi.getMemberships() : Promise.resolve(null as any),
    ])
      .then(([d, m]) => { setDocs(d); if (m) setMemberships(m) })
      .catch(e => setError(e.message || 'Failed to load documents'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function onUpload() {
    if (!file || !docType || !membership) return alert('Select membership, document type and file')
    credentialingApi.uploadDocument({ membership: Number(membership), doc_type: docType, notes: notes || undefined, file })
      .then(() => { setDocType(''); setMembership(''); setNotes(''); setFile(null as any); load() })
      .catch(e => alert(e.message))
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        <CardContent>
          {error && <EmptyState message={error} />}
          <div className="overflow-auto">
            {(!loading && (!docs?.results || docs.results.length === 0)) ? (
              <EmptyState message="No credentialing documents uploaded." />
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Uploaded By</Th>
                    <Th>Uploaded</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {loading && Array.from({ length: 6 }).map((_, i) => (
                    <Tr key={i}><Td colSpan={4}><Skeleton className="h-4 w-full" /></Td></Tr>
                  ))}
                  {!loading && (docs?.results || []).map(d => (
                    <Tr key={d.id}>
                      <Td>{d.doc_type}</Td>
                      <Td><Badge>{d.status}</Badge></Td>
                      <Td>{d.uploaded_by_username}</Td>
                      <Td>{new Date(d.created_at).toLocaleString()}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {role === 'PROVIDER' && (
        <Card>
          <CardHeader><CardTitle>Upload Document</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <label className="text-xs">Membership</label>
              <Select value={membership} onValueChange={setMembership}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select membership" /></SelectTrigger>
                <SelectContent className="min-w-[240px] w-[var(--radix-select-trigger-width)]">
                  {(memberships?.results || []).map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.scheme_name} • {m.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs">Document Type</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="min-w-[240px] w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="LICENSE">License</SelectItem>
                  <SelectItem value="INSURANCE">Insurance</SelectItem>
                  <SelectItem value="ACCREDITATION">Accreditation</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs">Notes</label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
            </div>
            <div className="grid gap-2">
              <label className="text-xs">File</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Button onClick={onUpload} disabled={!file || !membership || !docType}>Upload</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CredentialingAlertsView() {
  const [alerts, setAlerts] = useState<PaginatedResponse<DocumentExpiryAlert> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    credentialingApi.getExpiryAlerts()
      .then(d => setAlerts(d))
      .catch(e => setError(e.message || 'Failed to load alerts'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader><CardTitle>Expiry Alerts</CardTitle></CardHeader>
      <CardContent>
        {error && <EmptyState message={error} />}
        <div className="overflow-auto">
          {(!loading && (!alerts?.results || alerts.results.length === 0)) ? (
            <EmptyState message="No document expiry alerts." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Type</Th>
                  <Th>Provider</Th>
                  <Th>Message</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <Tr key={i}><Td colSpan={5}><Skeleton className="h-4 w-full" /></Td></Tr>
                ))}
                {!loading && (alerts?.results || []).map(a => (
                  <Tr key={a.id}>
                    <Td>{a.document_type}</Td>
                    <Td>{a.provider_name}</Td>
                    <Td className="max-w-[480px] whitespace-pre-wrap">{a.message}</Td>
                    <Td><Badge variant={a.is_acknowledged ? 'outline' : 'warning'}>{a.is_acknowledged ? 'Acknowledged' : 'Active'}</Badge></Td>
                    <Td>{new Date(a.created_at).toLocaleString()}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
