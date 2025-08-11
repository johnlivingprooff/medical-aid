import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Admin() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cautionary utilities. Handle with care.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">Reset demo data and rebuild analytics.
            <div className="text-xs text-muted-foreground">Irreversible in production environments.</div>
          </div>
          <Button variant="destructive">Reset & Rebuild</Button>
        </CardContent>
      </Card>
    </div>
  )
}
