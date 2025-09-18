import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { X } from 'lucide-react'
import type { SchemeCategory, BenefitType, SchemeBenefit } from '@/types/models'

type Props = { open: boolean; onOpenChange: (v: boolean) => void; schemeId?: number }

export function ManageSchemesModal({ open, onOpenChange, schemeId }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentScheme, setCurrentScheme] = useState<SchemeCategory | null>(null)
  const [benefits, setBenefits] = useState<SchemeBenefit[]>([])

  const [benefitTypes, setBenefitTypes] = useState<BenefitType[]>([])
  const [benefitType, setBenefitType] = useState<number | ''>('')
  const [newTypeName, setNewTypeName] = useState('')
  const [coverageAmount, setCoverageAmount] = useState('')
  const [coverageLimitCount, setCoverageLimitCount] = useState('')
  const [coveragePeriod, setCoveragePeriod] = useState('YEARLY')
  const [savingBenefit, setSavingBenefit] = useState(false)
  const [benefitError, setBenefitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // reset state when opened
    setName('')
    setDescription('')
    setCurrentScheme(null)
    setBenefits([])
    setBenefitType('')
    setNewTypeName('')
    setCoverageAmount('')
    setCoverageLimitCount('')
    setCoveragePeriod('YEARLY')
    setError(null)
    setBenefitError(null)
    // load benefit types
    api.get<BenefitType[]>('/api/schemes/benefit-types/')
      .then((resp: any) => setBenefitTypes(resp.results ?? resp))
      .catch(() => setBenefitTypes([]))

    // if a schemeId is provided, pre-load that scheme and its benefits
    if (schemeId) {
      api.get<any>(`/api/schemes/categories/${schemeId}/`)
        .then((data) => {
          setCurrentScheme(data as SchemeCategory)
          setName(data.name ?? '')
          setDescription(data.description ?? '')
          setBenefits((data.benefits ?? []) as SchemeBenefit[])
        })
        .catch((e: any) => setError(e.message || 'Failed to load scheme'))
    }
  }, [open, schemeId])

  async function addScheme(e: React.FormEvent) {
    e.preventDefault()
    if (currentScheme) return
    setCreating(true)
    setError(null)
    try {
      const created = await api.post<SchemeCategory>('/api/schemes/categories/', { name, description })
      setCurrentScheme(created)
    } catch (e: any) {
      setError(e.message || 'Failed to add scheme')
    } finally { setCreating(false) }
  }

  async function ensureBenefitType(): Promise<number> {
    if (benefitType) return benefitType as number
    if (!newTypeName.trim()) throw new Error('Select a benefit type or enter a new one')
    const created = await api.post<BenefitType>('/api/schemes/benefit-types/', { name: newTypeName.trim() })
    // update list and select it
    setBenefitTypes([created, ...benefitTypes])
    setNewTypeName('')
    setBenefitType(created.id)
    return created.id
  }

  async function addBenefit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentScheme) return
    setSavingBenefit(true)
    setBenefitError(null)
    try {
      const btId = await ensureBenefitType()
      await api.post('/api/schemes/benefits/', {
        scheme: currentScheme.id,
        benefit_type: btId,
        coverage_amount: coverageAmount ? Number(coverageAmount) : null,
        coverage_limit_count: coverageLimitCount ? Number(coverageLimitCount) : 1,
        coverage_period: coveragePeriod,
      })
      // refresh scheme to get benefits list
      const fresh = await api.get<any>(`/api/schemes/categories/${currentScheme.id}/`)
      setBenefits((fresh.benefits ?? []) as SchemeBenefit[])
      // reset fields for next add
      setBenefitType('')
      setCoverageAmount('')
      setCoverageLimitCount('')
      setCoveragePeriod('YEARLY')
    } catch (e: any) {
      setBenefitError(e.message || 'Failed to add benefit')
    } finally { setSavingBenefit(false) }
  }

  if (!open) return null
  return (
    <div 
      className="fixed inset-0 z-50 grid p-4 place-items-center bg-black/40"
      onClick={() => onOpenChange(false)}
    >
      <Card 
        className="w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Manage Schemes</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-y-auto space-y-6">
          <form onSubmit={addScheme} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="name">Scheme Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={!!currentScheme} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="desc">Description</Label>
              <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!!currentScheme} />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
              {!currentScheme && (
                <Button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create Scheme'}</Button>
              )}
            </div>
            {error && <div className="text-sm sm:col-span-3 text-destructive">{error}</div>}
          </form>

          {currentScheme && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">Adding benefits to <span className="font-medium text-foreground">{currentScheme.name}</span></div>

              <form onSubmit={addBenefit} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <div className="space-y-1">
                  <Label>Benefit</Label>
                    
                  <select
                    className="w-full px-3 text-sm border rounded-md h-9 bg-background"
                    value={benefitType === '' ? (newTypeName ? 'new' : '') : benefitType}
                    onChange={(e) => {
                      if (e.target.value === 'new') {
                        setBenefitType('');
                      } else {
                        setBenefitType(e.target.value ? Number(e.target.value) : '');
                        setNewTypeName('');
                      }
                    }}
                  >
                    <option value="">Select benefit type…</option>
                    {benefitTypes.map((bt) => (
                      <option key={bt.id} value={bt.id}>
                        {bt.name}
                      </option>
                    ))}
                    <option value="new">+ Add new benefit type…</option>
                  </select>
                  {benefitType === '' && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="relative">
                        <Input
                          placeholder="Enter new type name"
                          value={newTypeName}
                          onChange={(e) => setNewTypeName(e.target.value)}
                          style={{
                            width: `${Math.max(12, newTypeName.length * 0.75 + 2)}ch`,
                            minWidth: '12ch',
                            maxWidth: '100%',
                            transition: 'width 0.2s',
                          }}
                        />
                        {/* Hidden span for accurate width calculation */}
                        <span
                          style={{
                            position: 'absolute',
                            visibility: 'hidden',
                            whiteSpace: 'pre',
                            fontSize: 'inherit',
                            fontFamily: 'inherit',
                            padding: 0,
                            margin: 0,
                          }}
                          aria-hidden="true"
                        >
                          {newTypeName || 'Enter new type name'}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await ensureBenefitType();
                          } catch (e) {}
                        }}
                        disabled={!newTypeName.trim()}
                      >
                        Add Benefit Type
                      </Button>
                    </div>
                  )}


                </div>
                <div className="space-y-1">
                  <Label>Amount (MWK)</Label>
                  <Input value={coverageAmount} onChange={(e) => setCoverageAmount(e.target.value)} placeholder="e.g. 500000" />
                </div>
                <div className="space-y-1">
                  <Label>Limit count</Label>
                  <Input value={coverageLimitCount} onChange={(e) => setCoverageLimitCount(e.target.value)} placeholder="e.g. 12 (default: 1)" />
                </div>
                <div className="space-y-1">
                  <Label>Period</Label>
                  <select className="w-full px-3 text-sm border rounded-md h-9 bg-background" value={coveragePeriod} onChange={(e) => setCoveragePeriod(e.target.value)}>
                    <option value="PER_VISIT">Per Visit</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div className="flex items-end justify-end gap-2">
                  <Button type="submit" disabled={savingBenefit}>{savingBenefit ? 'Adding…' : 'Add Benefit'}</Button>
                </div>
                {benefitError && <div className="text-sm sm:col-span-5 text-destructive">{benefitError}</div>}
              </form>

              {benefits.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Benefits added</div>
                  <div className="grid grid-cols-1 gap-2">
                    {benefits.map(b => (
                      <div key={b.id} className="flex items-center justify-between p-2 text-sm border rounded">
                        <div>
                          <div className="font-medium">{b.benefit_type_detail?.name}</div>
                          <div className="text-xs text-muted-foreground">{b.coverage_period} • {b.coverage_limit_count ?? 'No count limit'} • {b.coverage_amount != null ? `${b.coverage_amount} MWK` : 'No amount limit'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
