import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { ManageSchemesModal } from '@/components/modals/manage-schemes-modal'
import { formatCurrency } from '@/lib/currency'

export default function Schemes() {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1>Schemes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Explore scheme performance and utilization.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Settings2 className="h-4 w-4 mr-2" /> Manage Schemes</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {['VIP', 'VVIP', 'Standard'].map((s, i) => (
          <Card key={s}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{s}</CardTitle>
                <Badge variant="info">Utilization {60 + i * 10}%</Badge>
              </div>
              <CardDescription>{(4000 + i * 800).toLocaleString()} members • Claim value {formatCurrency((1.2 + i * 0.3) * 1_000_000)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Outpatient</span><span>75%</span></div>
                <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-accent" style={{ width: '75%' }} /></div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Inpatient</span><span>62%</span></div>
                <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-success" style={{ width: '62%' }} /></div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Pharmacy</span><span>54%</span></div>
                <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-warning" style={{ width: '54%' }} /></div>
              </div>
              <div className="text-xs text-accent underline">Open details</div>
            </CardContent>
          </Card>
        ))}
      </div>
  <ManageSchemesModal open={open} onOpenChange={setOpen} />
  </div>
  )
}
