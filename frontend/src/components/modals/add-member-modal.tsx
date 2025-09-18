import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, API_URL, subscriptionApi } from '@/lib/api'
import { X, Star, Check, Info } from 'lucide-react'
import { Upload } from 'lucide-react'
import type { SubscriptionTier } from '@/types/models'
import { formatCurrency } from '@/lib/currency'
import { SubscriptionTierSelector } from '@/components/subscriptions/subscription-tier-selector'

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
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([])
  const [selectedTier, setSelectedTier] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [document, setDocument] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!open) return
    api.get<{ id: number; name: string }[]>('/api/schemes/categories/')
      .then((resp: any) => setSchemes(resp.results ?? resp))
      .catch(() => setSchemes([]))
  }, [open])

  useEffect(() => {
    if (!scheme) {
      setSubscriptionTiers([])
      setSelectedTier('')
      return
    }
    
    subscriptionApi.getSubscriptionTiers({ scheme: Number(scheme), is_active: true })
      .then((resp) => {
        setSubscriptionTiers(resp.results)
        // Auto-select the first (lowest) tier as default
        if (resp.results.length > 0) {
          setSelectedTier(resp.results[0].id)
        }
      })
      .catch(() => setSubscriptionTiers([]))
  }, [scheme])

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
      const patient = await api.post<any>('/api/patients/', {
        user: user.id,
        date_of_birth: dateOfBirth,
        gender,
        scheme,
        diagnoses: '', investigations: '', treatments: '',
      })

      // Create subscription if a tier was selected
      if (selectedTier) {
        await subscriptionApi.createMemberSubscription({
          patient_id: patient.id,
          tier_id: Number(selectedTier),
          subscription_type: 'MONTHLY', // Default to monthly
          start_date: new Date().toISOString().split('T')[0]
        })
      }

      // If a document was selected, upload it to this patient's documents endpoint
      if (document) {
        const formData = new FormData()
        formData.append('document', document)
        await fetch(`${API_URL.replace(/\/$/, '')}/api/patients/${patient.id}/documents/`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers: { ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) },
        })
      }
      onOpenChange(false)
      setUsername(''); setEmail(''); setFirstName(''); setLastName(''); setPassword(''); setDateOfBirth(''); setGender(''); setScheme(''); setSelectedTier(''); setSelectedTier('')
    } catch (err: any) {
      setError(err.message || 'Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  async function handleDocumentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return
    setUploading(true)
    setError(null)
    try {
      // Keep file for later upload after patient is created
      setDocument(e.target.files[0])
    } catch (err: any) {
      setError('Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  if (!open) return null
  return (
    <div 
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={() => onOpenChange(false)}
    >
      <Card 
        className="w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Add Member</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
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

            {scheme && (
              <SubscriptionTierSelector
                schemeId={Number(scheme)}
                selectedTierId={selectedTier ? Number(selectedTier) : undefined}
                onTierSelect={(tierId) => setSelectedTier(tierId)}
              />
            )}
            <div>
              <Label>Verification Document</Label>
              <div className="flex gap-2 items-center">
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocumentUpload} disabled={uploading} />
                {document && <span className="text-xs text-success">{document.name}</span>}
                {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-xs text-muted-foreground">Upload ID, proof of address, or medical aid card</div>
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
