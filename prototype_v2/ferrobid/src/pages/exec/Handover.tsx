/* ---------------------------------------------------------------------------
   Operation Manager — handover & closure.

   The last operational act on a sale: the material has been weighed and lifted,
   and Operations records that it actually left the yard against the
   weighment-final quantity. Until that is confirmed the delivery stays open
   however finished it looks, and Finance has nothing to book against.

   The approvals inbox below it used to be theatre — approving a KYC ticked a
   local array and changed nothing about the account. It now goes through the
   store, so a verified seller can genuinely submit lots.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { FileCheck2, BadgeCheck, PackageCheck } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { PageHeader, Button, Chip, Avatar, EmptyState, Modal, Field, Textarea } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, fmtDate, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { useCmsPage } from '../../api/useCmsPage'
import type { DeliveryOrder } from '../../types'

export default function Handover() {
  const now = useNow()
  const cms = useCmsPage('/exec/handover')
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const catalogues = useStore((s) => s.catalogues)
  const extendCatalogue = useStore((s) => s.extendCatalogue)
  const confirmHandover = useStore((s) => s.confirmHandover)
  const decideSellerKyc = useStore((s) => s.decideSellerKyc)
  const pushToast = useStore((s) => s.pushToast)

  const [handled, setHandled] = useState<string[]>([])
  const done = (key: string) => handled.includes(key)
  const mark = (key: string) => setHandled((p) => [...p, key])

  const [closing, setClosing] = useState<DeliveryOrder | null>(null)
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [kycReason, setKycReason] = useState('')

  const completed = deliveryOrders.filter((d) => d.stage === 'completed')
  const open = completed.filter((d) => !d.handoverConfirmedAt)
  const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? '—'

  const closeHandover = () => {
    if (!closing) return
    const res = confirmHandover(closing.id, note.trim() || undefined)
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Not closed', body: res.error })
      return
    }
    pushToast({
      kind: 'success',
      title: 'Handover closed',
      body: 'The buyer has their closure certificate and Finance can book the sale.',
    })
    setClosing(null); setNote('')
  }

  const kycQueue = users.filter((u) => u.kycStatus === 'pending' && !done(`kyc-${u.id}`))
  const liveCat = catalogues.find((c) => c.status === 'live')
  const extensionRequests = liveCat && !done('ext-1')
    ? [{ key: 'ext-1', cat: liveCat, from: firm(liveCat.sellerId), reason: 'Heavy bidder interest in the final lots — seller requests a short extension.' }]
    : []

  return (
    <Page>
      <PageHeader
        title="Handover &amp; closure"
        sub="Lifted deliveries at their weighment-final quantity. Confirming the handover is what closes a sale operationally — and what lets Finance book it."
        actions={open.length > 0
          ? <Chip tone="warning"><span className="num">{open.length}</span> awaiting your confirmation</Chip>
          : <Chip tone="success">Every delivery is closed</Chip>}
      />

      <h2 className="font-display text-lg font-bold mb-3">Handover records</h2>
      {completed.length === 0 ? (
        <EmptyState title="No completed handovers yet" body="Delivery orders appear here once weighment is done and material has left the yard." />
      ) : (
        <div className="space-y-3 mb-8">
          {completed.map((d) => {
            const l = lots.find((x) => x.id === d.lotId)
            const total = d.materialValue + d.gstAmount + d.tcsAmount
            const handover = new Date(Date.parse(d.createdAt) + 3 * 86400_000).toISOString()
            return (
              <div key={d.id} className="card p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="min-w-52 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num text-xs font-bold">{d.id.toUpperCase()}</span>
                    {d.handoverConfirmedAt
                      ? <Chip tone="success"><BadgeCheck size={12} /> Handover closed</Chip>
                      : <Chip tone="warning">Lifted — not yet closed</Chip>}
                  </div>
                  <div className="font-semibold mt-0.5">{l ? `${l.lotNo} · ${l.grade} · ${l.metal}` : d.lotId}</div>
                  <div className="text-xs text-ink-muted">{firm(d.buyerId)}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-ink-faint">Weighed qty</div>
                  <div className="num font-semibold">{num(d.weighedQty ?? d.awardedQty)} {d.uom}</div>
                  <div className="text-[11px] text-ink-faint">final on weighment</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-ink-faint">Final invoice</div>
                  <div className="num font-bold">{inr(total)}</div>
                  <div className="text-[11px] text-ink-faint">incl. GST + TCS</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-ink-faint">Handover date</div>
                  <div className="num font-semibold">{fmtDate(handover)}</div>
                  {d.handoverConfirmedAt && (
                    <div className="text-[11px] text-ink-faint">
                      closed by {users.find((u) => u.id === d.handoverConfirmedBy)?.name ?? 'Operations'} · {relTime(d.handoverConfirmedAt, now)}
                    </div>
                  )}
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {d.handoverConfirmedAt ? (
                    cms.on('certificate') && (
                      <Button size="sm" variant="ghost"
                        onClick={() => pushToast({ kind: 'info', title: 'Closure certificate ready', body: `${d.id.toUpperCase()} — certificate PDF downloaded (demo).` })}>
                        <FileCheck2 size={14} /> Download closure certificate
                      </Button>
                    )
                  ) : (
                    <Button size="sm" variant="success" onClick={() => { setClosing(d); setNote('') }}>
                      <PackageCheck size={14} /> Confirm handover
                    </Button>
                  )}
                </div>
                {d.handoverNote && (
                  <div className="w-full text-[12px] text-ink-muted border-t border-line pt-2.5">
                    &ldquo;{d.handoverNote}&rdquo;
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <h2 className="font-display text-lg font-bold mb-3 mt-8">Approvals inbox</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* seller / buyer KYC */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2">KYC requests</div>
          {kycQueue.length === 0 ? (
            <EmptyState title="No KYC requests pending" body="New seller and buyer verifications will land here." />
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {kycQueue.map((u) => (
                <div key={u.id} className="p-4 flex flex-wrap items-center gap-3">
                  <Avatar name={u.name} hue={u.avatarHue} size={36} />
                  <div className="flex-1 min-w-40">
                    <div className="text-sm font-semibold">{u.name}</div>
                    <div className="text-xs text-ink-muted">{u.firm} · {u.city}</div>
                    <div className="num text-[11px] text-ink-faint">GSTIN {u.gstin}</div>
                  </div>
                  <Chip tone="warning">KYC pending</Chip>
                  <div className="flex gap-2">
                    <Button size="sm" variant="success"
                      onClick={() => {
                        const res = decideSellerKyc(u.id, true)
                        pushToast(res.ok
                          ? { kind: 'success', title: `${u.firm} verified`, body: 'They can submit lots for inspection now.' }
                          : { kind: 'danger', title: 'Not verified', body: res.error })
                        if (res.ok) mark(`kyc-${u.id}`)
                      }}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger hover:text-danger"
                      onClick={() => { setRejecting(u.id); setKycReason('') }}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* catalogue extension requests */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2">Catalogue extension requests</div>
          {extensionRequests.length === 0 ? (
            <EmptyState title="No extension requests" body="Seller requests to extend a live auction will queue here." />
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {extensionRequests.map((r) => (
                <div key={r.key} className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-48">
                    <div className="flex items-center gap-2">
                      <span className="num text-xs font-bold text-ember">{r.cat.code}</span>
                      <Chip tone="ember" pulse>Live</Chip>
                    </div>
                    <div className="text-sm font-semibold mt-0.5">{r.cat.title}</div>
                    <div className="text-xs text-ink-muted">{r.from} — “{r.reason}”</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="steel"
                      onClick={() => {
                        extendCatalogue(r.cat.id, 15)
                        mark(r.key)
                        pushToast({ kind: 'success', title: `${r.cat.code} extended by 15 min`, body: 'All live lots shifted — bidders notified.' })
                      }}>
                      Grant +15 min
                    </Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => { mark(r.key); pushToast({ kind: 'info', title: 'Extension declined', body: `${r.cat.code} will close on schedule.` }) }}>
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --------------------------- close a handover ----------------------- */}
      <Modal open={!!closing} onClose={() => { setClosing(null); setNote('') }} title={`Confirm handover — ${closing?.id.toUpperCase() ?? ''}`}>
        {closing && (
          <div className="space-y-4">
            <div className="card bg-success-soft border-0 p-4 text-sm">
              <div className="font-bold text-ink">
                {lots.find((l) => l.id === closing.lotId)?.lotNo ?? closing.lotId} · {firm(closing.buyerId)}
              </div>
              <p className="text-ink-muted mt-1">
                Closing at <span className="num font-semibold text-ink">{num(closing.weighedQty ?? closing.awardedQty)} {closing.uom}</span>{' '}
                weighment-final, against <span className="num">{num(closing.awardedQty)} {closing.uom}</span> awarded. The buyer gets their
                closure certificate and Finance can book the sale.
              </p>
            </div>
            <Field label="Note" hint="Optional. Recorded against the delivery and on the audit trail — use it for anything the weighbridge slip does not say.">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Lifted across two vehicles on consecutive days; gate passes GP-4471 and GP-4489." />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setClosing(null); setNote('') }}>Cancel</Button>
              <Button variant="success" onClick={closeHandover}><PackageCheck size={15} /> Confirm handover</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ----------------------------- reject KYC --------------------------- */}
      <Modal open={!!rejecting} onClose={() => { setRejecting(null); setKycReason('') }} title="What has to be resubmitted?">
        <div className="space-y-4">
          <p className="text-[13px] text-ink-muted">
            A rejection is never a dead end — the seller sees this word for word and can resubmit, or appeal to the
            Operation Manager.
          </p>
          <Field label="Reason" hint="Shown to the applicant, and kept on the audit trail under your name.">
            <Textarea value={kycReason} onChange={(e) => setKycReason(e.target.value)}
              placeholder="e.g. The GSTIN on the certificate does not match the firm name on the bank letter — resubmit both from the same entity." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setRejecting(null); setKycReason('') }}>Cancel</Button>
            <Button variant="danger" disabled={kycReason.trim().length < 4}
              onClick={() => {
                if (!rejecting) return
                const res = decideSellerKyc(rejecting, false, kycReason.trim())
                pushToast(res.ok
                  ? { kind: 'info', title: 'Sent back to the applicant', body: 'They have been told exactly what to resubmit.' }
                  : { kind: 'danger', title: 'Not recorded', body: res.error })
                if (res.ok) mark(`kyc-${rejecting}`)
                setRejecting(null); setKycReason('')
              }}>
              Send it back
            </Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
