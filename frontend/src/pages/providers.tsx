import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { api, getProvidersAnalytics } from '@/lib/api'
import type { ProvidersAnalytics } from '@/types/api'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/currency'
import { formatFullName } from '@/lib/format-name'
import { capitalizeFirst } from '@/lib/format-text'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { AddProviderModal } from '@/components/modals/add-provider-modal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProviderDirectory } from '@/components/providers/provider-directory'

export default function Providers() {
  const [data, setData] = useState<ProvidersAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [tab, setTab] = useState('dashboard')
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null)
  const [claims, setClaims] = useState<any[]>([])
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    getProvidersAnalytics()
      .then((d) => setData(d))
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let mounted = true
    getProvidersAnalytics()
      .then((d) => { if (!mounted) return; setData(d) })
      .catch((e) => { if (!mounted) return; setError(e.message || 'Failed to load') })
      .finally(() => { if (!mounted) return; setLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!selectedProvider) return
    setClaimsLoading(true)
    Promise.all([
      api.get<any>(`/api/claims/?provider=${selectedProvider}&ordering=-date_submitted`),
      api.get<any>(`/api/core/analytics/providers/${selectedProvider}/`),
    ])
      .then(([claimsResp, detailResp]) => {
        setClaims(claimsResp.results ?? claimsResp)
        setDetail(detailResp)
      })
      .catch(() => { setClaims([]); setDetail(null) })
      .finally(() => setClaimsLoading(false))
  }, [selectedProvider])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1>Providers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ranking by volume and approval rate.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><UserPlus className="h-4 w-4 mr-2" /> Add Provider</Button>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="directory">Directory</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Providers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Provider</Th>
                      <Th>Claims</Th>
                      <Th>Approval %</Th>
                      <Th>Approved Amount</Th>
                      <Th>Avg Proc (days)</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {loading && (
                      Array.from({ length: 8 }).map((_, i) => (
                        <Tr key={i}><Td colSpan={5}><Skeleton className="h-4 w-full" /></Td></Tr>
                      ))
                    )}
                    {!loading && data?.results.map((row) => (
                      <Tr key={row.provider_id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedProvider(row.provider_id); setTab('claims') }}>
                        <Td>{row.provider}</Td>
                        <Td>{row.total_claims.toLocaleString()}</Td>
                        <Td>{(row.approval_rate * 100).toFixed(1)}%</Td>
                        <Td>{formatCurrency(row.approved_amount)}</Td>
                        <Td>{row.avg_processing_days.toFixed(2)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
              {/* <div className="mt-3 text-xs text-muted-foreground">Click a provider for details: KPIs, recent claims, anomaly flags.</div> */}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="claims">
          <Card>
            <CardHeader><CardTitle>Recent Claims</CardTitle></CardHeader>
            <CardContent>
              {!selectedProvider && <div className="text-xs text-muted-foreground">Select a provider from Dashboard</div>}
              {selectedProvider && (
                <div className="overflow-auto">
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Date</Th>
                        <Th>Member</Th>
                        <Th>Service</Th>
                        <Th>Amount</Th>
                        <Th>Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {claimsLoading && Array.from({ length: 6 }).map((_, i) => (
                        <Tr key={i}><Td colSpan={5}><Skeleton className="h-4 w-full" /></Td></Tr>
                      ))}
                      {!claimsLoading && claims.map((c) => (
                        <Tr key={c.id}>
                          <Td>{c.date_of_service ? new Date(c.date_of_service).toLocaleDateString() : '—'}</Td>
                          <Td>{formatFullName(c.patient_detail?.user_first_name, c.patient_detail?.user_last_name)}</Td>
                          <Td>{c.service_type_name || '—'}</Td>
                          <Td>{formatCurrency(c.cost)}</Td>
                          <Td><Badge variant={
                            c.status === 'APPROVED' ? 'success' :
                            c.status === 'PENDING' ? 'warning' :
                            c.status === 'REJECTED' ? 'destructive' : 'outline'
                          }>{c.status}</Badge></Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics">
          <Card>
            <CardHeader><CardTitle>Analytics</CardTitle></CardHeader>
            <CardContent>
              {!selectedProvider && <div className="text-xs text-muted-foreground">Select a provider from Dashboard</div>}
              {selectedProvider && detail && (
                <div className="space-y-4">
                  <div className="text-sm">Totals: Approved {formatCurrency(detail.totals.approved_amount)} • Pending {formatCurrency(detail.totals.pending_amount)} • Approval {(detail.totals.approval_rate * 100).toFixed(1)}%</div>
                  <div>
                    <div className="mb-1 font-medium">Top Services</div>
                    <Table>
                      <Thead><Tr><Th>Service</Th><Th>Count</Th><Th>Amount</Th></Tr></Thead>
                      <Tbody>
                        {detail.top_services.map((s: any, idx: number) => (
                          <Tr key={idx}><Td>{capitalizeFirst(s.service_type_name || s.service_type)}</Td><Td>{s.count}</Td><Td>{formatCurrency(s.amount)}</Td></Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
          <TabsContent value="directory">
            <ProviderDirectory />
          </TabsContent>
      </Tabs>
      <AddProviderModal open={showAdd} onOpenChange={setShowAdd} />
    </div>
  )
}

// Removed legacy Provider Network & EDI placeholder per updated requirements
