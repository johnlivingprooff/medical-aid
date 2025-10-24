import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, API_URL, subscriptionApi } from '@/lib/api'
import { X, Users, Heart, Baby } from 'lucide-react'
import type { SubscriptionTier, Patient } from '@/types/models'
import { formatCurrency } from '@/lib/currency'
import { formatFullName } from '@/lib/format-name'
import { SubscriptionTierSelector } from '@/components/subscriptions/subscription-tier-selector'

type Props = { 
  open: boolean; 
  onOpenChange: (v: boolean) => void;
  principalMember: Patient | null;
  onSuccess?: () => void;
}

export function AddDependentModal({ open, onOpenChange, principalMember, onSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<'M' | 'F' | 'O' | ''>('')
  const [phone, setPhone] = useState('')
  const [relationship, setRelationship] = useState<'SPOUSE' | 'CHILD' | 'DEPENDENT' | ''>('')
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([])
  const [selectedTier, setSelectedTier] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !principalMember) return
    
    // Load subscription tiers for the principal member's scheme
    if (principalMember.scheme) {
      subscriptionApi.getSubscriptionTiers({ scheme: principalMember.scheme, is_active: true })
        .then((resp) => {
          setSubscriptionTiers(resp.results)
          // Auto-select the first (lowest) tier as default
          if (resp.results.length > 0) {
            setSelectedTier(resp.results[0].id)
          }
        })
        .catch(() => setSubscriptionTiers([]))
    }

    // Prefill last name with principal member's last name
    if (principalMember.last_name) {
      setLastName(principalMember.last_name)
    }
  }, [open, principalMember])

  // Auto-generate username from first and last name
  useEffect(() => {
    if (firstName && lastName) {
      const generatedUsername = `${firstName.toLowerCase().replace(/\s+/g, '')}_${lastName.toLowerCase().replace(/\s+/g, '')}`
      setUsername(generatedUsername)
    }
  }, [firstName, lastName])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    
    if (!principalMember) {
      setError('No principal member selected')
      setLoading(false)
      return
    }

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

      // Create patient profile as dependent of the principal member
      const dependent = await api.post<any>('/api/patients/', {
        user: user.id,
        date_of_birth: dateOfBirth,
        enrollment_date: principalMember.enrollment_date, // Use same enrollment date as principal
        benefit_year_start: principalMember.benefit_year_start, // Use same benefit year
        gender,
        scheme: principalMember.scheme, // Same scheme as principal member
        principal_member: principalMember.id, // Link to principal member
        relationship,
        phone,
        emergency_contact: principalMember.emergency_contact, // Use principal's emergency contact
        emergency_phone: principalMember.emergency_phone, // Use principal's emergency phone
        diagnoses: '', 
        investigations: '', 
        treatments: '',
      })

      // Create subscription if a tier was selected
      if (selectedTier) {
        await subscriptionApi.createMemberSubscription({
          patient_id: dependent.id,
          tier_id: Number(selectedTier),
          subscription_type: 'MONTHLY', // Default to monthly
          start_date: new Date().toISOString().split('T')[0]
        })
      }

      onOpenChange(false)
      onSuccess?.() // Call the success callback to refresh the parent
      // Reset form
      setUsername('')
      setEmail('')
      setFirstName('')
      setLastName('')
      setPassword('')
      setDateOfBirth('')
      setGender('')
      setPhone('')
      setRelationship('')
      setSelectedTier('')
      
    } catch (err: any) {
      setError(err.message || 'Failed to add dependent')
    } finally {
      setLoading(false)
    }
  }

  const getRelationshipIcon = (rel: string) => {
    switch (rel) {
      case 'SPOUSE': return <Heart className="w-4 h-4" />
      case 'CHILD': return <Baby className="w-4 h-4" />
      case 'DEPENDENT': return <Users className="w-4 h-4" />
      default: return <Users className="w-4 h-4" />
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
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Add Dependent
            </CardTitle>
            {principalMember && (
              <p className="text-sm text-muted-foreground mt-1">
                Adding dependent to {formatFullName(principalMember.user_first_name, principalMember.user_last_name)}'s account
              </p>
            )}
          </div>
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
            {/* Relationship Selection */}
            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship to Principal Member</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'SPOUSE', label: 'Spouse', icon: Heart },
                  { value: 'CHILD', label: 'Child', icon: Baby },
                  { value: 'DEPENDENT', label: 'Other', icon: Users }
                ].map((rel) => (
                  <button
                    key={rel.value}
                    type="button"
                    onClick={() => setRelationship(rel.value as any)}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      relationship === rel.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <rel.icon className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs font-medium">{rel.label}</div>
                  </button>
                ))}
              </div>
              {!relationship && (
                <p className="text-xs text-muted-foreground">Please select the relationship type</p>
              )}
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  required
                >
                  <option value="">Select gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input 
                id="phone" 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="+1234567890" 
              />
              <p className="text-xs text-muted-foreground">
                If not provided, will use principal member's emergency contact info
              </p>
            </div>

            {/* Subscription Tier Selection */}
            {subscriptionTiers.length > 0 && (
              <div className="space-y-2">
                <Label>Subscription Tier (Optional)</Label>
                <div className="space-y-2">
                  {subscriptionTiers.map((tier) => (
                    <div
                      key={tier.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTier === tier.id
                          ? 'border-primary bg-primary/10'
                          : 'border-muted hover:border-muted-foreground/20'
                      }`}
                      onClick={() => setSelectedTier(tier.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{tier.name}</div>
                          <div className="text-sm text-muted-foreground">{tier.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(tier.monthly_price)}/mo</div>
                          {tier.yearly_price && (
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(tier.yearly_price)}/yr
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Principal Member Info Display */}
            {principalMember && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium mb-1">Principal Member Details</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Scheme: {principalMember.scheme_name}</div>
                  <div>Member ID: {principalMember.member_id}</div>
                  <div>Emergency Contact: {principalMember.emergency_contact}</div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading || !relationship || !firstName || !lastName || !dateOfBirth || !gender}
              >
                {loading ? 'Adding...' : 'Add Dependent'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}