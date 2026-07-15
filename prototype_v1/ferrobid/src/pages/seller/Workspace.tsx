import { useNavigate } from 'react-router-dom';
import { Package, Radio, Trophy, ClipboardCheck, FilePlus2, ArrowRight, BadgeCheck, Bell } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Stat, Card, StatusBadge, Btn, LotImage, Badge } from '../../components/ui';
import { EmailTimeline } from '../../components/EmailTimeline';
import { inrCompact } from '../../utils';

const SELLER_ID = 'u-seller1';

export default function SellerWorkspace() {
  const nav = useNavigate();
  const { lots, auctions, userName, emailLogs } = useApp();
  const myLotIds = new Set(lots.filter((l) => l.sellerId === SELLER_ID).map((l) => l.id));
  const myNotifications = emailLogs.filter((l) => l.recipientRole === 'seller' && myLotIds.has(l.lotId));
  const mine = lots.filter((l) => l.sellerId === SELLER_ID);
  const liveMine = mine.filter((l) => l.status === 'live');
  const inVerification = mine.filter((l) => ['submitted', 'under_verification'].includes(l.status));
  const sold = mine.filter((l) => ['won', 'in_settlement', 'ready_for_pickup', 'in_logistics', 'handover_complete', 'closed'].includes(l.status) && l.auctionId);
  const revenue = sold.reduce((sum, l) => sum + (auctions.find((a) => a.id === l.auctionId)?.currentBid ?? 0), 0);

  return (
    <div>
      <SectionTitle
        title={`Seller Workspace`}
        sub={`${userName} · Kavitha Steel Traders Pvt Ltd`}
        right={
          <div className="flex items-center gap-2">
            <Badge tone="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25"><BadgeCheck size={11} /> Verified entity</Badge>
            <Btn variant="accent" size="sm" onClick={() => nav('/seller/create')}><FilePlus2 size={14} /> List a lot</Btn>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="My lots" value={mine.length} hint="Across the full lifecycle" icon={<Package size={18} />} accent="bg-steel-500/10 text-steel-700 dark:text-steel-300" />
        <Stat label="Live now" value={liveMine.length} hint="Auctions running" icon={<Radio size={18} />} accent="bg-ember-50 dark:bg-ember-400/10 text-ember-600 dark:text-ember-400" />
        <Stat label="In verification" value={inVerification.length} hint="Awaiting Field Executive Officer" icon={<ClipboardCheck size={18} />} accent="bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400" />
        <Stat label="Realised value" value={inrCompact(revenue)} hint={`${sold.length} lots sold`} icon={<Trophy size={18} />} accent="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">Recent lots</h2>
            <button onClick={() => nav('/seller/lots')} className="text-xs font-bold text-steel-600 dark:text-steel-400 hover:underline cursor-pointer">All lots →</button>
          </div>
          <div className="space-y-2.5">
            {mine.slice(0, 5).map((l) => (
              <Card key={l.id} onClick={() => nav('/seller/lots')} className="flex items-center gap-3 p-3">
                <LotImage hues={l.imageHues} className="h-12 w-16 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-faint">{l.id}</div>
                  <div className="truncate text-sm font-bold text-ink">{l.title}</div>
                </div>
                <StatusBadge status={l.status} />
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {liveMine.length > 0 && (
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-ember-600 to-ember-800 p-5 text-white">
                <div className="flex items-center gap-2 text-sm font-bold"><Radio size={16} /> {liveMine.length} auction{liveMine.length > 1 ? 's' : ''} live right now</div>
                <p className="mt-1 text-xs text-ember-100">Watch bids arrive in real time on the read-only monitor.</p>
                <Btn variant="outline" size="sm" className="mt-3 !border-white/30 !bg-white/10 !text-white hover:!bg-white/20" onClick={() => nav('/seller/monitor')}>
                  Open live monitor <ArrowRight size={13} />
                </Btn>
              </div>
            </Card>
          )}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink">Listing pipeline</h3>
            <p className="mt-1 text-xs text-faint">Where your lots sit in the lifecycle</p>
            <div className="mt-3 space-y-2">
              {[
                ['Draft', mine.filter((l) => l.status === 'draft').length, 'bg-line-strong'],
                ['Verification', inVerification.length, 'bg-amber-400'],
                ['Approved / Scheduled', mine.filter((l) => ['approved', 'scheduled'].includes(l.status)).length, 'bg-indigo-400'],
                ['Live', liveMine.length, 'bg-ember-500'],
                ['Fulfilment', mine.filter((l) => ['won', 'in_settlement', 'ready_for_pickup', 'in_logistics'].includes(l.status)).length, 'bg-violet-400'],
                ['Closed', mine.filter((l) => ['handover_complete', 'closed'].includes(l.status)).length, 'bg-emerald-500'],
              ].map(([label, count, color]) => (
                <div key={label as string} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                  <span className="flex-1 text-xs font-medium text-muted">{label}</span>
                  <span className="text-xs font-extrabold text-ink">{count as number}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink"><Bell size={14} /> Recent notifications</h3>
            <div className="mt-3">
              <EmailTimeline logs={myNotifications} compact limit={5} />
              {myNotifications.length === 0 && <p className="text-xs text-faint">Settlement and delivery updates on your lots will show up here.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
