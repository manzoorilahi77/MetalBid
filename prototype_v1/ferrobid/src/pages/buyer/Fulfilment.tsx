import { Truck, Banknote, PackageCheck, CalendarClock } from 'lucide-react';
import { useApp, DEMO_USER_ID } from '../../store';
import { SectionTitle, Card, Badge, Empty, LifecycleTracker, LotImage } from '../../components/ui';
import { inr } from '../../utils';
import { STATUS_LABEL } from '../../lifecycle';

export default function Fulfilment() {
  const { auctions, lots, settlements, logistics } = useApp();
  const wonRows = auctions
    .filter((a) => a.status === 'closed' && a.leaderId === DEMO_USER_ID)
    .map((a) => {
      const lot = lots.find((l) => l.id === a.lotId)!;
      const st = settlements.find((s) => s.auctionId === a.id);
      const lg = logistics.find((x) => x.lotId === a.lotId);
      return { a, lot, st, lg };
    });

  return (
    <div>
      <SectionTitle title="Fulfilment Tracker" sub="Follow your won lots from settlement to pickup" />
      {wonRows.length === 0 && <Empty title="No won lots yet" sub="Win an auction and its settlement → logistics → handover journey appears here." />}
      <div className="space-y-4">
        {wonRows.map(({ a, lot, st, lg }) => (
          <Card key={a.id} className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              <LotImage hues={lot.imageHues} label={lot.metal} className="h-16 w-24 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-faint">{lot.id} · won at {inr(a.currentBid)}</div>
                <div className="text-sm font-bold text-ink">{lot.title}</div>
                <Badge tone="bg-violet-50 dark:bg-violet-400/10 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-400/25" className="mt-1">{STATUS_LABEL[lot.status]}</Badge>
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <LifecycleTracker status={lot.status} compact />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-surface-2 p-3.5 ring-1 ring-line">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-faint"><Banknote size={12} /> Settlement</div>
                <div className="mt-1.5 space-y-1 text-xs text-muted">
                  <div>{st?.paymentConfirmed ? '✅ Payment confirmed' : '⏳ Payment verification pending'}</div>
                  <div>{st?.invoiceGenerated ? '✅ Invoice issued' : '⏳ Invoice pending'}</div>
                  <div className="text-faint">Balance payable: {inr(a.currentBid - a.emd)} (EMD adjusted)</div>
                </div>
              </div>
              <div className="rounded-xl bg-surface-2 p-3.5 ring-1 ring-line">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-faint"><CalendarClock size={12} /> Pickup</div>
                <div className="mt-1.5 space-y-1 text-xs text-muted">
                  {lg?.pickupDate ? (
                    <>
                      <div>📅 {lg.pickupDate} · {lg.slot}</div>
                      <div>🚚 {lg.handler}</div>
                    </>
                  ) : (
                    <div>⏳ Pickup will be scheduled after settlement</div>
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-surface-2 p-3.5 ring-1 ring-line">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-faint"><PackageCheck size={12} /> Handover</div>
                <div className="mt-1.5 space-y-1 text-xs text-muted">
                  {lg?.status === 'completed'
                    ? <div>✅ Completed with proof — lot closed</div>
                    : lg?.status === 'in_transit'
                    ? <div className="flex items-center gap-1"><Truck size={12} className="text-blue-500" /> Vehicle in transit</div>
                    : <div>⏳ Awaiting pickup completion</div>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
