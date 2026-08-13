/* Lot settlement — seller browses their auctions (upcoming / live / pending
   settlement / history), opens one to review the cleared price on every sold
   lot, accepts or rejects it, and settles ferroBid's commission (10% of the
   upside over reserve) per auction — either by bank transfer or netted out of
   the EMD. Once every sold lot has a decision and any commission owed is
   settled, the auction moves from "Pending settlement" into "History". */
import { useMemo, useState } from 'react'
import { Search, Check, X, Landmark, Wallet as WalletIcon, ChevronRight, ArrowLeft, Clock, Radio, Hourglass, History as HistoryIcon, CheckCircle2 } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Input, PageHeader, Segmented, Stat, StatusChip, Tabs, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num, fmtDate } from '../../lib/format'
import { TransferPaymentModal, EmdSettleModal } from './SettlementPayment'
import type { Catalogue, CommissionSettlement, CompanyBankAccount, Lot } from '../../types'

type TabKey = 'upcoming' | 'live' | 'pending' | 'history'
type SettleMode = 'transfer' | 'emd'

interface SettlementInfo {
  sold: Lot[]
  accepted: Lot[]
  undecided: Lot[]
  totalCommission: number
  grossAccepted: number
  settled: boolean
  record?: CommissionSettlement
}
type CatalogueGroup = { cat: Catalogue; lots: Lot[]; info: SettlementInfo }

const COMMISSION_RATE = 0.1
const FINISHED_STATUSES: Lot['status'][] = ['sold', 'sta', 'unsold']

/** Total expected/sold value for a lot — rate is ₹ per UOM, so the payable
 *  amount is rate × indicative quantity (mirrors how realised value is
 *  computed elsewhere, e.g. seller Reports). */
function expectedAmount(l: Lot) {
  return l.reserveRate * l.indicativeQty
}
function soldAmount(l: Lot) {
  return l.resultH1Rate != null ? l.resultH1Rate * l.indicativeQty : null
}
/** Upside over the seller's own reserve, in total ₹ — the base the
 *  commission is cut from. null while there's no cleared price yet. */
function upperValue(l: Lot) {
  const sold = soldAmount(l)
  return sold != null ? sold - expectedAmount(l) : null
}
function commissionFor(l: Lot) {
  const uv = upperValue(l)
  return uv != null ? Math.max(0, uv) * COMMISSION_RATE : null
}
function matchesLot(l: Lot, query: string) {
  return l.lotNo.toLowerCase().includes(query) || l.grade.toLowerCase().includes(query) || l.metal.toLowerCase().includes(query)
}

/** A closed auction is "done" — belongs in History — once every sold/STA lot
 *  has a seller decision, and any commission owed on the accepted lots has a
 *  matching settlement record (owing nothing at all also counts as done). */
function computeSettlementInfo(catalogueId: string, lots: Lot[], settlements: CommissionSettlement[]): SettlementInfo {
  const sold = lots.filter((l) => l.status === 'sold' || l.status === 'sta')
  const accepted = sold.filter((l) => l.sellerDecision === 'accepted')
  const undecided = sold.filter((l) => !l.sellerDecision)
  const totalCommission = accepted.reduce((s, l) => s + (commissionFor(l) ?? 0), 0)
  const grossAccepted = accepted.reduce((s, l) => s + (soldAmount(l) ?? 0), 0)
  const record = settlements.find((s) => s.catalogueId === catalogueId)
  const settled = sold.length === 0 || (undecided.length === 0 && (totalCommission <= 0 || !!record))
  return { sold, accepted, undecided, totalCommission, grossAccepted, settled, record }
}

function groupByCatalogue(lots: Lot[], catalogues: Catalogue[], settlements: CommissionSettlement[]): CatalogueGroup[] {
  const map = new Map<string, Lot[]>()
  for (const l of lots) map.set(l.catalogueId, [...(map.get(l.catalogueId) ?? []), l])
  return [...map.entries()]
    .map(([catId, ls]) => {
      const cat = catalogues.find((c) => c.id === catId)
      return cat ? { cat, lots: ls, info: computeSettlementInfo(catId, ls, settlements) } : null
    })
    .filter((g): g is CatalogueGroup => !!g)
    .sort((a, b) => (a.cat.code < b.cat.code ? 1 : -1))
}

const sumLots = (gs: CatalogueGroup[]) => gs.reduce((s, g) => s + g.lots.length, 0)

export default function SellerSettlement() {
  const me = useStore((s) => s.currentUser)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const companyBankAccounts = useStore((s) => s.companyBankAccounts)
  const commissionSettlements = useStore((s) => s.commissionSettlements)
  const setSellerLotDecision = useStore((s) => s.setSellerLotDecision)
  const recordCommissionSettlement = useStore((s) => s.recordCommissionSettlement)
  const pushToast = useStore((s) => s.pushToast)

  const settlementAccount = companyBankAccounts.find((a) => a.purpose === 'Settlement') ?? companyBankAccounts[0]

  const [tab, setTab] = useState<TabKey>('pending')
  const [q, setQ] = useState('')
  const [openCatalogueId, setOpenCatalogueId] = useState<string | null>(null)

  const mine = useMemo(() => {
    const myCatIds = new Set(catalogues.filter((c) => c.sellerId === me?.id).map((c) => c.id))
    return lots.filter((l) => myCatIds.has(l.catalogueId))
  }, [catalogues, lots, me?.id])

  const allGroups = useMemo(() => {
    const upcoming = groupByCatalogue(mine.filter((l) => !FINISHED_STATUSES.includes(l.status) && l.status !== 'live'), catalogues, commissionSettlements)
    const live = groupByCatalogue(mine.filter((l) => l.status === 'live'), catalogues, commissionSettlements)
    const finishedAll = groupByCatalogue(mine.filter((l) => FINISHED_STATUSES.includes(l.status)), catalogues, commissionSettlements)
    return {
      upcoming, live,
      pending: finishedAll.filter((g) => !g.info.settled),
      history: finishedAll.filter((g) => g.info.settled),
    }
  }, [mine, catalogues, commissionSettlements])

  const pendingSold = allGroups.pending.flatMap((g) => g.info.sold)
  const pendingUndecided = pendingSold.filter((l) => !l.sellerDecision)
  const pendingAccepted = pendingSold.filter((l) => l.sellerDecision === 'accepted')
  const pendingCommission = pendingAccepted.reduce((s, l) => s + (commissionFor(l) ?? 0), 0)

  const catalogueGroups = allGroups[tab]

  const query = q.trim().toLowerCase()
  // Auction list: keep a catalogue if its own code/title matches, or any lot inside it does
  // (search "auction wise" or "lot name/number wise" both work from the same box).
  const visibleCatalogues = query
    ? catalogueGroups.filter((g) =>
        g.cat.code.toLowerCase().includes(query) || g.cat.title.toLowerCase().includes(query) || g.lots.some((l) => matchesLot(l, query)))
    : catalogueGroups

  const openGroup = openCatalogueId ? catalogueGroups.find((g) => g.cat.id === openCatalogueId) : undefined
  const openLots = openGroup ? (query ? openGroup.lots.filter((l) => matchesLot(l, query)) : openGroup.lots) : []

  const changeTab = (v: TabKey) => { setTab(v); setOpenCatalogueId(null) }

  const emptyCopy: Record<TabKey, { title: string; body: string }> = {
    upcoming: { title: 'No upcoming lots', body: 'Lots you list appear here while they move through inspection and approval, ahead of going live.' },
    live: { title: 'Nothing live right now', body: 'Lots currently open for bidding will appear here.' },
    pending: { title: 'Nothing to settle', body: 'Sold, STA and unsold lots appear here once their auction closes, until every decision is made and any commission is settled.' },
    history: { title: 'No settlements yet', body: 'Auctions move here once you’ve decided on every sold lot and settled ferroBid’s commission — a full record of completed work.' },
  }

  return (
    <Page>
      <PageHeader
        title="Lot settlement"
        sub="Review the cleared price on every sold lot, agree or dispute it, and settle ferroBid's commission — 10% of the upside over your reserve. Completed auctions move to History."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Awaiting your decision" value={pendingUndecided.length} tone={pendingUndecided.length ? 'warning' : 'success'} />
        <Stat label="Lots accepted" value={pendingAccepted.length} tone="success" sub={`of ${pendingSold.length} sold lots`} />
        <Stat label="Commission payable" value={inrCompact(pendingCommission)} tone="ember" sub="10% of upside, accepted lots" />
      </div>

      <Tabs<TabKey>
        value={tab}
        onChange={changeTab}
        tabs={[
          { key: 'upcoming', label: <span className="inline-flex items-center gap-1.5"><Clock size={13} /> Upcoming</span>, count: sumLots(allGroups.upcoming) },
          { key: 'live', label: <span className="inline-flex items-center gap-1.5"><Radio size={13} /> Live</span>, count: sumLots(allGroups.live) },
          { key: 'pending', label: <span className="inline-flex items-center gap-1.5"><Hourglass size={13} /> Pending settlement</span>, count: sumLots(allGroups.pending) },
          { key: 'history', label: <span className="inline-flex items-center gap-1.5"><HistoryIcon size={13} /> History</span>, count: sumLots(allGroups.history) },
        ]}
      />

      <div className="card p-3 flex flex-wrap items-center gap-2 mt-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input
            className="h-9 w-72 pl-8 text-[13px]"
            placeholder="Search auction code/title, lot number or grade…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span className="num text-xs text-ink-faint ml-auto">
          {openGroup
            ? `${openLots.length} lot${openLots.length !== 1 ? 's' : ''} in ${openGroup.cat.code}`
            : `${visibleCatalogues.length} auction${visibleCatalogues.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {openGroup ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setOpenCatalogueId(null)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink mb-4"
          >
            <ArrowLeft size={15} /> All auctions
          </button>
          <SettlementGroup
            cat={openGroup.cat}
            lots={openLots}
            info={openGroup.info}
            tab={tab}
            sellerPhone={me?.phone}
            settlementAccount={settlementAccount}
            onDecide={setSellerLotDecision}
            onSettle={(amount, mode) => {
              recordCommissionSettlement(openGroup.cat.id, amount, mode)
              pushToast({
                kind: 'success',
                title: mode === 'emd' ? 'Settled from EMD' : 'Payment successful',
                body: mode === 'emd'
                  ? `${inr(amount)} commission deducted for ${openGroup.cat.code} — balance is on its way to you.`
                  : `${inr(amount)} paid to ferroBid for ${openGroup.cat.code} by bank transfer.`,
              })
              // Once every sold lot is decided, this settlement finishes the auction — hop to History to show it landing there.
              if (openGroup.info.undecided.length === 0) setTab('history')
            }}
          />
        </div>
      ) : visibleCatalogues.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={emptyCopy[tab].title} body={emptyCopy[tab].body} />
        </div>
      ) : (
        <div className="card divide-y divide-line mt-6 overflow-hidden">
          {visibleCatalogues.map((g) => (
            <CatalogueRow key={g.cat.id} group={g} tab={tab} onOpen={() => setOpenCatalogueId(g.cat.id)} />
          ))}
        </div>
      )}
    </Page>
  )
}

/* ------------------------------ Auction list row ---------------------------- */
function CatalogueRow({ group, tab, onOpen }: { group: CatalogueGroup; tab: TabKey; onOpen: () => void }) {
  const { cat, lots, info } = group

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full text-left px-5 py-4 flex flex-wrap items-center gap-4 hover:bg-surface-2/60 transition-colors"
    >
      <div className="flex-1 min-w-60">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="num text-xs font-bold text-ember">{cat.code}</span>
          <StatusChip status={cat.status} />
          {tab === 'pending' && info.undecided.length > 0 && <Chip tone="warning">{info.undecided.length} awaiting decision</Chip>}
          {tab === 'history' && <Chip tone="success"><CheckCircle2 size={11} /> Settled</Chip>}
        </div>
        <div className="font-display font-bold mt-0.5">{cat.title}</div>
        <div className="text-xs text-ink-muted mt-0.5">{cat.region}</div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Lots</div>
        <div className="num font-bold">{lots.length}</div>
      </div>

      {tab === 'pending' && (
        <>
          <div className="text-right shrink-0 hidden sm:block">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Accepted</div>
            <div className="num font-bold text-success">{info.accepted.length}/{info.sold.length}</div>
          </div>
          <div className="text-right shrink-0 w-32 hidden md:block">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Commission</div>
            <div className="num font-bold text-ember">{inrCompact(info.totalCommission)}</div>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="text-right shrink-0 w-40 hidden sm:block">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            {info.record ? (info.record.mode === 'emd' ? 'Netted from EMD' : 'Paid by transfer') : 'Commission'}
          </div>
          <div className="num font-bold text-success">{info.record ? inrCompact(info.record.amount) : info.totalCommission > 0 ? inrCompact(info.totalCommission) : 'None owed'}</div>
        </div>
      )}

      <ChevronRight size={18} className="text-ink-faint shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-ember" />
    </button>
  )
}

/* --------------------------- Seller decision toggle ------------------------ */
function DecisionToggle({ lot, onDecide, readOnly }: {
  lot: Lot; onDecide: (lotId: string, d: 'accepted' | 'rejected' | null) => void; readOnly?: boolean
}) {
  const decidable = lot.status === 'sold' || lot.status === 'sta'
  if (!decidable) return <span className="text-ink-faint text-xs">—</span>
  const decision = lot.sellerDecision ?? null

  if (readOnly) {
    if (decision === 'accepted') return <Chip tone="success" className="num"><Check size={12} /> Accepted</Chip>
    if (decision === 'rejected') return <Chip tone="danger" className="num"><X size={12} /> Rejected</Chip>
    return <span className="text-ink-faint text-xs">—</span>
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        title="Accept buyer's price"
        aria-label="Accept buyer's price"
        aria-pressed={decision === 'accepted'}
        onClick={() => onDecide(lot.id, decision === 'accepted' ? null : 'accepted')}
        className={cx(
          'size-7 rounded-lg border grid place-items-center transition-colors',
          decision === 'accepted' ? 'bg-success text-white border-success' : 'border-line-strong text-ink-faint hover:border-success/50 hover:text-success',
        )}
      >
        <Check size={15} strokeWidth={2.75} />
      </button>
      <button
        type="button"
        title="Reject buyer's price"
        aria-label="Reject buyer's price"
        aria-pressed={decision === 'rejected'}
        onClick={() => onDecide(lot.id, decision === 'rejected' ? null : 'rejected')}
        className={cx(
          'size-7 rounded-lg border grid place-items-center transition-colors',
          decision === 'rejected' ? 'bg-danger text-white border-danger' : 'border-line-strong text-ink-faint hover:border-danger/50 hover:text-danger',
        )}
      >
        <X size={15} strokeWidth={2.75} />
      </button>
    </div>
  )
}

/* ----------------------------- Auction detail card --------------------------- */
function SettlementGroup({ cat, lots, info, tab, sellerPhone, settlementAccount, onDecide, onSettle }: {
  cat: Catalogue; lots: Lot[]; info: SettlementInfo; tab: TabKey
  sellerPhone?: string
  settlementAccount?: CompanyBankAccount
  onDecide: (lotId: string, d: 'accepted' | 'rejected' | null) => void
  onSettle: (amount: number, mode: SettleMode) => void
}) {
  const { sold, accepted, totalCommission, grossAccepted, record } = info
  const readOnly = tab === 'history'

  const [mode, setMode] = useState<SettleMode>('transfer')
  const [amount, setAmount] = useState(String(Math.round(totalCommission)))
  const [dirty, setDirty] = useState(false)
  const shownAmount = dirty ? amount : String(Math.round(totalCommission))
  const [showTransfer, setShowTransfer] = useState(false)
  const [showEmd, setShowEmd] = useState(false)

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-60">
          <span className="num text-xs font-bold text-ember">{cat.code}</span>
          <div className="font-display font-bold">{cat.title}</div>
        </div>
        <StatusChip status={cat.status} />
        {readOnly && <Chip tone="success"><CheckCircle2 size={12} /> Settled</Chip>}
        <Chip tone="neutral">{lots.length} lot{lots.length !== 1 ? 's' : ''}</Chip>
      </div>

      {lots.length === 0 ? (
        <div className="p-8"><EmptyState title="No lots match your search" body="Try a different lot number or grade." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-line">
                <th className="px-5 py-2.5">Lot</th>
                <th className="px-4 py-2.5 text-center">Agree to price?</th>
                <th className="px-4 py-2.5 text-right">Your expected amount</th>
                <th className="px-4 py-2.5 text-right">ferroBid sold amount</th>
                <th className="px-4 py-2.5 text-right">Upper value</th>
                <th className="px-5 py-2.5 text-right">ferroBid commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lots.map((l) => {
                const uv = upperValue(l)
                const cm = commissionFor(l)
                return (
                  <tr key={l.id} className="hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="num font-bold">{l.lotNo}</span>
                        <Chip tone="steel">{l.metal}</Chip>
                        <StatusChip status={l.status} />
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">{l.grade} · {num(l.indicativeQty)} {l.uom}</div>
                    </td>
                    <td className="px-4 py-3 text-center"><DecisionToggle lot={l} onDecide={onDecide} readOnly={readOnly} /></td>
                    <td className="px-4 py-3 num text-right text-ink-muted" title={`${inr(l.reserveRate)} / ${l.uom}`}>{inrCompact(expectedAmount(l))}</td>
                    <td className="px-4 py-3 num text-right font-semibold">
                      {l.resultH1Rate != null
                        ? <span title={`${inr(l.resultH1Rate)} / ${l.uom}`}>{inrCompact(soldAmount(l)!)}</span>
                        : l.status === 'live' && l.currentRate
                          ? <span className="text-ink-faint" title={`${inr(l.currentRate)} / ${l.uom}`}>{inrCompact(l.currentRate * l.indicativeQty)} <span className="text-[10px] font-normal">(live)</span></span>
                          : '—'}
                    </td>
                    <td className={cx('px-4 py-3 num text-right font-semibold', uv != null && uv < 0 ? 'text-danger' : uv != null && uv > 0 ? 'text-success' : 'text-ink-faint')}>
                      {uv != null ? inrCompact(uv) : '—'}
                    </td>
                    <td className="px-5 py-3 num text-right font-bold text-ember">{cm != null ? inrCompact(cm) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pending' && sold.length > 0 && (
        <div className="border-t border-line bg-gradient-to-r from-ember-soft/40 via-surface-2/60 to-surface-2/60 px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Commission payable to ferroBid</div>
              <div className="num text-xl font-bold text-ember mt-0.5">{inrCompact(totalCommission)}</div>
              <div className="text-xs text-ink-muted mt-0.5">{accepted.length} of {sold.length} sold lot{sold.length !== 1 ? 's' : ''} accepted · 10% of upside over reserve</div>
            </div>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <Segmented<SettleMode>
                value={mode}
                onChange={setMode}
                options={[
                  { key: 'transfer', label: <span className="inline-flex items-center gap-1.5"><Landmark size={13} /> Pay by transfer</span> },
                  { key: 'emd', label: <span className="inline-flex items-center gap-1.5"><WalletIcon size={13} /> Cut from EMD</span> },
                ]}
              />
              {mode === 'transfer' && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">₹</span>
                  <Input
                    className="h-10 w-36 pl-7 num"
                    inputMode="numeric"
                    value={shownAmount}
                    onChange={(e) => { setDirty(true); setAmount(e.target.value.replace(/[^\d]/g, '')) }}
                    aria-label="Amount to pay ferroBid"
                  />
                </div>
              )}
              <Button
                disabled={accepted.length === 0 || (mode === 'transfer' && Number(shownAmount) <= 0)}
                onClick={() => (mode === 'emd' ? setShowEmd(true) : setShowTransfer(true))}
              >
                {mode === 'emd' ? 'Settle (cut from EMD)' : 'Settle payment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && sold.length > 0 && (
        <div className="border-t border-line bg-success-soft/50 px-5 py-4">
          <div className="flex items-center gap-3.5">
            <div className="size-9 rounded-xl bg-success text-white grid place-items-center shrink-0"><CheckCircle2 size={18} /></div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Settlement complete</div>
              {record ? (
                <>
                  <div className="num text-lg font-bold text-success mt-0.5">
                    {inrCompact(record.amount)} {record.mode === 'emd' ? 'netted from your EMD' : 'paid to ferroBid by transfer'}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">Settled {fmtDate(record.at)} · {accepted.length} of {sold.length} sold lot{sold.length !== 1 ? 's' : ''} accepted</div>
                </>
              ) : (
                <div className="text-sm text-ink-muted mt-0.5">No commission owed — {accepted.length} of {sold.length} sold lot{sold.length !== 1 ? 's' : ''} accepted, all decisions final.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'pending' && (
        <>
          <TransferPaymentModal
            open={showTransfer}
            onClose={() => setShowTransfer(false)}
            amount={Number(shownAmount) || totalCommission}
            catCode={cat.code}
            phone={sellerPhone}
            settlementAccount={settlementAccount}
            onDone={() => onSettle(Number(shownAmount) || totalCommission, 'transfer')}
          />
          <EmdSettleModal
            open={showEmd}
            onClose={() => setShowEmd(false)}
            gross={grossAccepted}
            commission={totalCommission}
            catCode={cat.code}
            onDone={() => onSettle(totalCommission, 'emd')}
          />
        </>
      )}
    </div>
  )
}
