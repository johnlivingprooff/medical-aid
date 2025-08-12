import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

type Props = { open: boolean; onOpenChange: (v: boolean) => void; onSuccess?: () => void }

export function AddProviderModal({ open, onOpenChange, onSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Facility fields
  const [facilityName, setFacilityName] = useState('')
  const [facilityType, setFacilityType] = useState<'HOSPITAL'|'CLINIC'|'PHARMACY'|'LAB'|'IMAGING'|''>('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/accounts/register/', {
        username,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role: 'PROVIDER',
        facility_name: facilityName,
        facility_type: facilityType || undefined,
        phone,
        address,
        city,
      })
  onOpenChange(false)
  onSuccess?.()
      setUsername(''); setEmail(''); setPassword(''); setFirstName(''); setLastName('');
      setFacilityName(''); setFacilityType(''); setPhone(''); setAddress(''); setCity('')
    } catch (e: any) {
      setError(e.message || 'Failed to add provider')
    } finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Add Provider</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
            <div className="pt-2 text-sm font-medium">Facility details</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>Facility name</Label><Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} placeholder="e.g. CityCare Clinic" /></div>
              <div className="space-y-2">
                <Label>Facility type</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={facilityType} onChange={(e) => setFacilityType(e.target.value as any)}>
                  <option value="">Select type…</option>
                  <option value="HOSPITAL">Hospital</option>
                  <option value="CLINIC">Clinic</option>
                  <option value="PHARMACY">Pharmacy</option>
                  <option value="LAB">Laboratory</option>
                  <option value="IMAGING">Imaging Center</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +265…" /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area" /></div>
              <div className="space-y-2"><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City/town" /></div>
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Provider'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
