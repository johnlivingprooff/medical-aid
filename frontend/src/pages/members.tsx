import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { AddMemberModal } from '@/components/modals/add-member-modal'
import { formatCurrency } from '@/lib/currency'

export default function Members() {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1>Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search and view member details.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-64 hidden sm:block"><Input placeholder="Search members" /></div>
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
                    <Th>Member</Th>
                    <Th>Member ID</Th>
                    <Th>Scheme</Th>
                    <Th>Status</Th>
                    <Th>Benefit balance</Th>
                    <Th>Last claim</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Tr key={i}>
                      <Td>John Banda</Td>
                      <Td>MBR-{1000 + i}</Td>
                      <Td>VIP</Td>
                      <Td><Badge variant={i % 3 === 0 ? 'success' : 'info'}>{i % 3 === 0 ? 'Active' : 'New'}</Badge></Td>
                      <Td>{formatCurrency((3000 - i * 120) * 1000)}</Td>
                      <Td>2025-07-28</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
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
