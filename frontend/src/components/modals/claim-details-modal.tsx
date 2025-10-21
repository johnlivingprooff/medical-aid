import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Claim } from '@/types/models'
import { formatCurrency } from '@/lib/currency'

interface ClaimDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  claim: Claim | null
}

export function ClaimDetailsModal({ open, onOpenChange, claim }: ClaimDetailsModalProps) {
  if (!open || !claim) return null

  return (
    <div className="fixed inset-0 z-50 grid p-4 place-items-center bg-black/40">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Claim #{claim.id} Details</CardTitle>
          <CardDescription>
            Detailed information for claim submitted on {new Date(claim.date_submitted).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="text-sm">
              <div className="font-medium">Member</div>
              <div className="text-muted-foreground">{claim.patient_detail?.user_username} ({claim.patient_detail?.member_id})</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Provider</div>
              <div className="text-muted-foreground">{claim.provider_username || `#${claim.provider}`}</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Service</div>
              <div className="text-muted-foreground">{claim.service_type_name}</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Amount</div>
              <div className="text-muted-foreground">{formatCurrency(claim.cost)}</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Date of Service</div>
              <div className="text-muted-foreground">{new Date(claim.date_of_service).toLocaleDateString()}</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Status</div>
              <div className="mt-1">
                <Badge variant={
                  claim.status === 'APPROVED' ? 'success' :
                  claim.status === 'PENDING' ? 'warning' :
                  claim.status === 'REJECTED' ? 'destructive' : 'outline'
                }>
                  {claim.status}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="text-sm">
              <div className="font-medium">Diagnosis Code</div>
              <div className="text-muted-foreground">{claim.diagnosis_code || '-'}</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Procedure Code</div>
              <div className="text-muted-foreground">{claim.procedure_code || '-'}</div>
            </div>
          </div>

          {claim.notes && (
            <div className="text-sm">
              <div className="font-medium">Notes</div>
              <div className="text-muted-foreground whitespace-pre-wrap">{claim.notes}</div>
            </div>
          )}

          {(claim.preauth_number || claim.preauth_expiry) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="text-sm">
                <div className="font-medium">Pre-authorization Number</div>
                <div className="text-muted-foreground">{claim.preauth_number || '-'}</div>
              </div>
              <div className="text-sm">
                <div className="font-medium">Pre-authorization Expiry</div>
                <div className="text-muted-foreground">{claim.preauth_expiry ? new Date(claim.preauth_expiry).toLocaleDateString() : '-'}</div>
              </div>
            </div>
          )}

          {claim.rejection_reason && (
            <div className="text-sm">
              <div className="font-medium">Rejection Reason</div>
              <div className="text-destructive">{claim.rejection_reason}</div>
              {claim.rejection_date && (
                <div className="text-xs text-muted-foreground mt-1">Rejected on {new Date(claim.rejection_date).toLocaleDateString()}</div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ClaimDetailsModal
