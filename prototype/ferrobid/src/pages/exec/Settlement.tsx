import { Banknote, Receipt, ArrowRight, CheckCircle2, Undo2 } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Btn, Badge, Empty, LotImage } from '../../components/ui';
import { inr } from '../../utils';
import { cx } from '../../utils';

export default function Settlement() {
  const { settlements, lots, confirmPayment, handleEmd, generateInvoice, handoffToLogistics, logistics } = useApp();
  const active = settlements.filter((s) => {
    const lot = lots.find((l) => l.id === s.lotId);
    return lot && ['won', 'in_settlement'].includes(lot.status);
  });
  const done = settlements.filter((s) => !active.includes(s));

  const Step = ({ done: d, label, action, onClick }: { done: boolean; label: string; action: string; onClick: () => void }) => (
    <div className={cx('flex items-center justify-between gap-3 rounded-xl border px-4 py-3', d ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white')}>
      <div className="flex items-center gap-2.5 text-sm">
        <CheckCircle2 size={17} className={d ? 'text-emerald-500' : 'text-slate-300'} />
        <span className={cx('font-semibold', d ? 'text-emerald-800' : 'text-slate-600')}>{label}</span>
      </div>
      {!d && <Btn size="sm" variant="primary" onClick={onClick}>{action}</Btn>}
    </div>
  );

  return (
    <div>
      <SectionTitle title="Settlement" sub="Confirm winner payments, process EMDs, issue invoices and hand off to logistics" />
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
                  <div className="text-[11px] font-bold text-slate-400">{s.id} · {lot.id} · {s.auctionId}</div>
                  <div className="text-sm font-bold text-steel-950">{lot.title}</div>
                  <div className="text-xs text-slate-400">Winner: <b className="text-steel-900">{s.winnerName}</b></div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Settlement value</div>
                  <div className="text-lg font-extrabold text-steel-950">{inr(s.amount)}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                <Step done={s.paymentConfirmed} label="Winner payment received" action="Confirm (mock)" onClick={() => confirmPayment(s.id)} />
                <Step done={s.emdHandled} label="EMD release / forfeit" action="Process" onClick={() => handleEmd(s.id)} />
                <Step done={s.invoiceGenerated} label="Invoice & receipt" action="Generate" onClick={() => generateInvoice(s.id)} />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="text-xs text-slate-400 flex items-center gap-1.5"><Undo2 size={13} /> Losing bidders' EMDs auto-refund on auction close; defaulters forfeit.</div>
                <Btn variant="accent" disabled={!complete || alreadyInLogistics} onClick={() => handoffToLogistics(s.id)}>
                  Hand off to logistics <ArrowRight size={15} />
                </Btn>
              </div>
            </Card>
          );
        })}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-bold text-steel-950">Completed settlements</h2>
          <div className="space-y-2">
            {done.map((s) => {
              const lot = lots.find((l) => l.id === s.lotId);
              return (
                <Card key={s.id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <Banknote size={17} className="text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-bold text-steel-950">{lot?.title}</span>
                    <span className="ml-2 text-xs text-slate-400">{s.id} · {s.winnerName}</span>
                  </div>
                  <span className="text-sm font-extrabold text-steel-900">{inr(s.amount)}</span>
                  <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200"><Receipt size={11} /> Settled</Badge>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
