import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Check, 
  X, 
  Search, 
  MoreVertical, 
  Eye,
  FileText,
  AlertCircle
} from 'lucide-react'
import { api } from '@/lib/api'
import type { Claim } from '@/types/models'
import { PartialApprovalModal } from '../modals/partial-approval-modal'

interface ClaimActionsMenuProps {
  claim: Claim
  userRole: string
  userId: number
  onClaimUpdate: (updatedClaim: Claim) => void
  onViewDetails?: (claim: Claim) => void
}

// Simple toast function until we have a proper toast system
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toast = document.createElement('div')
  toast.className = `fixed top-4 right-4 z-50 p-4 rounded-md text-white ${
    type === 'success' ? 'bg-green-600' : 
    type === 'error' ? 'bg-red-600' : 
    'bg-blue-600'
  }`
  toast.textContent = message
  document.body.appendChild(toast)
  
  setTimeout(() => {
    if (document.body.contains(toast)) {
      document.body.removeChild(toast)
    }
  }, 3000)
}

export function ClaimActionsMenu({ claim, userRole, userId, onClaimUpdate, onViewDetails }: ClaimActionsMenuProps) {
  const [loading, setLoading] = useState(false)
  const [showPartialModal, setShowPartialModal] = useState(false)

  // Determine if user can perform actions on this claim
  const canManageClaim = () => {
    if (userRole === 'ADMIN') return true
    if (userRole === 'PROVIDER' && claim.provider === userId) return true
    return false
  }

  // Determine available actions based on claim status and user role
  const getAvailableActions = () => {
    const actions = []
    
    // View action - available to all
    actions.push({
      key: 'view',
      label: 'View Details',
      icon: Eye,
      action: () => handleViewClaim()
    })

    if (!canManageClaim()) {
      return actions
    }

    const status = claim.status

    // Approve action
    if (['PENDING', 'INVESTIGATING', 'REQUIRES_PREAUTH'].includes(status)) {
      actions.push({
        key: 'approve',
        label: 'Approve Claim',
        icon: Check,
        variant: 'success' as const,
        action: () => handleApproveClaim()
      })
    }

    // Admin-only: Approve up to coverage limit
    if (userRole === 'ADMIN' && ['PENDING', 'INVESTIGATING', 'REQUIRES_PREAUTH'].includes(status)) {
      actions.push({
        key: 'approve_limit',
        label: 'Approve up to coverage limit',
        icon: Check,
        variant: 'success' as const,
        action: () => setShowPartialModal(true)
      })
    }

    // Reject action
    if (['PENDING', 'INVESTIGATING', 'REQUIRES_PREAUTH'].includes(status)) {
      actions.push({
        key: 'reject',
        label: 'Reject Claim',
        icon: X,
        variant: 'destructive' as const,
        action: () => handleRejectClaim()
      })
    }

    // Investigate action
    if (['PENDING', 'REQUIRES_PREAUTH'].includes(status)) {
      actions.push({
        key: 'investigate',
        label: 'Mark for Investigation',
        icon: Search,
        variant: 'warning' as const,
        action: () => handleInvestigateClaim()
      })
    }

    // Re-process action for admins
    if (userRole === 'ADMIN' && status === 'REJECTED') {
      actions.push({
        key: 'reprocess',
        label: 'Re-process Claim',
        icon: AlertCircle,
        action: () => handleReprocessClaim()
      })
    }

    return actions
  }

  const handleViewClaim = () => {
    if (onViewDetails) return onViewDetails(claim)
    // Fallback toast for legacy usage
    showToast(`View claim #${claim.id} details`, 'info')
  }

  const handleApproveClaim = async () => {
    if (!confirm(`Are you sure you want to approve claim #${claim.id}?`)) {
      return
    }

    setLoading(true)
    try {
      const response = await api.post(`/api/claims/${claim.id}/approve/`)
      const data = response as { detail?: string; claim: Claim }
      showToast(data.detail || 'Claim approved successfully', 'success')
      onClaimUpdate(data.claim)
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to approve claim'
      showToast(message, 'error')

      // Show additional details if available
      if (error.response?.data?.reason) {
        showToast(`Reason: ${error.response.data.reason}`, 'error')
      }
      if (error.response?.data?.validation_details) {
        const details = error.response.data.validation_details
        if (typeof details === 'string') {
          showToast(`Details: ${details}`, 'error')
        } else if (Array.isArray(details)) {
          showToast(`Details: ${details.join('; ')}`, 'error')
        } else if (typeof details === 'object') {
          showToast(`Details: ${Object.values(details).join('; ')}`, 'error')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRejectClaim = async () => {
    const reason = prompt(`Please provide a reason for rejecting claim #${claim.id}:`)
    if (!reason || reason.trim() === '') {
      showToast('Rejection reason is required', 'error')
      return
    }

    setLoading(true)
    try {
      const response = await api.post(`/api/claims/${claim.id}/reject/`, {
        reason: reason.trim()
      })
      const data = response as { detail?: string; claim: Claim }
      showToast(data.detail || 'Claim rejected successfully', 'success')
      onClaimUpdate(data.claim)
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to reject claim'
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleInvestigateClaim = async () => {
    const notes = prompt(`Add investigation notes for claim #${claim.id} (optional):`)
    
    setLoading(true)
    try {
      const response = await api.post(`/api/claims/${claim.id}/investigate/`, {
        notes: notes?.trim() || 'Under investigation'
      })
      const data = response as { detail?: string; claim: Claim }
      showToast(data.detail || 'Claim marked for investigation', 'success')
      onClaimUpdate(data.claim)
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to mark claim for investigation'
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleReprocessClaim = async () => {
    if (!confirm(`Are you sure you want to reprocess claim #${claim.id}? This will reset it to PENDING status.`)) {
      return
    }

    setLoading(true)
    try {
      const response = await api.patch(`/api/claims/${claim.id}/`, {
        status: 'PENDING',
        rejection_reason: '',
        rejection_date: null
      })
      const data = response as Claim
      showToast('Claim marked for reprocessing', 'success')
      onClaimUpdate(data)
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to reprocess claim'
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const actions = getAvailableActions()

  if (actions.length === 0) {
    return null
  }

  // PROVIDERS should not have access to the actions menu at all
  if (userRole === 'PROVIDER') {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="h-8 w-8 p-0" 
            disabled={loading}
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {actions.map((action, index) => {
            const Icon = action.icon
            const isDestructive = action.variant === 'destructive'
            const isSuccess = action.variant === 'success'
            const isWarning = action.variant === 'warning'
            
            return (
              <>
                <DropdownMenuItem
                  key={action.key}
                  onClick={action.action}
                  disabled={loading}
                  className={
                    isDestructive ? 'text-destructive focus:text-destructive' :
                    isSuccess ? 'text-green-600 focus:text-green-600' :
                    isWarning ? 'text-yellow-600 focus:text-yellow-600' :
                    ''
                  }
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {action.label}
                </DropdownMenuItem>
                {index === 0 && actions.length > 1 && (
                  <DropdownMenuSeparator key={`separator-${index}`} />
                )}
              </>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {showPartialModal && userRole === 'ADMIN' && (
        <PartialApprovalModal 
          claim={claim}
          onClose={() => setShowPartialModal(false)}
          onApproved={(updated: Claim) => { 
            setShowPartialModal(false); 
            onClaimUpdate(updated) 
          }}
        />
      )}
    </>
  )
}
