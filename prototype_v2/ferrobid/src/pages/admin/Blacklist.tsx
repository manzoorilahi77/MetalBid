/* Super Admin — blacklist & defaulters. */
import { useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Avatar, Button, Chip, EmptyState, Field, Modal, PageHeader, Stat, Textarea } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, inr, inrCompact } from '../../lib/format'
import type { User } from '../../types'

export default function Blacklist() {
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)
  const setUserStanding = useStore((s) => s.setUserStanding)
  const pushToast = useStore((s) => s.pushToast)

  const [escalate, setEscalate] = useState<User | null>(null)
  const [reason, setReason] = useState('')

  const defaulters = users.filter((u) => u.standing === 'defaulter')
  const watchlist = users.filter((u) => u.standing === 'watchlist')
  const forfeits = wallets.flatMap((w) => w.ledger.filter((e) => e.type === 'emd_forfeit'))
  const forfeited = forfeits.reduce((s, e) => s + Math.abs(e.amount), 0)

  return (
    <Page>
      <PageHeader title="Blacklist & defaulters" sub="Buyers barred or under watch for lifting defaults, payment failures or bid manipulation." />
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="Defaulters (barred)" value={defaulters.length} tone="danger" />
        <Stat label="On watchlist" value={watchlist.length} tone="warning" />
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
                <div className="flex flex-col gap-2">
                  <Button variant="secondary" size="sm"
                    onClick={() => { setUserStanding(u.id, 'watchlist'); pushToast({ kind: 'info', title: 'Restored to watchlist', body: u.firm }) }}>
                    Restore to watchlist
                  </Button>
                  <Button variant="danger" size="sm"
                    onClick={() => pushToast({ kind: 'danger', title: 'Permanent ban recorded (demo)', body: `${u.firm} — GSTIN blocked across group entities.` })}>
                    Permanent ban
                  </Button>
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

      <div className="card mt-10 p-5 bg-surface-2/60">
        <h3 className="font-bold mb-2">Defaulters policy</h3>
        <ul className="text-sm text-ink-muted space-y-1.5 list-disc pl-5">
          <li>Two EMD forfeitures inside 12 months — or one confirmed bid-rigging incident — moves a buyer to defaulter automatically.</li>
          <li>Defaulters cannot fund EMD or enter bidding rooms; existing DOs remain enforceable and payable.</li>
          <li>Restoration needs Super Admin approval plus a fresh security deposit of ₹2,00,000 held for 6 months.</li>
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
    </Page>
  )
}
