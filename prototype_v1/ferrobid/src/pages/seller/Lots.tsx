import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, AlertTriangle, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, StatusBadge, Btn, LotImage, LifecycleTracker, Empty } from '../../components/ui';
import { inrCompact, cx } from '../../utils';

const SELLER_ID = 'u-seller1';

export default function SellerLots() {
  const nav = useNavigate();
  const { lots, submitLot } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const mine = lots.filter((l) => l.sellerId === SELLER_ID);

  return (
    <div>
      <SectionTitle title="My Lots" sub="Manage listings across the full lifecycle" right={<Btn variant="accent" size="sm" onClick={() => nav('/seller/create')}>+ List a lot</Btn>} />
      {mine.length === 0 && <Empty title="No lots yet" sub="Create your first listing to start selling." />}
      <div className="space-y-3">
        {mine.map((l) => {
          const open = openId === l.id;
          return (
            <Card key={l.id} className="overflow-hidden">
              <button onClick={() => setOpenId(open ? null : l.id)} className="flex w-full items-center gap-4 p-4 text-left cursor-pointer">
                <LotImage hues={l.imageHues} className="h-14 w-20 rounded-lg shrink-0" label={l.metal} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-faint">{l.id} · listed {l.createdAt}</div>
                  <div className="truncate text-sm font-bold text-ink">{l.title}</div>
                  <div className="text-xs text-faint">{l.quantity} · base {inrCompact(l.basePrice)} · reserve {inrCompact(l.reservePrice)}</div>
                </div>
                <StatusBadge status={l.status} />
                {open ? <ChevronUp size={16} className="text-faint shrink-0" /> : <ChevronDown size={16} className="text-faint shrink-0" />}
              </button>

              <div className={cx('border-t border-line bg-surface-2/50 px-4 transition-all', open ? 'py-4' : 'hidden')}>
                <LifecycleTracker status={l.status} />
                {l.status === 'rejected' && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-400/10 px-4 py-3 ring-1 ring-red-200 dark:ring-red-400/25">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
                    <div className="text-xs text-red-700 dark:text-red-300"><b>Rejected:</b> {l.rejectReason}</div>
                  </div>
                )}
                {l.verification?.note && l.status !== 'rejected' && (
                  <div className="mt-3 rounded-xl bg-surface px-4 py-3 text-xs text-muted ring-1 ring-line">
                    <b className="text-ink">Verification note:</b> {l.verification.note} — {l.verification.decidedBy}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {l.status === 'draft' && <Btn size="sm" variant="accent" onClick={() => submitLot(l.id)}><Send size={13} /> Submit for verification</Btn>}
                  {l.status === 'rejected' && <Btn size="sm" variant="outline" onClick={() => submitLot(l.id)}><Send size={13} /> Fix & resubmit (mock)</Btn>}
                  {l.status === 'live' && <Btn size="sm" variant="accent" onClick={() => nav('/seller/monitor')}><Radio size={13} /> Watch live</Btn>}
                  {l.auctionId && <Btn size="sm" variant="outline" onClick={() => nav(`/lot/${l.id}`)}>Public lot page</Btn>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
