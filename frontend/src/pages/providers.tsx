import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { getProvidersAnalytics } from '@/lib/api'
import type { ProvidersAnalytics } from '@/types/api'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { AddProviderModal } from '@/components/modals/add-provider-modal'

export default function Providers() {
  const [data, setData] = useState<ProvidersAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1>Providers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ranking by volume and approval rate.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><UserPlus className="h-4 w-4 mr-2" /> Add Provider</Button>
      </div>
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
                  <Tr key={row.provider_id}>
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
          <div className="mt-3 text-xs text-muted-foreground">Click a provider for details: KPIs, recent claims, anomaly flags.</div>
        </CardContent>
  </Card>
  <AddProviderModal open={showAdd} onOpenChange={setShowAdd} onSuccess={load} />
    </div>
  )
}
