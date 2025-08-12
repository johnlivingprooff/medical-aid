import { Button } from '@/components/ui/button'
import { Plus, FileText, Send, Users, ClipboardList, Bell } from 'lucide-react'
import { useState } from 'react'
import { AddMemberModal } from '../modals/add-member-modal'
import { SubmitClaimModal } from '../modals/submit-claim-modal'
import { ManageSchemesModal } from '../modals/manage-schemes-modal'
import { useAuth } from '@/components/auth/auth-context'

export function QuickActions() {
  const { user } = useAuth()
  const role = user?.role || 'GUEST'
  const [showMember, setShowMember] = useState(false)
  const [showClaim, setShowClaim] = useState(false)
  const [showSchemes, setShowSchemes] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {role === 'ADMIN' && (
        <Button onClick={() => setShowMember(true)}><Plus className="w-4 h-4 mr-2" /> Add Member</Button>
      )}
      {(role === 'ADMIN' || role === 'PROVIDER') && (
        <Button variant="secondary" onClick={() => setShowClaim(true)}><ClipboardList className="w-4 h-4 mr-2" /> Submit Claim</Button>
      )}
      {role === 'ADMIN' && (
        <Button variant="ghost" onClick={() => setShowSchemes(true)}><Users className="w-4 h-4 mr-2" /> Manage Schemes</Button>
      )}
      {/* <Button variant="secondary"><FileText className="w-4 h-4 mr-2" /> Generate Report</Button> */}
      {/* <Button variant="ghost"><Bell className="w-4 h-4 mr-2" /> Bulk Notifications</Button> */}
      {/* <Button variant="outline"><Send className="w-4 h-4 mr-2" /> Share</Button> */}
      <AddMemberModal open={showMember} onOpenChange={setShowMember} />
      <SubmitClaimModal open={showClaim} onOpenChange={setShowClaim} />
      <ManageSchemesModal open={showSchemes} onOpenChange={setShowSchemes} />
    </div>
  )
}
