/* Executive Manager — post-auction settlement desk: STA decisions and DO payments. */
import { useState } from 'react'
import { Landmark } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { PageHeader, Button, Chip, Stat, ProgressBar, EmptyState, Modal, Field, Input, LockChip } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num } from '../../lib/format'
import type { DeliveryOrder, AuctionStatusStage } from '../../types'

const STAGE_LABEL: Record<AuctionStatusStage, string> = {
  payment_pending: 'Payment pending',
  dd_issued: 'DD received',
  lifting_scheduled: 'Lifting scheduled',
  lifted: 'Lifted',
  completed: 'Completed',
}
const STAGE_TONE: Record<AuctionStatusStage, 'warning' | 'steel' | 'success' | 'neutral'> = {
  payment_pending: 'warning',
  dd_issued: 'steel',
  lifting_scheduled: 'steel',
  lifted: 'steel',
  completed: 'success',
}

const doTotal = (d: DeliveryOrder) => d.materialValue + d.gstAmount + d.tcsAmount

export default function Settlement() {
  const role = useStore((s) => s.role)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const catalogues = useStore((s) => s.catalogues)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const returnRefusedLotToPipeline = useStore((s) => s.returnRefusedLotToPipeline)
  const approveStaSale = useStore((s) => s.approveStaSale)
  const markStaUnsold = useStore((s) => s.markStaUnsold)
  const advanceDeliveryOrder = useStore((s) => s.advanceDeliveryOrder)
  const issueDemandDraft = useStore((s) => s.issueDemandDraft)
  const audit = useStore((s) => s.audit)
  const pushToast = useStore((s) => s.pushToast)

  const canIssueDd = role === 'sub_admin' || role === 'exec_manager'
  const [ddTarget, setDdTarget] = useState<DeliveryOrder | null>(null)
  const [ddNumber, setDdNumber] = useState('')
  const [issuingBank, setIssuingBank] = useState('')
  const [amount, setAmount] = useState(0)

  const closedIds = catalogues.filter((c) => c.status === 'closed').map((c) => c.id)
  const staLots = lots.filter((l) => l.status === 'sta' && closedIds.includes(l.catalogueId))
  const firm = (id: string | null) => users.find((u) => u.id === id)?.firm ?? 'Unknown bidder'
  const catCode = (id: string) => catalogues.find((c) => c.id === id)?.code ?? id

  const settledValue = deliveryOrders.filter((d) => d.stage === 'completed').reduce((s, d) => s + doTotal(d), 0)
  /* A seller who refuses the cleared price ends the commercial chain — no
     commission is charged and the material becomes an operational decision.
     Nothing in the build handled that; this is where it lands. */
  const refusedLots = lots.filter((l) => l.sellerDecision === 'rejected' && closedIds.includes(l.catalogueId))

  const returnToPipeline = (id: string) => {
    const l = lots.find((x) => x.id === id)
    if (!l) return
    const res = returnRefusedLotToPipeline(id)
    if (!res.ok) { pushToast({ kind: 'danger', title: 'Could not return this lot', body: res.error }); return }
    audit('settlement.refused_price', l.lotNo,
      `Seller refused ${inr(l.resultH1Rate ?? 0)}/${l.uom} — lot returned to the pipeline for re-auction (${catCode(l.catalogueId)})`, 'warning')
    pushToast({
      kind: 'info',
      title: `${l.lotNo} returned to the pipeline`,
      body: 'Marked unsold and available to catalogue again. Held EMD releases automatically.',
    })
  }

  const approveSale = (id: string) => {
    const l = lots.find((x) => x.id === id)!
    const res = approveStaSale(id)
    if (!res.ok) { pushToast({ kind: 'danger', title: 'Could not approve this sale', body: res.error }); return }
    audit('settlement.sta_approve', l.lotNo, `H1 of ${inr(l.resultH1Rate ?? l.currentRate ?? 0)}/${l.uom} accepted below reserve (${catCode(l.catalogueId)})`, 'warning')
    pushToast({ kind: 'success', title: `${l.lotNo} sale approved`, body: 'H1 accepted — delivery order will be issued after payment.' })
  }
  const markUnsold = (id: string) => {
    const l = lots.find((x) => x.id === id)!
    const res = markStaUnsold(id)
    if (!res.ok) { pushToast({ kind: 'danger', title: 'Could not mark this lot unsold', body: res.error }); return }
    audit('settlement.sta_reject', l.lotNo, `H1 rejected below reserve — lot marked unsold (${catCode(l.catalogueId)})`, 'warning')
    pushToast({ kind: 'info', title: `${l.lotNo} marked unsold`, body: 'EMD will be auto-released; lot returns to the pipeline for re-auction.' })
  }

  const openDdModal = (d: DeliveryOrder) => {
    setDdTarget(d)
    setDdNumber('')
    setIssuingBank('')
    setAmount(doTotal(d) - d.paidAmount)
  }

  return (
    <Page>
      <PageHeader
        title="Post-auction exceptions"
        sub="The two commercial calls a closed auction leaves with Operations: a lot that cleared below its reserve, and a price the seller refused. Confirming results belongs to the Auction Manager, and the money to Finance."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Pending STA decisions" value={staLots.length} tone={staLots.length > 0 ? 'warning' : 'success'} sub="H1 below reserve — needs a call" />
        <Stat label="Prices the seller refused" value={refusedLots.length} tone={refusedLots.length > 0 ? 'warning' : 'success'} sub="material needs a decision" />
        <Stat label="Settled value this week" value={inrCompact(settledValue)} tone="success" sub="Completed delivery orders" />
      </div>

      <h2 className="font-display text-lg font-bold mb-3">STA decisions — H1 below reserve</h2>
      {staLots.length === 0 ? (
        <EmptyState title="No STA lots pending" body="Every closed lot has been resolved. New subject-to-approval results will queue here." />
      ) : (
        <div className="space-y-3 mb-8">
          {staLots.map((l) => {
            const h1 = l.resultH1Rate ?? l.currentRate ?? 0
            const shortfall = l.reserveRate > 0 ? ((l.reserveRate - h1) / l.reserveRate) * 100 : 0
            return (
              <div key={l.id} className="card p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="min-w-52 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="num text-xs font-bold text-ink-muted">{l.lotNo}</span>
                    <Chip tone="neutral"><span className="num">{catCode(l.catalogueId)}</span></Chip>
                  </div>
                  <div className="font-semibold mt-0.5">{l.grade} · {l.metal}</div>
                  <div className="text-xs text-ink-muted"><span className="num">{num(l.indicativeQty)} {l.uom}</span> · H1 bidder <span className="font-semibold text-ink">{firm(l.leadingBidderId)}</span></div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-ink-faint">H1 rate</div>
                  <div className="num font-bold">{inr(h1)}/{l.uom}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-ink-faint">Reserve rate</div>
                  <div className="num font-semibold text-ink-muted">{inr(l.reserveRate)}/{l.uom}</div>
                </div>
                <Chip tone="danger"><span className="num">−{shortfall.toFixed(1)}%</span> vs reserve</Chip>
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" variant="success" onClick={() => approveSale(l.id)}>Approve sale (accept H1)</Button>
                  <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => markUnsold(l.id)}>Mark unsold</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ------------------- prices the seller would not take ---------------- */}
      <h2 className="font-display text-lg font-bold mb-3 mt-8">Prices the seller refused</h2>
      {refusedLots.length === 0 ? (
        <EmptyState title="No refused prices" body="When a seller rejects the price one of their lots cleared at, it lands here — no commission is charged and the material needs an operational decision." />
      ) : (
        <div className="space-y-3 mb-8">
          {refusedLots.map((l) => {
            const cleared = l.resultH1Rate ?? 0
            return (
              <div key={l.id} className="card p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="min-w-52 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="num text-xs font-bold text-ink-muted">{l.lotNo}</span>
                    <Chip tone="neutral"><span className="num">{catCode(l.catalogueId)}</span></Chip>
                    <Chip tone="warning">Seller refused</Chip>
                  </div>
                  <div className="font-semibold mt-0.5">{l.grade} · {l.metal}</div>
                  <div className="text-xs text-ink-muted">
                    <span className="num">{num(l.indicativeQty)} {l.uom}</span> · winning bidder <span className="font-semibold text-ink">{firm(l.leadingBidderId)}</span>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-ink-faint">Cleared at</div>
                  <div className="num font-bold">{inr(cleared)}/{l.uom}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-ink-faint">Seller&apos;s reserve</div>
                  <div className="num font-semibold text-ink-muted">{inr(l.reserveRate)}/{l.uom}</div>
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" variant="secondary" onClick={() => returnToPipeline(l.id)}>Return for re-auction</Button>
                </div>
                <p className="w-full text-[12px] text-ink-muted border-t border-line pt-2.5">
                  No commission is charged on a refused price. The buyer bid in good faith — whoever speaks to them should
                  do it before the lot is relisted.
                </p>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="font-display text-lg font-bold mb-3 mt-8">Payments &amp; delivery orders</h2>
      <p className="text-[13px] text-ink-muted -mt-1 mb-3">
        Read-alongside. Chasing a buyer, confirming a receipt and issuing an invoice are the Finance Administrator&apos;s —
        Operations watches this to know when it can schedule lifting.
      </p>
      {!canIssueDd && (
        <div className="card bg-surface-2 p-3 flex items-center justify-between gap-3 mb-3">
          <span className="text-xs text-ink-muted">Issuing a Demand Draft record needs Sub-Admin or Exec Manager access.</span>
          <LockChip label="Issue DD requires Sub-Admin/Exec Manager" />
        </div>
      )}
      {deliveryOrders.length === 0 ? (
        <EmptyState title="No delivery orders yet" body="DOs are created automatically when a sold lot is confirmed." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-ink-faint border-b border-line-strong">
                <th className="px-4 py-3 font-semibold">DO</th>
                <th className="px-4 py-3 font-semibold">Buyer</th>
                <th className="px-4 py-3 font-semibold">Lot</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="px-4 py-3 font-semibold text-right">Total value</th>
                <th className="px-4 py-3 font-semibold">Paid</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {deliveryOrders.map((d) => {
                const l = lots.find((x) => x.id === d.lotId)
                const total = doTotal(d)
                return (
                  <tr key={d.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 num font-semibold">{d.id.toUpperCase()}</td>
                    <td className="px-4 py-3">{firm(d.buyerId)}</td>
                    <td className="px-4 py-3 text-ink-muted">{l ? `${l.lotNo} · ${l.grade}` : d.lotId}</td>
                    <td className="px-4 py-3"><Chip tone={STAGE_TONE[d.stage]}>{STAGE_LABEL[d.stage]}</Chip></td>
                    <td className="px-4 py-3 num text-right font-semibold">{inrCompact(total)}</td>
                    <td className="px-4 py-3 min-w-36">
                      <div className="num text-xs mb-1">{inrCompact(d.paidAmount)} / {inrCompact(total)}</div>
                      <ProgressBar value={d.paidAmount} max={total} tone={d.paidAmount >= total ? 'success' : 'warning'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.stage === 'payment_pending' ? (
                        <Button size="sm" variant="secondary" disabled={!canIssueDd} onClick={() => openDdModal(d)}>
                          <Landmark size={14} /> Issue Demand Draft
                        </Button>
                      ) : d.stage === 'dd_issued' || d.stage === 'lifting_scheduled' ? (
                        <Button size="sm" variant="secondary"
                          onClick={() => {
                            advanceDeliveryOrder(d.id)
                            pushToast({ kind: 'success', title: `${d.id.toUpperCase()} advanced`, body: 'Auction status moved to the next stage.' })
                          }}>
                          Advance stage
                        </Button>
                      ) : d.stage === 'lifted' ? (
                        <span className="text-xs text-ink-muted num">{d.liftingChecklist.filter((i) => i.done).length}/{d.liftingChecklist.length} checklist complete</span>
                      ) : (
                        <Chip tone="success">Settled</Chip>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* issue Demand Draft */}
      <Modal open={!!ddTarget} onClose={() => setDdTarget(null)} title="Issue Demand Draft">
        {ddTarget && (
          <div className="space-y-4">
            <div className="card bg-surface-2 border-0 p-3.5 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-ink-muted">Delivery order</span><span className="num font-semibold">{ddTarget.id.toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Buyer</span><span className="font-semibold">{firm(ddTarget.buyerId)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Balance due</span><span className="num font-bold">{inr(doTotal(ddTarget) - ddTarget.paidAmount)}</span></div>
            </div>
            <Field label="DD number">
              <Input value={ddNumber} onChange={(e) => setDdNumber(e.target.value)} placeholder="e.g. DD-3391827" />
            </Field>
            <Field label="Issuing bank">
              <Input value={issuingBank} onChange={(e) => setIssuingBank(e.target.value)} placeholder="e.g. HDFC Bank" />
            </Field>
            <Field label="Amount">
              <Input type="number" className="num" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setDdTarget(null)}>Cancel</Button>
              <Button className="flex-1" disabled={!ddNumber.trim() || !issuingBank.trim() || amount <= 0}
                onClick={() => {
                  issueDemandDraft(ddTarget.id, { ddNumber: ddNumber.trim(), issuingBank: issuingBank.trim(), amount })
                  pushToast({ kind: 'success', title: `${ddTarget.id.toUpperCase()} — DD recorded`, body: 'Delivery order issued; buyer can now schedule lifting.' })
                  setDdTarget(null)
                }}>
                Confirm & issue DO
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
