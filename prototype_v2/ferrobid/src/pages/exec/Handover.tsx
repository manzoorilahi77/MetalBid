/* Executive Manager — handover records for completed DOs and the approvals inbox. */
import { useState } from 'react'
import { FileCheck2, BadgeCheck } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { PageHeader, Button, Chip, Avatar, EmptyState } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, fmtDate } from '../../lib/format'
import type { DeliveryOrder } from '../../types'

const hash = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0)
/** Deterministic weighed quantity: awarded ± up to 0.6%. */
const weighedQty = (d: DeliveryOrder) => {
  const deltaPct = ((hash(d.id) % 13) - 6) / 1000
  return Math.round(d.awardedQty * (1 + deltaPct) * 100) / 100
}

export default function Handover() {
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const catalogues = useStore((s) => s.catalogues)
  const extendCatalogue = useStore((s) => s.extendCatalogue)
  const pushToast = useStore((s) => s.pushToast)

  const [handled, setHandled] = useState<string[]>([])
  const done = (key: string) => handled.includes(key)
  const mark = (key: string) => setHandled((p) => [...p, key])

  const completed = deliveryOrders.filter((d) => d.stage === 'completed')
  const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? '—'

  const kycQueue = users.filter((u) => u.kycStatus === 'pending' && !done(`kyc-${u.id}`))
  const liveCat = catalogues.find((c) => c.status === 'live')
  const extensionRequests = liveCat && !done('ext-1')
    ? [{ key: 'ext-1', cat: liveCat, from: firm(liveCat.sellerId), reason: 'Heavy bidder interest in the final lots — seller requests a short extension.' }]
    : []

  return (
    <Page>
      <PageHeader title="Handover & closure" sub="Completed delivery orders with weighment-final quantities, plus your pending approvals inbox." />

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
                  <div className="flex items-center gap-2">
                    <span className="num text-xs font-bold">{d.id.toUpperCase()}</span>
                    <Chip tone="success"><BadgeCheck size={12} /> Handover complete</Chip>
                  </div>
                  <div className="font-semibold mt-0.5">{l ? `${l.lotNo} · ${l.grade} · ${l.metal}` : d.lotId}</div>
                  <div className="text-xs text-ink-muted">{firm(d.buyerId)}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-ink-faint">Weighed qty</div>
                  <div className="num font-semibold">{num(weighedQty(d))} {d.uom}</div>
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
                </div>
                <Button size="sm" variant="ghost" className="ml-auto"
                  onClick={() => pushToast({ kind: 'info', title: 'Closure certificate ready', body: `${d.id.toUpperCase()} — certificate PDF downloaded (demo).` })}>
                  <FileCheck2 size={14} /> Download closure certificate
                </Button>
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
                      onClick={() => { mark(`kyc-${u.id}`); pushToast({ kind: 'success', title: 'KYC approved (demo)', body: `${u.firm} can now participate fully on the platform.` }) }}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger hover:text-danger"
                      onClick={() => { mark(`kyc-${u.id}`); pushToast({ kind: 'warning', title: 'KYC denied (demo)', body: `${u.firm} has been asked to resubmit documents.` }) }}>
                      Deny
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
                      <span className="num text-xs font-bold text-ink-muted">{r.cat.code}</span>
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
    </Page>
  )
}
