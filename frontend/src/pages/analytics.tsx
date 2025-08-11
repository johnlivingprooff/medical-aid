import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Charts and KPIs highlighting utilization and performance.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>Chart {i + 1}</CardTitle>
              <CardDescription>Insight description</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 rounded-md border border-border bg-gradient-to-br from-muted to-muted/50" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
