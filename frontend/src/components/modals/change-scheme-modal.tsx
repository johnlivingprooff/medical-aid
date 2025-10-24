import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { X, ArrowRight, AlertTriangle } from 'lucide-react'
import type { SchemeCategory, Patient } from '@/types/models'
import { formatCurrency } from '@/lib/currency'
import { formatFullName } from '@/lib/format-name'

type Props = { 
  open: boolean; 
  onOpenChange: (v: boolean) => void;
  member: Patient | null;
  onSuccess?: () => void;
}

export function ChangeSchemeModal({ open, onOpenChange, member, onSuccess }: Props) {
  const [schemes, setSchemes] = useState<SchemeCategory[]>([])
  const [selectedScheme, setSelectedScheme] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingSchemes, setLoadingSchemes] = useState(false)

  // Load available schemes when modal opens
  useEffect(() => {
    if (open && schemes.length === 0) {
      setLoadingSchemes(true)
      api.get<any>('/api/schemes/categories/')
        .then((resp) => {
          const results = resp.results ?? resp
          // Only show active schemes and exclude current scheme
          const activeSchemes = results.filter((s: SchemeCategory) => 
            s.is_active && s.id !== member?.scheme
          )
          setSchemes(activeSchemes)
        })
        .catch((e) => setError(e.message || 'Failed to load schemes'))
        .finally(() => setLoadingSchemes(false))
    }
  }, [open, member?.scheme])

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedScheme('')
      setError(null)
    }
  }, [open])

  async function handleSchemeChange(e: React.FormEvent) {
    e.preventDefault()
    if (!member || !selectedScheme) return

    setError(null)
    setLoading(true)

    try {
      // Update the member's scheme
      await api.patch(`/api/patients/${member.id}/`, {
        scheme: Number(selectedScheme)
      })

      onSuccess?.()
      onOpenChange(false)
    } catch (e: any) {
      setError(e.message || 'Failed to change scheme')
    } finally {
      setLoading(false)
    }
  }

  const selectedSchemeData = schemes.find(s => s.id === Number(selectedScheme))
  const currentSchemeData = schemes.find(s => s.id === member?.scheme) || {
    id: member?.scheme || 0,
    name: member?.scheme_name || 'Unknown Scheme',
    description: '',
    price: 0,
    is_active: true
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Change Member Scheme</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Member Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-medium">Member Information</h3>
            <div className="mt-2 space-y-1">
              <p className="text-sm">
                <span className="font-medium">Name:</span> {formatFullName(member?.user_first_name, member?.user_last_name)}
              </p>
              <p className="text-sm">
                <span className="font-medium">Member ID:</span> {member?.member_id}
              </p>
              <p className="text-sm">
                <span className="font-medium">Current Scheme:</span> {member?.scheme_name}
              </p>
            </div>
          </div>

          {/* Current vs New Scheme Comparison */}
          {selectedSchemeData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Current Scheme</Label>
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{currentSchemeData.name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentSchemeData.description || 'No description available'}
                  </p>
                  <div className="mt-2">
                    <span className="text-sm font-medium">
                      {formatCurrency(currentSchemeData.price)}/month
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">New Scheme</Label>
                <div className="border-2 border-primary rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{selectedSchemeData.name}</h4>
                    <Badge variant="info">Selected</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedSchemeData.description}
                  </p>
                  <div className="mt-2">
                    <span className="text-sm font-medium">
                      {formatCurrency(selectedSchemeData.price)}/month
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scheme Selection */}
          <form onSubmit={handleSchemeChange} className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="scheme">Select New Scheme</Label>
              {loadingSchemes ? (
                <div className="text-sm text-muted-foreground">Loading available schemes...</div>
              ) : (
                <div className="grid gap-3">
                  {schemes.map((scheme) => (
                    <label
                      key={scheme.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedScheme === scheme.id ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="scheme"
                          value={scheme.id}
                          checked={selectedScheme === scheme.id}
                          onChange={(e) => setSelectedScheme(Number(e.target.value))}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{scheme.name}</h4>
                            <span className="text-sm font-medium">
                              {formatCurrency(scheme.price)}/month
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {scheme.description}
                          </p>
                          {scheme.subscription_tiers && scheme.subscription_tiers.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs text-muted-foreground">
                                {scheme.subscription_tiers.length} subscription tier{scheme.subscription_tiers.length > 1 ? 's' : ''} available
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Warning about scheme change */}
            {selectedScheme && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Important Notice</p>
                  <p className="text-amber-700 mt-1">
                    Changing the scheme will affect the member's benefits, coverage limits, and subscription tiers. 
                    This change will take effect immediately and may impact current claims processing.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!selectedScheme || loading}
                className="flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Changing Scheme...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    <span>Change Scheme</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}