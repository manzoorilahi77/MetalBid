/* ---------------------------------------------------------------------------
   Finance Administrator — invoices & receipts.

   GST and TCS are computed on every delivery order and were never issued as a
   document to either side. Buyers cannot claim input credit against a figure on
   a web page, and sellers have no receipt for the commission they paid us.

   Two rules make this a register rather than a form.

   Nothing on a document is typed. The taxable value, the GST and the TCS all
   come off the delivery order they belong to, so an invoice cannot disagree with
   the sale it represents.

   A correction supersedes rather than overwrites. Reissuing produces a new
   number that points back at the original, and the original stays visible marked
   superseded — a tax document that can be silently edited is not a record.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Ban, Download, FileText, Plus, Receipt, RefreshCw, Search,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, fmtDate, fmtDateTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { doDue } from '../../lib/money'
import { MoneyStat, QueueStrip, ScopeNote, SectionTitle } from './shared'
import type { Invoice } from '../../types'

type Tab = 'buyer' | 'commission' | 'missing'

/* ---------------------------- issue an invoice ------------------------------ */
/** Only ever issued *against an existing record*, so there is nothing to type
 *  beyond which record it is. */
function IssueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const invoices = useStore((s) => s.invoices)
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const cfg = useStore((s) => s.financeConfig)
  const issueInvoice = useStore((s) => s.issueInvoice)
  const pushToast = useStore((s) => s.pushToast)

  const [doId, setDoId] = useState('')
  const invoicedDoIds = new Set(invoices.filter((i) => i.status !== 'cancelled').map((i) => i.doId))
  const candidates = deliveryOrders.filter((d) => d.paidAmount > 0 && !invoicedDoIds.has(d.id))
  const picked = deliveryOrders.find((d) => d.id === doId)
  const buyer = users.find((u) => u.id === picked?.buyerId)
  const lot = lots.find((l) => l.id === picked?.lotId)

  const submit = () => {
    if (!picked) return
    const rec = issueInvoice({
      kind: 'buyer_invoice', partyId: picked.buyerId, catalogueId: picked.catalogueId,
      lotId: picked.lotId, doId: picked.id,
      taxable: picked.materialValue, gst: picked.gstAmount, tcs: picked.tcsAmount,
    })
    pushToast({ kind: 'success', title: 'Invoice issued', body: `${rec?.number ?? 'The document'} for ${inr(doDue(picked))} has gone to ${buyer?.firm ?? 'the buyer'}.` })
    setDoId(''); onClose()
  }

  return (
    <Modal open={open} onClose={() => { setDoId(''); onClose() }} title="Issue a buyer invoice">
      <div className="space-y-4">
        {candidates.length === 0 ? (
          <div className="card bg-surface-2 border-0 p-4 text-sm text-ink-muted">
            Every paid delivery order already has an invoice against it. Documents are only ever issued against a real
            sale — there is nothing to raise by hand.
          </div>
        ) : (
          <>
            <Field label="Which delivery order" hint="Only paid orders without a live invoice appear here.">
              <Select value={doId} onChange={(e) => setDoId(e.target.value)}>
                <option value="">Choose…</option>
                {candidates.map((d) => {
                  const l = lots.find((x) => x.id === d.lotId)
                  const u = users.find((x) => x.id === d.buyerId)
                  return <option key={d.id} value={d.id}>{l?.lotNo ?? d.id} — {u?.firm} — {inr(doDue(d))}</option>
                })}
              </Select>
            </Field>

            {picked && (
              <div className="card bg-surface-2 border-0 p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={buyer?.name ?? '?'} hue={buyer?.avatarHue ?? 200} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{buyer?.firm}</div>
                    <div className="text-xs text-ink-muted">{lot?.lotNo} · {lot?.metal} {lot?.grade}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 mt-3 pt-3 border-t border-line text-[13px]">
                  <span className="text-ink-muted">Taxable value</span><span className="num text-right font-semibold">{inr(picked.materialValue)}</span>
                  <span className="text-ink-muted">GST @ {cfg.gstPct}%</span><span className="num text-right font-semibold">{inr(picked.gstAmount)}</span>
                  <span className="text-ink-muted">TCS @ {cfg.tcsPct}%</span><span className="num text-right font-semibold">{inr(picked.tcsAmount)}</span>
                  <span className="font-bold pt-1.5 border-t border-line">Total</span>
                  <span className="num text-right font-bold pt-1.5 border-t border-line">{inr(doDue(picked))}</span>
                </div>
                <p className="text-[11px] text-ink-faint mt-2">
                  Every figure comes off the delivery order. Nothing on this document can be typed.
                </p>
              </div>
            )}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setDoId(''); onClose() }}>Cancel</Button>
          <Button disabled={!picked} onClick={submit}>Issue invoice</Button>
        </div>
      </div>
    </Modal>
  )
}

/* --------------------------------- page ------------------------------------ */
export default function Invoices() {
  const now = useNow()
  const invoices = useStore((s) => s.invoices)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const cfg = useStore((s) => s.financeConfig)
  const reissue = useStore((s) => s.reissueInvoice)
  const cancelInvoice = useStore((s) => s.cancelInvoice)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('buyer')
  const [q, setQ] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [amend, setAmend] = useState<{ invoice: Invoice; mode: 'reissue' | 'cancel' } | null>(null)
  const [note, setNote] = useState('')

  const buyerInvoices = invoices.filter((i) => i.kind === 'buyer_invoice')
  const receipts = invoices.filter((i) => i.kind === 'commission_receipt')
  const invoicedDoIds = new Set(invoices.filter((i) => i.status !== 'cancelled').map((i) => i.doId))
  const missing = deliveryOrders.filter((d) => d.paidAmount > 0 && !invoicedDoIds.has(d.id))

  const shown = useMemo(() => {
    const base = tab === 'buyer' ? buyerInvoices : tab === 'commission' ? receipts : []
    const query = q.trim().toLowerCase()
    return base
      .filter((i) => {
        if (!query) return true
        const u = users.find((x) => x.id === i.partyId)
        return i.number.toLowerCase().includes(query) || (u?.firm ?? '').toLowerCase().includes(query)
      })
      .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
  }, [tab, buyerInvoices, receipts, q, users])

  const exportRegister = () => {
    const rows = [
      ['Number', 'Type', 'Party', 'Auction', 'Issued', 'Taxable', 'GST', 'TCS', 'Total', 'Status'],
      ...invoices.map((i) => [
        i.number,
        i.kind === 'buyer_invoice' ? 'Buyer invoice' : 'Commission receipt',
        (users.find((u) => u.id === i.partyId)?.firm ?? i.partyId).replace(/,/g, ' '),
        catalogues.find((c) => c.id === i.catalogueId)?.code ?? '',
        fmtDate(i.issuedAt), i.taxable, i.gst, i.tcs, i.total, i.status,
      ]),
    ]
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'ferrobid-invoice-register.csv'
    a.click()
    URL.revokeObjectURL(url)
    pushToast({ kind: 'success', title: 'Register exported', body: `${num(invoices.length)} documents, ready for the auditor.` })
  }

  const doAmend = () => {
    if (!amend) return
    if (amend.mode === 'reissue') {
      reissue(amend.invoice.id, note.trim())
      pushToast({ kind: 'success', title: 'Document reissued', body: `${amend.invoice.number} is now marked superseded and stays on the register.` })
    } else {
      cancelInvoice(amend.invoice.id, note.trim())
      pushToast({ kind: 'info', title: 'Document cancelled', body: 'It stays on the register, marked cancelled with your reason.' })
    }
    setAmend(null); setNote('')
  }

  const totalGst = invoices.filter((i) => i.status === 'issued').reduce((s, i) => s + i.gst, 0)
  const totalTcs = invoices.filter((i) => i.status === 'issued').reduce((s, i) => s + i.tcs, 0)

  return (
    <Page>
      <PageHeader
        title="Invoices &amp; receipts"
        sub="The documents behind every rupee — buyer tax invoices and seller commission receipts. Generated from the records, never typed."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportRegister}><Download size={14} /> Export register</Button>
            <Button size="sm" onClick={() => setIssuing(true)}><Plus size={15} /> Issue an invoice</Button>
          </>
        }
      />

      <QueueStrip steps={[
        { label: 'Buyer invoices', count: buyerInvoices.length, onClick: () => setTab('buyer'), active: tab === 'buyer' },
        { label: 'Commission receipts', count: receipts.length, onClick: () => setTab('commission'), active: tab === 'commission' },
        { label: 'Paid orders with no invoice', count: missing.length, urgent: missing.length > 0, onClick: () => setTab('missing'), active: tab === 'missing' },
        { label: 'Superseded or cancelled', count: invoices.filter((i) => i.status !== 'issued').length },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyStat label="Invoiced value" amount={invoices.filter((i) => i.status === 'issued' && i.kind === 'buyer_invoice').reduce((s, i) => s + i.total, 0)} tone="plain" sub={`${num(buyerInvoices.length)} buyer invoices`} />
        <MoneyStat label="GST charged" amount={totalGst} tone="plain" sub={`at ${cfg.gstPct}%`} />
        <MoneyStat label="TCS collected" amount={totalTcs} tone="plain" sub={`u/s 206C(1H) at ${cfg.tcsPct}%`} />
        <MoneyStat label="Commission receipted" amount={receipts.filter((i) => i.status === 'issued').reduce((s, i) => s + i.total, 0)} tone="in" sub={`${num(receipts.length)} receipts to sellers`} to="/finance/commission" />
      </div>

      {tab === 'missing' ? (
        <>
          <SectionTitle
            title="Paid, but never documented"
            count={missing.length}
            sub="The buyer has paid and there is no invoice against it. Until there is, they cannot claim input credit on the GST they were charged."
          />
          {missing.length === 0 ? (
            <EmptyState
              icon={<Receipt size={32} strokeWidth={1.5} />}
              title="Every paid order has its document"
              body="Invoices are issued automatically when Finance records a receipt on the payments screen — this list stays empty in normal operation."
            />
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {missing.map((d) => {
                const u = users.find((x) => x.id === d.buyerId)
                const l = lots.find((x) => x.id === d.lotId)
                return (
                  <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                    <Avatar name={u?.name ?? '?'} hue={u?.avatarHue ?? 200} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{u?.firm ?? d.buyerId}</div>
                      <div className="text-[12px] text-ink-muted num">{l?.lotNo} · paid {fmtDate(d.createdAt)}</div>
                    </div>
                    <div className="num text-sm font-bold tabular-nums shrink-0">{inr(doDue(d))}</div>
                    <Button size="sm" onClick={() => setIssuing(true)}>Issue <ArrowRight size={13} /></Button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <SectionTitle
            title={tab === 'buyer' ? 'Buyer tax invoices' : 'Commission receipts'}
            count={shown.length}
            sub={tab === 'buyer'
              ? 'Material value plus GST and TCS, exactly as they were computed on the delivery order.'
              : 'Issued to a seller the moment Finance confirms their commission arrived.'}
            action={
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                <Input className="h-9 w-56 pl-9" placeholder="Number or firm…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            }
          />

          {shown.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} strokeWidth={1.5} />}
              title={q ? 'Nothing matches that search' : tab === 'buyer' ? 'No buyer invoices yet' : 'No commission receipts yet'}
              body={tab === 'buyer'
                ? 'An invoice is generated when Finance records a buyer receipt on the payments screen.'
                : 'A receipt is generated when Finance confirms a seller settlement against the bank.'}
            />
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {shown.map((i) => {
                const party = users.find((u) => u.id === i.partyId)
                const cat = catalogues.find((c) => c.id === i.catalogueId)
                const lot = lots.find((l) => l.id === i.lotId)
                const supersedes = invoices.find((x) => x.id === i.supersedesId)
                return (
                  <div key={i.id} className={cx('flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors',
                    i.status !== 'issued' && 'opacity-70')}>
                    <span className={cx('size-9 rounded-xl grid place-items-center shrink-0',
                      i.kind === 'buyer_invoice' ? 'bg-steel-soft text-steel' : 'bg-success-soft text-success')}>
                      {i.kind === 'buyer_invoice' ? <FileText size={16} /> : <Receipt size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="num font-bold text-sm">{i.number}</span>
                        {i.status === 'superseded' && <Chip tone="warning">Superseded</Chip>}
                        {i.status === 'cancelled' && <Chip tone="danger">Cancelled</Chip>}
                      </div>
                      <div className="text-[12px] text-ink-muted mt-0.5 truncate">
                        {party?.firm ?? i.partyId} · <span className="num">{cat?.code}</span>{lot ? <> · <span className="num">{lot.lotNo}</span></> : null}
                      </div>
                      <div className="text-[11px] text-ink-faint mt-0.5">
                        Issued {fmtDateTime(i.issuedAt)}
                        {supersedes && <> · replaces <span className="num">{supersedes.number}</span></>}
                        {i.note && ` · ${i.note}`}
                      </div>
                    </div>
                    <div className="hidden lg:block text-right shrink-0 text-[11px] text-ink-faint num leading-relaxed">
                      <div>taxable {inr(i.taxable)}</div>
                      {(i.gst > 0 || i.tcs > 0) && <div>GST {inr(i.gst)} · TCS {inr(i.tcs)}</div>}
                    </div>
                    <div className="num text-base font-bold tabular-nums shrink-0 w-28 text-right">{inr(i.total)}</div>
                    {i.status === 'issued' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setAmend({ invoice: i, mode: 'cancel' })} title="Cancel this document">
                          <Ban size={13} />
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setAmend({ invoice: i, mode: 'reissue' })}>
                          <RefreshCw size={13} /> Reissue
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <div className="mt-8">
        <ScopeNote>
          A tax document is a record, not a form. Nothing here can be edited: a correction issues a new number that
          points back at the original, and the original stays on the register marked superseded. Rates come from
          Financial config — GST {cfg.gstPct}%, TCS {cfg.tcsPct}% — and changing them is the Super Admin's job with the
          CEO's approval, not something that can be done per invoice.
        </ScopeNote>
      </div>

      <IssueModal open={issuing} onClose={() => setIssuing(false)} />

      <Modal open={!!amend} onClose={() => { setAmend(null); setNote('') }}
        title={amend?.mode === 'reissue' ? 'Reissue this document' : 'Cancel this document'}>
        <div className="space-y-4">
          <div className={cx('card border-0 p-4 text-sm', amend?.mode === 'reissue' ? 'bg-surface-2' : 'bg-warning-soft')}>
            {amend?.mode === 'reissue' ? (
              <>A new document is created with the same figures and a number that points back at{' '}
                <span className="num font-bold">{amend?.invoice.number}</span>. The original is <strong>not deleted</strong> —
                it stays on the register marked superseded, and the party is told about both.</>
            ) : (
              <><span className="num font-bold">{amend?.invoice.number}</span> is marked cancelled and stays visible on the
                register with your reason. Use this only where the sale itself did not happen.</>
            )}
          </div>
          <Field label="Reason" hint="Printed on the document and recorded in the audit trail.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={amend?.mode === 'reissue'
                ? 'Weighment-final quantity differs from the awarded quantity — corrected taxable value…'
                : 'Sale reversed after auction cancellation…'} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setAmend(null); setNote('') }}>Cancel</Button>
            <Button variant={amend?.mode === 'reissue' ? 'primary' : 'danger'} disabled={note.trim().length < 4} onClick={doAmend}>
              {amend?.mode === 'reissue' ? 'Reissue' : 'Cancel document'}
            </Button>
          </div>
        </div>
      </Modal>

      {missing.length > 0 && tab !== 'missing' && (
        <div className="card border-l-4 border-l-warning p-4 mt-4 flex flex-wrap items-center gap-3">
          <Receipt size={18} className="text-warning shrink-0" />
          <p className="text-[13px] text-ink-muted flex-1 min-w-56">
            {num(missing.length)} paid delivery order{missing.length === 1 ? ' has' : 's have'} no invoice against{' '}
            {missing.length === 1 ? 'it' : 'them'}, worth {inr(missing.reduce((s, d) => s + doDue(d), 0))}.
          </p>
          <button onClick={() => setTab('missing')} className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1 shrink-0">
            Review them <ArrowRight size={13} />
          </button>
        </div>
      )}

      <p className="text-[12px] text-ink-faint mt-6">
        Buyers see their own invoices on{' '}
        <Link to="/buyer/auction-status" className="text-ember font-semibold hover:underline">Auction status</Link>; sellers
        see their commission receipts on{' '}
        <Link to="/seller/settlement" className="text-ember font-semibold hover:underline">Settlement</Link>. Last register
        export reflects {num(invoices.length)} documents as at {fmtDateTime(new Date(now).toISOString())}.
      </p>
    </Page>
  )
}
