import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  member: any | null
  onSave: (payload: { first_name?: string; last_name?: string; scheme?: number; status?: string }) => Promise<void>
}

export function EditMemberModal({ open, onOpenChange, member, onSave }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<'M' | 'F' | 'O' | ''>('')
  const [scheme, setScheme] = useState<number | ''>('')
  const [schemes, setSchemes] = useState<Array<{ id: number; name: string }>>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    api.get<{ id: number; name: string }[]>('/api/schemes/categories/')
      .then((resp: any) => setSchemes(resp.results ?? resp))
      .catch(() => setSchemes([]))
  }, [open])

  useEffect(() => {
    if (!open || !member) return
    setFirstName(member.first_name || '')
    setLastName(member.last_name || '')
    setStatus(member.status || 'ACTIVE')
    setDateOfBirth(member.date_of_birth ? String(member.date_of_birth).slice(0,10) : '')
    setGender((member.gender as any) || '')
    setScheme(member.scheme || '')
  }, [open, member])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
  await onSave({ first_name: firstName, last_name: lastName, status, scheme: scheme as number })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  if (!open || !member) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader><CardTitle>Edit Member</CardTitle></CardHeader>
        <CardContent className="max-h-[70vh] overflow-y-auto">
          <form onSubmit={submit} className="space-y-4">
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
              <Label htmlFor="status">Status</Label>
              <select id="status" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select id="gender" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={gender} onChange={(e) => setGender(e.target.value as any)}>
                  <option value="">Select…</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheme">Scheme</Label>
              <select id="scheme" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={scheme} onChange={(e) => setScheme(Number(e.target.value))}>
                <option value="">Select…</option>
                {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
