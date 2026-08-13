/* ---------------------------------------------------------------------------
   Sub Admin — Seller verification (KYC).

   A buyer applying to sell is the one customer action on the whole platform
   that had no working approver: four screens offered the buttons and none of
   them wrote a decision. This is where it is decided.

   Held jointly with the Operation Manager, who also hears the appeal — so a
   rejection is never a dead end. Every rejection carries a typed reason, and
   the seller is shown it word for word, because "resubmit" without saying what
   was wrong just produces the same documents again.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, FileText, ShieldCheck, ShieldX } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Segmented, Stat, Textarea,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { User } from '../../types'

type Tab = 'pending' | 'verified' | 'rejected'

/** What a seller is asked to send again, worded the way the seller will read
 *  it. Typed reasons beat free text for the common cases and the box below
 *  still takes anything else. */
const REJECTION_REASONS = [
  'GSTIN does not match the firm name on the documents',
  'GST certificate is expired',
  'Cancelled cheque is illegible',
  'PAN and GSTIN are registered to different entities',
  'Yard address could not be confirmed',
]

const DOC_REQUESTS = [
  'GST registration certificate',
  'Cancelled cheque or bank letter',
  'PAN card',
  'Proof of the yard address',
  'Board resolution or authority letter',
]

export default function SellerVerification() {
  const now = useNow()
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const auditEvents = useStore((s) => s.auditEvents)
  const decideSellerKyc = useStore((s) => s.decideSellerKyc)
  const notify = useStore((s) => s.notify)
  const audit = useStore((s) => s.audit)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('pending')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<User | null>(null)
  const [mode, setMode] = useState<'decide' | 'reject' | 'docs'>('decide')
  const [reason, setReason] = useState(REJECTION_REASONS[0])
  const [note, setNote] = useState('')
  const [docs, setDocs] = useState<string[]>([])

  const pending = users.filter((u) => u.kycStatus === 'pending')
  const verified = users.filter((u) => u.kycStatus === 'verified')
  const rejected = users.filter((u) => u.kycStatus === 'rejected')

  const list = (tab === 'pending' ? pending : tab === 'verified' ? verified : rejected)
    .filter((u) => !q || `${u.name} ${u.firm} ${u.city} ${u.gstin} ${u.email}`.toLowerCase().includes(q.toLowerCase()))

  /** How long an applicant has been waiting. The oldest one is the point of
   *  this screen — a KYC that sits is a seller who lists somewhere else. */
  const waitingSince = (u: User) => {
    const ev = auditEvents.find((e) => e.action === 'kyc.submit' && e.target === u.firm)
    return ev?.at
  }

  /** What this seller already has on the platform — context for the decision,
   *  and the reason a rejection is not free. */
  const footprint = (u: User) => {
    const theirs = catalogues.filter((c) => c.sellerId === u.id)
    return {
      catalogues: theirs.length,
      lots: lots.filter((l) => theirs.some((c) => c.id === l.catalogueId)).length,
    }
  }

  const openFor = (u: User, m: 'decide' | 'reject' | 'docs' = 'decide') => {
    setOpen(u)
    setMode(m)
    setReason(REJECTION_REASONS[0])
    setNote('')
    setDocs([])
  }

  const approve = (u: User) => {
    const r = decideSellerKyc(u.id, true)
    if (!r.ok) { pushToast({ kind: 'danger', title: 'Not verified', body: r.error }); return }
    pushToast({ kind: 'success', title: `${u.firm} verified`, body: 'They can submit lots now. Nothing they submit is public until it is catalogued and published.' })
    setOpen(null)
  }

  const reject = () => {
    if (!open) return
    const full = [reason, note.trim()].filter(Boolean).join(' — ')
    const r = decideSellerKyc(open.id, false, full)
    if (!r.ok) { pushToast({ kind: 'danger', title: 'Not saved', body: r.error }); return }
    pushToast({ kind: 'warning', title: 'Rejected — the seller has been told what to resubmit', body: open.firm })
    setOpen(null)
  }

  const requestDocs = () => {
    if (!open || docs.length === 0) {
      pushToast({ kind: 'warning', title: 'Nothing requested', body: 'Tick what you need them to send.' })
      return
    }
    const body = `Please send: ${docs.join(', ')}.${note.trim() ? ` ${note.trim()}` : ''}`
    audit('kyc.docs_requested', open.firm, body)
    notify({ userId: open.id, kind: 'system', title: 'We need a document to finish your verification', body, href: '/buyer/kyc' })
    pushToast({ kind: 'info', title: 'Document request sent', body: `${open.firm} · ${docs.length} document${docs.length === 1 ? '' : 's'}` })
    setOpen(null)
  }

  return (
    <Page>
      <PageHeader
        title="Seller verification"
        sub="Buyers applying to sell. Approve, ask for a document, or reject with a reason they can act on — an appeal goes to the Operation Manager."
        actions={
          <Segmented<Tab>
            options={[
              { key: 'pending', label: `Waiting (${pending.length})` },
              { key: 'verified', label: 'Verified' },
              { key: 'rejected', label: 'Rejected' },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Waiting on us" value={num(pending.length)} tone={pending.length ? 'ember' : undefined} sub="24h SLA each" />
        <Stat label="Verified sellers" value={num(verified.length)} tone="steel" sub="May submit lots" />
        <Stat label="Rejected" value={num(rejected.length)} sub="May resubmit or appeal" />
        <Stat label="Selling today" value={num(catalogues.filter((c) => c.status === 'live').length)} sub="Live catalogues" to="/auction/live" />
      </div>

      <div className="card p-4 mb-4">
        <Field label="Search" className="max-w-sm">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firm, name, city or GSTIN…" />
        </Field>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={tab === 'pending' ? 'Nobody is waiting' : 'Nothing here'}
          body={tab === 'pending'
            ? 'Every seller who has applied has been decided. Applications arrive from the "Become a seller" screen.'
            : 'No accounts in this state match your search.'}
        />
      ) : (
        <div className="card overflow-hidden">
          <ul>
            {list.map((u) => {
              const since = waitingSince(u)
              const fp = footprint(u)
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 border-b border-line last:border-0">
                  <Avatar name={u.name} hue={u.avatarHue} size={38} />
                  <div className="flex-1 min-w-52">
                    <div className="font-semibold text-sm">{u.firm}</div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {u.name} · {u.city} · GSTIN <span className="num">{u.gstin}</span>
                    </div>
                    {fp.catalogues > 0 && (
                      <div className="text-xs text-ink-faint mt-0.5">
                        {num(fp.catalogues)} catalogue{fp.catalogues === 1 ? '' : 's'} · {num(fp.lots)} lots already on the platform
                      </div>
                    )}
                  </div>
                  {u.standing !== 'good' && (
                    <Chip tone={u.standing === 'watchlist' ? 'warning' : 'danger'}>{u.standing}</Chip>
                  )}
                  {tab === 'pending' && since && (
                    <Chip tone="neutral" className="num">waiting {relTime(since, now)}</Chip>
                  )}
                  {tab === 'verified' && <Chip tone="success"><BadgeCheck size={11} /> Verified</Chip>}
                  {tab === 'rejected' && <Chip tone="danger">Rejected</Chip>}

                  {tab === 'pending' ? (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openFor(u, 'docs')}>
                        <FileText size={13} /> Ask for a doc
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => openFor(u, 'reject')}>Reject</Button>
                      <Button variant="success" size="sm" onClick={() => approve(u)}>Verify</Button>
                    </div>
                  ) : tab === 'rejected' ? (
                    // The appeal. A rejection is a finding, not a ban — and it
                    // is the Operation Manager who hears the case, not the
                    // person who rejected it.
                    <Button variant="secondary" size="sm" onClick={() => approve(u)}>
                      <ShieldCheck size={13} /> Verify on appeal
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => openFor(u, 'reject')}>
                      <ShieldX size={13} /> Withdraw
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
            Held jointly with the Operation Manager, who also hears an appeal. Whoever acts is named on the{' '}
            <Link to="/sub/activity" className="font-semibold text-ember hover:underline">record</Link>.
          </div>
        </div>
      )}

      {/* ------------------------------ reject ------------------------------- */}
      <Modal open={!!open && mode === 'reject'} onClose={() => setOpen(null)} title={`Reject — ${open?.firm ?? ''}`}>
        {open && (
          <div className="space-y-4">
            <div className="card bg-surface-2 p-3.5 text-sm text-ink-muted">
              The seller is shown this word for word, so write it as something they can act on. They may resubmit,
              and may appeal to the Operation Manager.
            </div>
            <Field label="Reason">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {REJECTION_REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-line-strong text-ink-muted hover:text-ink hover:bg-surface-2">
                  {r}
                </button>
              ))}
            </div>
            <Field label="Anything else" hint="Optional — added after the reason.">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. the GSTIN on the cheque belongs to a different firm…" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
              <Button variant="danger" onClick={reject}>Reject and tell them</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* --------------------------- request documents ----------------------- */}
      <Modal open={!!open && mode === 'docs'} onClose={() => setOpen(null)} title={`Ask ${open?.firm ?? ''} for a document`}>
        {open && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              The application stays open and the SLA keeps running — this asks for what is missing rather than
              rejecting over it.
            </p>
            <div className="space-y-2">
              {DOC_REQUESTS.map((d) => (
                <label key={d} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--ember)]"
                    checked={docs.includes(d)}
                    onChange={(e) => setDocs((prev) => (e.target.checked ? [...prev, d] : prev.filter((x) => x !== d)))}
                  />
                  {d}
                </label>
              ))}
            </div>
            <Field label="Note" hint="Optional.">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. the copy you sent is cut off at the bottom…" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={requestDocs}>Send the request</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------------------- the applicant --------------------------- */}
      <Modal open={!!open && mode === 'decide'} onClose={() => setOpen(null)} title={open?.firm ?? ''}>
        {open && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['GSTIN', open.gstin],
                ['City', open.city],
                ['Phone', open.phone],
                ['Registered', fmtDate(open.joinedAt ?? new Date().toISOString())],
              ].map(([k, v]) => (
                <div key={k} className="card bg-surface-2 p-3">
                  <div className="text-xs text-ink-faint uppercase tracking-wider font-semibold">{k}</div>
                  <div className="num font-semibold mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setMode('reject')}>Reject</Button>
              <Button variant="success" onClick={() => approve(open)}>Verify</Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
