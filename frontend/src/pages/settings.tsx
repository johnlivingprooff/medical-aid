import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure application preferences.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xl grid-cols-1 gap-4">
          <div>
            <Label htmlFor="accent">Accent color</Label>
            <Input id="accent" placeholder="#2E7DFF" />
          </div>
          <div>
            <Label htmlFor="logo">Logo URL</Label>
            <Input id="logo" placeholder="/logo.svg" />
          </div>
          <div className="pt-2"><Button>Save</Button></div>
        </CardContent>
      </Card>
    </div>
  )
}
