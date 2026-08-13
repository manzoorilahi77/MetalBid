/* ---------------------------------------------------------------------------
   Super Admin — Blacklist & defaulters.

   Barring someone from the marketplace is the sharpest thing this platform does
   to a customer, so the screen is built around the difference between the two
   ways of doing it. **Defaulter standing** is ours: reversible, applied with a
   typed reason, and it stops them bidding. **A permanent ban** closes the
   account for good — so a Sub Admin proposes it, we execute it, and the CEO
   signs it first. Nothing here deletes an account: the record of everything the
   account did stays readable either way.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, ShieldOff, Signature } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Avatar, Button, Chip, EmptyState, Field, Modal, PageHeader, Stat, Textarea } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, inr, inrCompact, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { User } from '../../types'

export default function Blacklist() {
  const now = useNow()
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)
  const ceoApprovals = useStore((s) => s.ceoApprovals)
  const setUserStanding = useStore((s) => s.setUserStanding)
  const setAccountStatus = useStore((s) => s.setAccountStatus)
  const requestCeoSignoff = useStore((s) => s.requestCeoSignoff)
  const pushToast = useStore((s) => s.pushToast)

  const [escalate, setEscalate] = useState<User | null>(null)
  const [banning, setBanning] = useState<User | null>(null)
  const [reason, setReason] = useState('')

  const defaulters = users.filter((u) => u.standing === 'defaulter' && u.accountStatus !== 'banned')
  const watchlist = users.filter((u) => u.standing === 'watchlist')
  const banned = users.filter((u) => u.accountStatus === 'banned')
  const forfeits = wallets.flatMap((w) => w.ledger.filter((e) => e.type === 'emd_forfeit'))
  const forfeited = forfeits.reduce((s, e) => s + Math.abs(e.amount), 0)

  /** A ban in flight, or one already signed and waiting to be executed here. */
  const banRequest = (userId: string) =>
    ceoApprovals.find((a) => a.kind === 'permanent_ban' && a.refId === userId && a.status !== 'refused')

  /** Exposure the ban would land on: EMD we are holding, and their balance. */
  const exposure = (userId: string) => {
    const w = wallets.find((x) => x.userId === userId)
    return { locked: w?.emdLocked ?? 0, balance: w?.balance ?? 0 }
  }

  return (
    <Page>
      <PageHeader title="Blacklist & defaulters" sub="Buyers barred or under watch for lifting defaults, payment failures or bid manipulation. Defaulter standing is ours; a permanent ban is signed by the CEO." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Defaulters (barred)" value={defaulters.length} tone="danger" />
        <Stat label="On watchlist" value={watchlist.length} tone="warning" />
        <Stat label="Permanently banned" value={banned.length} tone={banned.length ? 'danger' : undefined} sub="CEO signed" />
        <Stat label="EMD forfeited this FY" value={inrCompact(forfeited)} sub={`${forfeits.length} forfeiture${forfeits.length === 1 ? '' : 's'}`} />
      </div>

      <h2 className="text-lg font-bold mb-3">Defaulters</h2>
      {defaulters.length === 0 && <EmptyState title="No defaulters" />}
      <div className="space-y-3">
        {defaulters.map((u) => {
          const w = wallets.find((x) => x.userId === u.id)
          const uForfeits = w?.ledger.filter((e) => e.type === 'emd_forfeit') ?? []
          return (
            <div key={u.id} className="card border-danger/40 p-5">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar name={u.name} hue={u.avatarHue} size={44} />
                <div className="flex-1 min-w-64">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{u.firm}</span>
                    <Chip tone="danger"><ShieldOff size={11} /> Barred from bidding</Chip>
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">{u.name} · {u.city} · GSTIN <span className="num">{u.gstin}</span></div>
                  {u.blacklistReason && (
                    <blockquote className="mt-2 text-sm text-danger bg-danger-soft rounded-xl px-3.5 py-2 border-l-2 border-danger">
                      {u.blacklistReason}
                    </blockquote>
                  )}
                  {uForfeits.length > 0 && (
                    <div className="mt-2 text-xs text-ink-muted">
                      Forfeit history: {uForfeits.map((e) => `${inr(Math.abs(e.amount))} (${fmtDate(e.at)} · ${e.ref})`).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-52">
                  <Button variant="secondary" size="sm"
                    onClick={() => { setUserStanding(u.id, 'watchlist'); pushToast({ kind: 'info', title: 'Restored to watchlist', body: u.firm }) }}>
                    Restore to watchlist
                  </Button>
                  {(() => {
                    const req = banRequest(u.id)
                    if (!req) {
                      return (
                        <Button variant="danger" size="sm" onClick={() => { setBanning(u); setReason('') }}>
                          <Ban size={14} /> Propose permanent ban
                        </Button>
                      )
                    }
                    if (req.status === 'approved') {
                      return (
                        <Button variant="danger" size="sm"
                          onClick={() => {
                            const r = setAccountStatus(u.id, 'banned', req.reason)
                            pushToast(r.ok
                              ? { kind: 'danger', title: 'Account banned', body: `${u.firm} — signed by the CEO, executed by us.` }
                              : { kind: 'danger', title: 'Not banned', body: r.error })
                          }}>
                          <Ban size={14} /> Execute the signed ban
                        </Button>
                      )
                    }
                    return (
                      <div className="card bg-steel-soft/50 border-0 p-2.5 text-[12px] text-ink-muted">
                        <Signature size={12} className="inline mr-1 text-steel" />
                        With the CEO since {relTime(req.requestedAt, now)}. They keep bidding rights barred as a defaulter meanwhile.
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <h2 className="text-lg font-bold mt-10 mb-3">Watchlist</h2>
      {watchlist.length === 0 && <EmptyState title="Watchlist is empty" />}
      <div className="space-y-2.5">
        {watchlist.map((u) => (
          <div key={u.id} className="card p-4 flex flex-wrap items-center gap-3">
            <Avatar name={u.name} hue={u.avatarHue} size={36} />
            <div className="flex-1 min-w-52">
              <div className="font-semibold">{u.firm} <Chip tone="warning" className="ml-1.5">Watchlist</Chip></div>
              <div className="text-xs text-ink-muted">{u.name} · {u.city} · member since {fmtDate(u.joinedAt)}</div>
            </div>
            <Button variant="secondary" size="sm"
              onClick={() => { setUserStanding(u.id, 'good'); pushToast({ kind: 'success', title: 'Cleared to good standing', body: u.firm }) }}>
              Clear to good standing
            </Button>
            <Button variant="danger" size="sm" onClick={() => { setEscalate(u); setReason('') }}>
              Escalate to defaulter
            </Button>
          </div>
        ))}
      </div>

      {/* --------------------------- permanently banned --------------------------- */}
      {banned.length > 0 && (
        <>
          <h2 className="text-lg font-bold mt-10 mb-1">Permanently banned</h2>
          <p className="text-sm text-ink-muted mb-3">
            Closed for good, on the CEO's signature. The accounts remain — everything they were part of stays readable — but they
            cannot sign in, bid or fund.
          </p>
          <div className="space-y-2.5">
            {banned.map((u) => (
              <div key={u.id} className="card border-danger/50 p-4 flex flex-wrap items-center gap-3">
                <Avatar name={u.name} hue={u.avatarHue} size={36} />
                <div className="flex-1 min-w-52">
                  <div className="font-semibold flex items-center gap-2 flex-wrap">
                    {u.firm} <Chip tone="danger"><Ban size={11} /> Banned</Chip>
                  </div>
                  <div className="text-xs text-ink-muted">{u.blacklistReason ?? 'Permanent ban'} · GSTIN <span className="num">{u.gstin}</span></div>
                </div>
                <Button variant="ghost" size="sm"
                  onClick={() => {
                    const r = setAccountStatus(u.id, 'suspended', 'Ban lifted — account suspended pending review')
                    pushToast(r.ok ? { kind: 'info', title: 'Ban lifted to suspended', body: u.firm } : { kind: 'danger', title: 'Not changed', body: r.error })
                  }}>
                  Lift to suspended
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card mt-10 p-5 bg-surface-2/60">
        <h3 className="font-bold mb-2">Defaulters policy</h3>
        <ul className="text-sm text-ink-muted space-y-1.5 list-disc pl-5">
          <li>Two EMD forfeitures inside 12 months — or one confirmed bid-rigging incident — moves a buyer to defaulter automatically.</li>
          <li>Defaulters cannot fund EMD or enter bidding rooms; existing DOs remain enforceable and payable.</li>
          <li>Restoration needs Super Admin approval plus a fresh security deposit of ₹2,00,000 held for 6 months.</li>
          <li>
            A <b>permanent ban</b> is a different decision from defaulter standing: a Sub Admin proposes it, the{' '}
            <Link to="/ceo/approvals" className="text-ember font-semibold hover:underline">CEO signs it</Link>, and only a Super Admin
            executes it. Money already held is settled by{' '}
            <Link to="/finance/emd" className="text-ember font-semibold hover:underline">Finance</Link> — a ban never forfeits an EMD by
            itself.
          </li>
        </ul>
      </div>

      <Modal open={!!escalate} onClose={() => setEscalate(null)} title={`Escalate ${escalate?.firm} to defaulter?`}>
        <Field label="Reason (shown on the account & audit trail)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. second lifting default inside 12 months (AUC-2415)" />
        </Field>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setEscalate(null)}>Cancel</Button>
          <Button variant="danger" disabled={!reason.trim()}
            onClick={() => {
              setUserStanding(escalate!.id, 'defaulter', reason.trim())
              pushToast({ kind: 'danger', title: 'Moved to defaulters', body: escalate!.firm })
              setEscalate(null)
            }}>
            Confirm escalation
          </Button>
        </div>
      </Modal>

      {/* ---------------------------- permanent ban ---------------------------- */}
      <Modal open={!!banning} onClose={() => setBanning(null)} title={`Propose a permanent ban — ${banning?.firm}`}>
        {banning && (
          <div className="space-y-4">
            <div className="card bg-warning-soft border-0 p-4 text-sm">
              This goes to the <b>CEO for signature</b> and nothing changes until they sign it. {banning.firm} stays barred from bidding
              as a defaulter in the meantime, so the proposal costs nothing while it waits.
            </div>
            <div className="card bg-surface-2 border-0 p-4 text-sm grid grid-cols-2 gap-y-1.5">
              <span className="text-ink-muted">EMD we are holding</span>
              <span className="num font-bold text-right">{inr(exposure(banning.id).locked)}</span>
              <span className="text-ink-muted">Wallet balance</span>
              <span className="num font-bold text-right">{inr(exposure(banning.id).balance)}</span>
              <span className="text-ink-muted col-span-2 text-xs pt-1">
                A ban does not touch either figure. Whether the deposit is returned or forfeited is Finance's decision, separately and
                with its own reason.
              </span>
            </div>
            <Field label="Why this account should be closed for good">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Third confirmed lifting default across two GSTINs of the same group, after a written warning in September…" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBanning(null)}>Cancel</Button>
              <Button variant="danger" disabled={reason.trim().length < 8}
                onClick={() => {
                  requestCeoSignoff({
                    kind: 'permanent_ban', refId: banning.id, amount: 0,
                    summary: `Permanent ban — ${banning.firm}`,
                    reason: reason.trim(),
                  })
                  pushToast({ kind: 'info', title: 'Sent to the CEO', body: `${banning.firm} stays a barred defaulter until it is signed.` })
                  setBanning(null)
                }}>
                Send for signature
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
