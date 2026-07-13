import { useNavigate } from 'react-router-dom';
import { Wallet, Lock, Gavel, Trophy, ShieldCheck, Clock, ArrowRight, Store, Timer } from 'lucide-react';
import { useApp, DEMO_USER_ID } from '../../store';
import { SectionTitle, Stat, Card, Badge, Btn, LotImage } from '../../components/ui';
import { inrCompact, timeLeft } from '../../utils';

export default function BuyerDashboard() {
  const nav = useNavigate();
  const { wallet, auctions, lots, bids, kycStatus, submitKyc, now, buyerUpgrade, userName } = useApp();
  const live = auctions.filter((a) => a.status === 'live');
  const myBidAuctions = new Set(bids.filter((b) => b.bidderId === DEMO_USER_ID).map((b) => b.auctionId));
  const leading = live.filter((a) => a.leaderId === DEMO_USER_ID).length;
  const won = auctions.filter((a) => a.status === 'closed' && a.leaderId === DEMO_USER_ID).length;

  return (
    <div>
      <SectionTitle title={`Welcome back, ${userName.split(' ')[0]}`} sub="Your buying activity at a glance" />

      {kycStatus !== 'verified' && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-l-4 border-l-amber-400 p-4">
          <ShieldCheck size={18} className="text-amber-500" />
          <div className="flex-1 text-sm">
            <b>KYC {kycStatus === 'pending' ? 'under review' : 'required'}.</b>{' '}
            {kycStatus === 'pending' ? 'Our team is reviewing your documents (simulated — approves in a few seconds).' : 'Submit your KYC to start bidding in live auctions.'}
          </div>
          {kycStatus === 'not_submitted' && <Btn size="sm" variant="accent" onClick={submitKyc}>Submit KYC (mock)</Btn>}
          {kycStatus === 'pending' && <Badge tone="bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25"><Clock size={11} /> In review</Badge>}
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Wallet balance" value={inrCompact(wallet.balance)} hint="Available to bid" icon={<Wallet size={18} />} accent="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400" />
        <Stat label="EMD locked" value={inrCompact(wallet.emdLocked)} hint="Auto-refunds if you lose" icon={<Lock size={18} />} accent="bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400" />
        <Stat label="Active bids" value={`${myBidAuctions.size} lots`} hint={leading ? `Leading in ${leading}` : 'Place a bid to compete'} icon={<Gavel size={18} />} accent="bg-ember-50 dark:bg-ember-400/10 text-ember-600 dark:text-ember-400" />
        <Stat label="Auctions won" value={won} hint="Track under Fulfilment" icon={<Trophy size={18} />} accent="bg-steel-500/10 text-steel-700 dark:text-steel-300" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <span className="h-2 w-2 rounded-full bg-ember-500 animate-pulse" /> Live auctions
            </h2>
            <button onClick={() => nav('/browse')} className="text-xs font-bold text-steel-600 dark:text-steel-400 hover:underline cursor-pointer">Browse all →</button>
          </div>
          <div className="space-y-3">
            {live.map((a) => {
              const lot = lots.find((l) => l.id === a.lotId)!;
              const mine = a.leaderId === DEMO_USER_ID;
              return (
                <Card key={a.id} onClick={() => nav(`/lot/${lot.id}`)} className="flex items-center gap-4 p-3">
                  <LotImage hues={lot.imageHues} className="h-14 w-20 rounded-lg shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">{lot.title}</div>
                    <div className="text-xs text-faint">{lot.quantity} · {lot.location}</div>
                    {mine && <Badge tone="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25" className="mt-1">You're leading</Badge>}
                    {!mine && myBidAuctions.has(a.id) && <Badge tone="bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 ring-red-200 dark:ring-red-400/25" className="mt-1">Outbid — act now</Badge>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-ink">{inrCompact(a.currentBid)}</div>
                    <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-ember-600 dark:text-ember-400"><Timer size={11} /> {timeLeft(a.endsAt, now)}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-steel-800 to-steel-950 p-5 text-white">
              <Store size={20} className="text-ember-400" />
              <h3 className="mt-2 font-extrabold">Become a Seller</h3>
              <p className="mt-1 text-xs text-steel-200 leading-relaxed">
                {buyerUpgrade === 'approved'
                  ? 'Your entity is verified — listing tools are unlocked! Switch to the Seller workspace via the role switcher.'
                  : buyerUpgrade === 'submitted'
                  ? 'Your entity documents are under review by the Executive Admin.'
                  : 'Verify your business entity to list your own lots — while keeping all Buyer abilities.'}
              </p>
              <Btn variant="accent" size="sm" className="mt-3" onClick={() => nav('/buyer/become-seller')}>
                {buyerUpgrade === 'none' ? 'Start verification' : 'View status'} <ArrowRight size={13} />
              </Btn>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-bold text-ink">Quick actions</h3>
            <div className="mt-3 grid gap-2">
              <Btn variant="outline" size="sm" onClick={() => nav('/buyer/wallet')}><Wallet size={14} /> Top up wallet</Btn>
              <Btn variant="outline" size="sm" onClick={() => nav('/buyer/bids')}><Trophy size={14} /> My bids & results</Btn>
              <Btn variant="outline" size="sm" onClick={() => nav('/buyer/fulfilment')}><Clock size={14} /> Track won lots</Btn>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
