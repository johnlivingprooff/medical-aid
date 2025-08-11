import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function Claims() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Claims</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review, filter, and act on claims.</p>
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
                <Input placeholder="Date range" />
                <Input placeholder="Scheme" />
                <Input placeholder="Provider" />
                <Input placeholder="Status" />
                <Input placeholder="Amount range" />
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
                      <Th>Claim ID</Th>
                      <Th>Member</Th>
                      <Th>Provider</Th>
                      <Th>Scheme</Th>
                      <Th>Date</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Status</Th>
                      <Th>SLA Age</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Tr key={i}>
                        <Td>#CLM-10{i}2</Td>
                        <Td>J. Banda</Td>
                        <Td>CityCare</Td>
                        <Td>VIP</Td>
                        <Td>2025-08-01</Td>
                        <Td className="text-right">$1,230.00</Td>
                        <Td><Badge variant={i % 3 === 0 ? 'success' : i % 3 === 1 ? 'warning' : 'destructive'}>{i % 3 === 0 ? 'Approved' : i % 3 === 1 ? 'Pending' : 'Rejected'}</Badge></Td>
                        <Td>{i + 1}d</Td>
                        <Td>
                          <Button variant="ghost" className="px-2">⋮</Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">Hover a row to reveal actions. Select with checkboxes for bulk actions.</div>
              <Separator className="my-3" />
              <div className="text-center text-sm text-muted-foreground">Empty state: No claims match filters. <button className="text-accent underline">Submit Claim</button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schemes">
          <div className="text-sm text-muted-foreground">Schemes drill‑down appears here.</div>
        </TabsContent>
        <TabsContent value="providers">
          <div className="text-sm text-muted-foreground">Providers drill‑down appears here.</div>
        </TabsContent>
        <TabsContent value="members">
          <div className="text-sm text-muted-foreground">Members drill‑down appears here.</div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
