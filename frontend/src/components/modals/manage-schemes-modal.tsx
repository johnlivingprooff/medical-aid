import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { capitalizeFirst } from '@/lib/format-text'
import { X, Edit, Trash2, Plus } from 'lucide-react'
import type { SchemeCategory, BenefitType, SchemeBenefit } from '@/types/models'
import { EditBenefitModal } from './edit-benefit-modal'
import { AddBenefitModal } from './add-benefit-modal'

type Props = { open: boolean; onOpenChange: (v: boolean) => void; schemeId?: number }

export function ManageSchemesModal({ open, onOpenChange, schemeId }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentScheme, setCurrentScheme] = useState<SchemeCategory | null>(null)
  const [benefits, setBenefits] = useState<SchemeBenefit[]>([])

  // Modal states
  const [editBenefitModalOpen, setEditBenefitModalOpen] = useState(false)
  const [benefitToEdit, setBenefitToEdit] = useState<SchemeBenefit | null>(null)
  const [addBenefitModalOpen, setAddBenefitModalOpen] = useState(false)
  const [deletingBenefitId, setDeletingBenefitId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    // reset state when opened
    setName('')
    setDescription('')
    setCurrentScheme(null)
    setBenefits([])
    setError(null)

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

  async function refreshBenefits() {
    if (!currentScheme) return
    try {
      const fresh = await api.get<any>(`/api/schemes/categories/${currentScheme.id}/`)
      setBenefits((fresh.benefits ?? []) as SchemeBenefit[])
    } catch (e: any) {
      console.error('Failed to refresh benefits:', e)
    }
  }

  function handleEditBenefit(benefit: SchemeBenefit) {
    setBenefitToEdit(benefit)
    setEditBenefitModalOpen(true)
  }

  async function handleDeleteBenefit(benefitId: number) {
    if (!confirm('Are you sure you want to delete this benefit?')) return
    
    setDeletingBenefitId(benefitId)
    try {
      await api.delete(`/api/schemes/benefits/${benefitId}/`)
      await refreshBenefits()
    } catch (e: any) {
      console.error('Failed to delete benefit:', e)
    } finally {
      setDeletingBenefitId(null)
    }
  }

  function handleBenefitSaved() {
    refreshBenefits()
    setEditBenefitModalOpen(false)
    setBenefitToEdit(null)
  }

  function handleBenefitAdded() {
    refreshBenefits()
    setAddBenefitModalOpen(false)
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
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Managing benefits for <span className="font-medium text-foreground">{currentScheme.name}</span>
                </div>
                <Button
                  type="button"
                  onClick={() => setAddBenefitModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Benefit
                </Button>
              </div>

              {benefits.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Current Benefits</div>
                  <div className="grid grid-cols-1 gap-2">
                    {benefits.map(b => (
                      <div key={b.id} className="flex items-center justify-between p-2 text-sm border rounded">
                        <div className="flex-1">
                          <div className="font-medium">{capitalizeFirst(b.benefit_type_detail?.name)}</div>
                          <div className="text-xs text-muted-foreground">
                            {b.coverage_period} • {b.coverage_limit_count ?? 'No count limit'} • {b.coverage_amount != null ? `${b.coverage_amount} MWK` : 'No amount limit'}
                            {b.deductible_amount > 0 && ` • Deductible: ${b.deductible_amount} MWK`}
                            {b.copayment_percentage > 0 && ` • Copay: ${b.copayment_percentage}%`}
                            {b.requires_preauth && ' • Pre-auth required'}
                            {!b.is_active && ' • Inactive'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-muted"
                            onClick={() => handleEditBenefit(b)}
                            disabled={deletingBenefitId === b.id}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteBenefit(b.id)}
                            disabled={deletingBenefitId === b.id}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
      
      <EditBenefitModal
        open={editBenefitModalOpen}
        onOpenChange={setEditBenefitModalOpen}
        benefit={benefitToEdit}
        onSave={handleBenefitSaved}
      />
      
      <AddBenefitModal
        open={addBenefitModalOpen}
        onOpenChange={setAddBenefitModalOpen}
        scheme={currentScheme}
        onSave={handleBenefitAdded}
      />
    </div>
  )
}
