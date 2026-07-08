import type { ReactNode } from 'react';
import { Banknote, Receipt, ArrowRight, CheckCircle2, Undo2 } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, Empty, LotImage } from '../../components/ui';
import { GatedBtn, ScopeBadge } from '../../components/gate';
import { inr } from '../../utils';
import { cx } from '../../utils';

export default function Settlement() {
  const { settlements, lots, confirmPayment, handleEmd, generateInvoice, handoffToLogistics, logistics } = useApp();
  const active = settlements.filter((s) => {
    const lot = lots.find((l) => l.id === s.lotId);
    return lot && ['won', 'in_settlement'].includes(lot.status);
  });
  const done = settlements.filter((s) => !active.includes(s));

  const Step = ({ done: d, label, button }: { done: boolean; label: string; button: ReactNode }) => (
    <div className={cx('flex items-center justify-between gap-3 rounded-xl border px-4 py-3', d ? 'border-emerald-200 dark:border-emerald-400/25 bg-emerald-50/60 dark:bg-emerald-400/10' : 'border-line bg-surface')}>
      <div className="flex items-center gap-2.5 text-sm">
        <CheckCircle2 size={17} className={d ? 'text-emerald-500' : 'text-faint'} />
        <span className={cx('font-semibold', d ? 'text-emerald-800 dark:text-emerald-200' : 'text-muted')}>{label}</span>
      </div>
      {!d && button}
    </div>
  );

  return (
    <div>
      <SectionTitle title="Settlement" sub="Confirm winner payments, process EMDs, issue invoices and hand off to logistics" right={<ScopeBadge module="settlement" />} />
      {active.length === 0 && <Empty title="No settlements in progress" sub="Won auctions land here for payment confirmation." />}

      <div className="space-y-4">
        {active.map((s) => {
          const lot = lots.find((l) => l.id === s.lotId)!;
          const complete = s.paymentConfirmed && s.emdHandled && s.invoiceGenerated;
          const alreadyInLogistics = logistics.some((x) => x.lotId === s.lotId);
          return (
            <Card key={s.id} className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <LotImage hues={lot.imageHues} label={lot.metal} className="h-14 w-20 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-faint">{s.id} · {lot.id} · {s.auctionId}</div>
                  <div className="text-sm font-bold text-ink">{lot.title}</div>
                  <div className="text-xs text-faint">Winner: <b className="text-ink">{s.winnerName}</b></div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase text-faint">Settlement value</div>
                  <div className="text-lg font-extrabold text-ink">{inr(s.amount)}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                <Step done={s.paymentConfirmed} label="Winner payment received"
                  button={<GatedBtn module="settlement" value={s.amount} onAllowed={() => confirmPayment(s.id)}>Confirm (mock)</GatedBtn>} />
                <Step done={s.emdHandled} label="EMD release / forfeit"
                  button={
                    <GatedBtn module="settlement" risky value={s.amount} onAllowed={() => handleEmd(s.id)}
                      approval={{ type: 'emd_forfeit', title: `EMD release/forfeit — ${s.id}`, detail: `Process EMDs for ${lot.title}: refund losers, forfeit defaulters (settlement value ${inr(s.amount)}).`, refId: s.id }}>
                      Process
                    </GatedBtn>
                  } />
                <Step done={s.invoiceGenerated} label="Invoice & receipt"
                  button={<GatedBtn module="settlement" value={s.amount} onAllowed={() => generateInvoice(s.id)}>Generate</GatedBtn>} />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <div className="text-xs text-faint flex items-center gap-1.5"><Undo2 size={13} /> Losing bidders' EMDs auto-refund on auction close; defaulters forfeit.</div>
                <GatedBtn module="settlement" value={s.amount} variant="accent" size="md" disabled={!complete || alreadyInLogistics} onAllowed={() => handoffToLogistics(s.id)}>
                  Hand off to logistics <ArrowRight size={15} />
                </GatedBtn>
              </div>
            </Card>
          );
        })}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-bold text-ink">Completed settlements</h2>
          <div className="space-y-2">
            {done.map((s) => {
              const lot = lots.find((l) => l.id === s.lotId);
              return (
                <Card key={s.id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <Banknote size={17} className="text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-bold text-ink">{lot?.title}</span>
                    <span className="ml-2 text-xs text-faint">{s.id} · {s.winnerName}</span>
                  </div>
                  <span className="text-sm font-extrabold text-ink">{inr(s.amount)}</span>
                  <Badge tone="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25"><Receipt size={11} /> Settled</Badge>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
