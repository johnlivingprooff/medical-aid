import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

type Props = { open: boolean; onOpenChange: (v: boolean) => void }

export function AddMemberModal({ open, onOpenChange }: Props) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<'M' | 'F' | 'O' | ''>('')
  const [scheme, setScheme] = useState<number | ''>('')
  const [schemes, setSchemes] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    api.get<{ id: number; name: string }[]>('/api/schemes/categories/')
      .then((resp: any) => setSchemes(resp.results ?? resp))
      .catch(() => setSchemes([]))
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Create the user account directly via register endpoint with PATIENT role
      const user = await api.post<any>('/api/accounts/register/', {
        username,
        email,
        first_name: firstName,
        last_name: lastName,
        role: 'PATIENT',
        password: password || Math.random().toString(36).slice(2, 10) + '!aA1',
      }, { noAuth: true })
      // Create patient profile
      await api.post('/api/patients/', {
        user: user.id,
        date_of_birth: dateOfBirth,
        gender,
        scheme,
        diagnoses: '', investigations: '', treatments: '',
      })
      onOpenChange(false)
      setUsername(''); setEmail(''); setFirstName(''); setLastName(''); setPassword(''); setDateOfBirth(''); setGender(''); setScheme('')
    } catch (err: any) {
      setError(err.message || 'Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader><CardTitle>Add Member</CardTitle></CardHeader>
        <CardContent className="max-h-[70vh] overflow-y-auto">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Auto-generated if empty" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select id="gender" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={gender} onChange={(e) => setGender(e.target.value as any)} required>
                  <option value="" disabled>Select…</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheme">Scheme</Label>
              <select id="scheme" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={scheme} onChange={(e) => setScheme(Number(e.target.value))} required>
                <option value="" disabled>Select…</option>
                {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Add Member'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
