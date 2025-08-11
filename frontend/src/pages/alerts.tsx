import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function Alerts() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real‑time alerts and fraud signals.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Stream</CardTitle>
            <CardDescription>Newest first</CardDescription>
          </div>
          <Badge variant="warning">7</Badge>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {Array.from({ length: 10 }).map((_, i) => (
              <li key={i} className="flex items-start gap-3 py-3">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${i % 3 === 0 ? 'bg-info' : i % 3 === 1 ? 'bg-warning' : 'bg-destructive'}`} />
                <div>
                  <div className="font-medium">Alert title {i + 1}</div>
                  <div className="text-xs text-muted-foreground">Concise message • {i + 1}h ago</div>
                  <div className="mt-2 flex gap-2 text-xs">
                    <button className="text-accent">View Claim</button>
                    <span className="text-muted-foreground">•</span>
                    <button className="text-destructive">Flag Fraud</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
