import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Export and schedule reports.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report toolbar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Filter by scheme/provider/date" className="w-64" />
            <Button>Export CSV</Button>
            <Button variant="secondary">Export PDF</Button>
            <Button variant="outline">Schedule…</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 rounded-md border border-border bg-white" />
        </CardContent>
      </Card>
    </div>
  )
}
