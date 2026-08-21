/* ---------------------------------------------------------------------------
   "You are viewing as X" — shown on every page while a Sub/Super Admin is
   signed into someone else's session (see Users.tsx's "Log in as" and
   store.ts's impersonateUser/endImpersonation).

   The one job this has: nobody impersonating an account should be able to
   forget it, mid-support-call, and take an action that reads back as that
   person's own. It sits above the header, the same permanent-fixture spot
   GuestGate's preview banner uses, for the same reason — it has to survive
   every navigation, not just the page it started on.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCog } from 'lucide-react'
import { Button } from './ui'
import { ROLE_HOME, ROLE_LABEL, useStore } from '../store/store'

export function ImpersonationBanner() {
  const impersonatedBy = useStore((s) => s.impersonatedBy)
  const currentUser = useStore((s) => s.currentUser)
  const endImpersonation = useStore((s) => s.endImpersonation)
  const pushToast = useStore((s) => s.pushToast)
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)

  if (!impersonatedBy) return null

  const exit = async () => {
    setBusy(true)
    try {
      const res = await endImpersonation()
      if (!res.ok) {
        pushToast({
          kind: 'danger', title: 'Could not return to your account',
          body: 'Sign in again — nothing was changed on the account you were viewing.',
        })
        nav('/login', { replace: true })
        return
      }
      pushToast({ kind: 'success', title: 'Back to your own account', body: impersonatedBy.name })
      nav(ROLE_HOME[impersonatedBy.role], { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-b border-warning/40 bg-warning-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-warning">
          <UserCog size={14} /> Viewing as {currentUser?.name ?? 'this account'}
        </span>
        <span className="text-[13px] text-ink-muted">
          Signed in by {impersonatedBy.name} ({ROLE_LABEL[impersonatedBy.role]}). Anything done here happens as this account.
        </span>
        <Button size="sm" variant="secondary" className="ml-auto" disabled={busy} loading={busy} onClick={() => void exit()}>
          Back to my account
        </Button>
      </div>
    </div>
  )
}
