/* ---------------------------------------------------------------------------
   EMD exemption request — the buyer-facing half of the "missed the EMD
   deadline" recovery flow. A buyer who missed the pre-bid EMD cut-off can ask
   a sub-admin to reopen funding for them instead of being locked out of the
   catalogue outright. One live request per catalogue at a time; a rejected
   request can be resubmitted. Sub-admin review UI is a separate piece of work.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { MessageSquareWarning } from 'lucide-react'
import { Button, Chip, Modal, Textarea } from './ui'
import { useStore, latestEmdExemptionRequest } from '../store/store'

export function EmdExemptionControl({ catalogueId, size = 'sm' }: { catalogueId: string; size?: 'sm' | 'md' }) {
  const me = useStore((s) => s.currentUser)
  const emdExemptionRequests = useStore((s) => s.emdExemptionRequests)
  const requestEmdExemption = useStore((s) => s.requestEmdExemption)
  const pushToast = useStore((s) => s.pushToast)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!me) return null
  const latest = latestEmdExemptionRequest({ emdExemptionRequests }, me.id, catalogueId)

  if (latest?.status === 'pending') {
    return <Chip tone="warning">Exemption requested — awaiting sub-admin approval</Chip>
  }
  if (latest?.status === 'approved') {
    return <Chip tone="success">Exemption approved — pay EMD to join</Chip>
  }

  const submit = () => {
    const res = requestEmdExemption(catalogueId, reason)
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Could not submit request', body: res.error })
      return
    }
    pushToast({ kind: 'success', title: 'Exemption request sent', body: 'A sub-admin will review it shortly.' })
    setReason('')
    setOpen(false)
  }

  // Clicks stay inside this control — it's often placed inside a card that's
  // itself a Link (the catalogue row), so bubbling would trigger navigation.
  return (
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <Button size={size} variant="steel" onClick={() => setOpen(true)}>
        <MessageSquareWarning size={14} /> Request EMD exemption{latest?.status === 'rejected' ? ' again' : ''}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Request EMD exemption">
        {latest?.status === 'rejected' && (
          <p className="text-xs text-danger font-semibold mb-3">
            Your last request was rejected{latest.rejectionReason ? `: ${latest.rejectionReason}` : '.'} You can submit a new one below.
          </p>
        )}
        <p className="text-sm text-ink-muted mb-3">
          You missed the pre-bid EMD deadline for this catalogue. Tell us why — if a sub-admin approves it,
          EMD funding reopens for you and you can join the auction.
        </p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for missing the EMD deadline..."
          rows={4}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!reason.trim()}>Send request</Button>
        </div>
      </Modal>
    </span>
  )
}
