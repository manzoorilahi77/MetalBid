import { useState } from 'react';
import { FileSignature, Send, CheckCircle2, XCircle, Rotate3d, Ban, History, ArrowRight } from 'lucide-react';
import { useApp, MAX_SETTLEMENT_ROUNDS } from '../../store';
import { SectionTitle, Card, Btn, Field, inputCls, Badge, Empty, LotImage, Toggle } from '../../components/ui';
import { GatedBtn, ScopeBadge } from '../../components/gate';
import { inr } from '../../utils';

const AL_TONE: Record<string, string> = {
  draft: 'tone-slate',
  sent: 'tone-amber',
  seller_approved: 'tone-sky',
  seller_rejected: 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-400/25',
  buyer_approved: 'tone-emerald',
  buyer_rejected: 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-400/25',
  superseded: 'tone-slate',
};

export default function SettlementDesk() {
  const {
    lots, users, approvalLetters, settlementRounds,
    generateApprovalLetter, sendApprovalLetter, respondToApprovalLetter,
    recordSettlementRound, reAuctionLot, cancelAndRefund, generateDeliveryLetter,
  } = useApp();
  const [escalateFor, setEscalateFor] = useState<string | null>(null);
  const [askAmount, setAskAmount] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [confirmationRef, setConfirmationRef] = useState('');
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const desk = lots.filter((l) => l.status === 'won' || l.status === 'in_settlement');
  const activeAL = (lotId: string) => approvalLetters.find((al) => al.lotId === lotId && al.status !== 'superseded');
  const roundsExhausted = (lotId: string) => {
    const al = activeAL(lotId);
    if (!al || al.status !== 'seller_rejected') return false;
    return settlementRounds.some((r) => r.lotId === lotId && r.round === al.round && r.bidderId === al.bidderId && !r.bidderAgreed);
  };

  const openEscalate = (lotId: string, al: ReturnType<typeof activeAL>) => {
    setEscalateFor(lotId);
    setAskAmount(String(al?.amount ?? ''));
    setAgreed(true);
    setConfirmationRef('');
  };
  const submitEscalation = () => {
    const al = escalateFor && activeAL(escalateFor);
    if (!escalateFor || !al) return;
    recordSettlementRound(escalateFor, al.round, al.bidderId, Number(askAmount) || al.amount, agreed, confirmationRef);
    setEscalateFor(null);
  };

  return (
    <div>
      <SectionTitle title="Settlement Desk" sub="Approval Letter negotiation, escalation ladder, and the re-auction / cancel decision" right={<ScopeBadge module="settlement" />} />
      {desk.length === 0 && <Empty title="Nothing in settlement" sub="Lots reach here once an auction closes with a winner." />}

      <div className="space-y-4">
        {desk.map((lot) => {
          const seller = users.find((u) => u.id === lot.sellerId);
          const al = activeAL(lot.id);
          const exhausted = roundsExhausted(lot.id);
          const history = settlementRounds.filter((r) => r.lotId === lot.id).sort((a, b) => b.round - a.round);
          const bidder = al && users.find((u) => u.id === al.bidderId);

          return (
            <Card key={lot.id} className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <LotImage hues={lot.imageHues} label={lot.metal} className="h-14 w-20 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <div className="text-[11px] font-bold text-faint">{lot.id} · seller {seller?.businessName ?? seller?.name}</div>
                  <div className="text-sm font-bold text-ink">{lot.title}</div>
                </div>
                {al && <Badge tone="tone-violet">Round {al.round} / {MAX_SETTLEMENT_ROUNDS}</Badge>}
                {al && <Badge tone={AL_TONE[al.status]} className="capitalize">{al.status.replace('_', ' ')}</Badge>}
                {history.length > 0 && (
                  <button onClick={() => setHistoryFor(historyFor === lot.id ? null : lot.id)} className="flex items-center gap-1 text-[11px] font-bold text-steel-600 dark:text-steel-400 hover:underline cursor-pointer">
                    <History size={12} /> {history.length} round{history.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {historyFor === lot.id && (
                <div className="mt-3 space-y-1.5 rounded-xl bg-surface-2 p-3">
                  {history.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <Badge tone="tone-slate">Round {r.round}</Badge>
                      <span>{users.find((u) => u.id === r.bidderId)?.name ?? r.bidderId} · ask {inr(r.askAmount)}</span>
                      <Badge tone={r.bidderAgreed ? 'tone-emerald' : 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-400/25'}>{r.bidderAgreed ? 'agreed' : 'declined'}</Badge>
                      {r.confirmationRef && <span className="text-faint">· {r.confirmationRef}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 border-t border-line pt-4">
                {!al && (
                  <GatedBtn module="settlement" variant="accent" size="sm" onAllowed={() => generateApprovalLetter(lot.id)}>
                    <FileSignature size={13} /> Generate Approval Letter (round 1)
                  </GatedBtn>
                )}

                {al?.status === 'draft' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xs text-muted">Bidder <b className="text-ink">{bidder?.name ?? al.bidderId}</b> · amount <b className="text-ink">{inr(al.amount)}</b></div>
                    <GatedBtn module="settlement" variant="accent" size="sm" onAllowed={() => sendApprovalLetter(al.id)}>
                      <Send size={13} /> Send to seller & buyer
                    </GatedBtn>
                  </div>
                )}

                {al?.status === 'sent' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xs text-muted">Awaiting seller's decision on {inr(al.amount)}</div>
                    <GatedBtn module="settlement" variant="success" size="sm" onAllowed={() => respondToApprovalLetter(al.id, 'seller', 'approved')}><CheckCircle2 size={13} /> Seller approved</GatedBtn>
                    <GatedBtn module="settlement" variant="danger" size="sm" onAllowed={() => respondToApprovalLetter(al.id, 'seller', 'rejected')}>
                      <XCircle size={13} /> Seller rejected
                    </GatedBtn>
                  </div>
                )}

                {al?.status === 'seller_approved' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xs text-muted">Seller approved — awaiting buyer's decision</div>
                    <GatedBtn module="settlement" variant="success" size="sm" onAllowed={() => respondToApprovalLetter(al.id, 'buyer', 'approved')}><CheckCircle2 size={13} /> Buyer approved</GatedBtn>
                    <GatedBtn module="settlement" variant="danger" size="sm" onAllowed={() => respondToApprovalLetter(al.id, 'buyer', 'rejected')}><XCircle size={13} /> Buyer rejected</GatedBtn>
                  </div>
                )}

                {al?.status === 'seller_rejected' && !exhausted && (
                  <div>
                    <p className="mb-2 text-xs text-muted">Seller rejected round {al.round}. Record whether {bidder?.name ?? al.bidderId} agrees to a revised ask, or escalate to the next-ranked bidder.</p>
                    <GatedBtn module="settlement" variant="outline" size="sm" onAllowed={() => openEscalate(lot.id, al)}>
                      <ArrowRight size={13} /> Record negotiation outcome
                    </GatedBtn>
                  </div>
                )}

                {al?.status === 'buyer_rejected' && (
                  <div className="text-xs text-muted">Buyer rejected the Approval Letter — use re-auction or cancel &amp; refund below.</div>
                )}

                {al?.status === 'buyer_approved' && (
                  <GatedBtn module="settlement" variant="accent" size="sm" onAllowed={() => generateDeliveryLetter(lot.id, al.id)}>
                    <FileSignature size={13} /> Generate Delivery Letter
                  </GatedBtn>
                )}

                {(exhausted || al?.status === 'buyer_rejected') && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-red-50 dark:bg-red-400/10 p-3 ring-1 ring-red-200 dark:ring-red-400/25">
                    <span className="text-xs font-semibold text-red-700 dark:text-red-300">{exhausted ? `Settlement rounds exhausted (cap ${MAX_SETTLEMENT_ROUNDS}).` : 'Buyer declined.'} Manual decision required —</span>
                    <GatedBtn module="settlement" variant="outline" size="sm" onAllowed={() => reAuctionLot(lot.id)}>
                      <Rotate3d size={13} /> Re-auction
                    </GatedBtn>
                    <GatedBtn module="settlement" variant="danger" size="sm" onAllowed={() => cancelAndRefund(lot.id)}>
                      <Ban size={13} /> Cancel & refund
                    </GatedBtn>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {escalateFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-steel-950/50 backdrop-blur-[2px]" onClick={() => setEscalateFor(null)} />
          <Card className="relative w-full max-w-md p-5">
            <h3 className="mb-3 font-bold text-ink">Record negotiation outcome</h3>
            <div className="space-y-3">
              <Field label="Revised ask amount (₹)">
                <input className={inputCls} value={askAmount} onChange={(e) => setAskAmount(e.target.value.replace(/[^\d]/g, ''))} />
              </Field>
              <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                <span className="text-sm font-semibold text-ink">Bidder agreed to this ask?</span>
                <Toggle on={agreed} onChange={() => setAgreed(!agreed)} />
              </div>
              <Field label="Confirmation reference" hint="e.g. 'confirmed via email, see thread'">
                <input className={inputCls} value={confirmationRef} onChange={(e) => setConfirmationRef(e.target.value)} />
              </Field>
              <Btn variant="accent" size="lg" className="w-full" onClick={submitEscalation}>
                {agreed ? 'Confirm — resend Approval Letter to seller' : 'Decline — escalate to next bidder'}
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
