import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Timer, Lock, ShieldCheck, Gavel, FileText } from 'lucide-react';
import { useApp } from '../store';
import { Card, Badge, StatusBadge, LotImage, LifecycleTracker, Btn } from '../components/ui';
import { AnimatedInr, FlipClock } from '../components/fx';
import { inr, inrCompact, timeLeft, dateTime } from '../utils';

export default function LotDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { lots, auctions, role, now, emdLockedAuctions, lockEmd, kycStatus } = useApp();
  const lot = lots.find((l) => l.id === id);
  if (!lot) return <div className="text-sm text-muted">Lot not found. <button className="text-steel-700 dark:text-steel-300 font-semibold cursor-pointer" onClick={() => nav('/browse')}>Back to marketplace</button></div>;
  const auction = auctions.find((a) => a.id === lot.auctionId);
  const emdLocked = auction ? emdLockedAuctions.includes(auction.id) : false;
  const canParticipate = role === 'buyer' || role === 'seller';

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-steel-800 cursor-pointer">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* left: lot info */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="overflow-hidden">
            <LotImage hues={lot.imageHues} label={lot.metal} className="h-56 w-full" />
            <div className="grid grid-cols-4 gap-1 p-1">
              {[0, 1, 2, 3].map((i) => (
                <LotImage key={i} hues={[lot.imageHues[0] + i * 8, lot.imageHues[1] - i * 6]} className="h-16 rounded-lg" />
              ))}
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-faint">{lot.id}</div>
                  <h1 className="text-xl font-extrabold text-ink">{lot.title}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
                    <span>{lot.quantity}</span><span>· Grade {lot.grade}</span>
                    <span className="flex items-center gap-1"><MapPin size={13} />{lot.location}</span>
                  </div>
                </div>
                <StatusBadge status={lot.status} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">{lot.description}</p>

              {lot.verification?.decision === 'verified' && (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-400/10 px-4 py-3 ring-1 ring-emerald-200 dark:ring-emerald-400/25">
                  <ShieldCheck size={17} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="text-xs text-emerald-800 dark:text-emerald-200">
                    <b>Physically verified by ferroBid.</b> Inspection checklist passed · report & photos on file · verified by {lot.verification.decidedBy}.
                  </div>
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Base price', inrCompact(lot.basePrice)],
                  ['Reserve', inrCompact(lot.reservePrice)],
                  ['EMD required', inrCompact(lot.emdAmount)],
                  ['Bid increment', inr(lot.increment)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-surface-2 px-3 py-2.5 ring-1 ring-line">
                    <div className="text-[10px] font-bold uppercase text-faint">{k}</div>
                    <div className="text-sm font-extrabold text-ink">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold text-ink">Lot lifecycle</h3>
            <LifecycleTracker status={lot.status} compact />
          </Card>
        </div>

        {/* right: auction panel */}
        <div className="space-y-4">
          {auction ? (
            <Card className="p-5">
              {auction.status === 'live' && (
                <>
                  <div className="flex items-center justify-between">
                    <Badge tone="bg-ember-50 dark:bg-ember-400/10 text-ember-700 dark:text-ember-300 ring-ember-200 dark:ring-ember-400/25"><span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse" /> LIVE</Badge>
                    {auction.extensions > 0 && <Badge tone="bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25">Extended ×{auction.extensions}</Badge>}
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-[10px] font-bold uppercase text-faint">Current highest bid</div>
                    <div className="font-display text-3xl font-bold text-ink"><AnimatedInr value={auction.currentBid} /></div>
                    <div className="mt-1 text-xs text-faint">by {auction.leaderName ?? '—'} · {auction.bidderCount} bidders</div>
                  </div>
                  <div className="mt-4 rounded-xl bg-steel-950 px-4 py-3 text-center text-white">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-steel-300 flex items-center justify-center gap-1"><Timer size={11} /> Closes in</div>
                    <FlipClock text={timeLeft(auction.endsAt, now)} className="text-2xl font-bold text-ember-400" />
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-ember-600 to-ember-400 transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, ((auction.endsAt - now) / (auction.endsAt - auction.startsAt)) * 100))}%` }} />
                    </div>
                  </div>

                  {role === 'guest' && (
                    <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4 text-center">
                      <Lock size={18} className="mx-auto text-faint" />
                      <p className="mt-2 text-xs text-muted">Register as a Buyer to lock EMD and bid on this lot.</p>
                      <Btn variant="accent" className="mt-3 w-full" onClick={() => nav('/auth/login')}>Register / Login</Btn>
                    </div>
                  )}
                  {canParticipate && kycStatus !== 'verified' && (
                    <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                      Complete KYC verification before bidding. <button className="font-bold underline cursor-pointer" onClick={() => nav('/buyer')}>Go to dashboard →</button>
                    </div>
                  )}
                  {canParticipate && kycStatus === 'verified' && !emdLocked && (
                    <Btn variant="primary" className="mt-4 w-full" onClick={() => lockEmd(auction.id)}>
                      <Lock size={15} /> Lock EMD {inrCompact(auction.emd)} to bid
                    </Btn>
                  )}
                  {canParticipate && emdLocked && (
                    <Btn variant="accent" className="mt-4 w-full animate-pulse-ring" onClick={() => nav(`/bid/${auction.id}`)}>
                      <Gavel size={15} /> Enter bidding room
                    </Btn>
                  )}
                </>
              )}
              {auction.status === 'scheduled' && (
                <div className="text-center">
                  <Badge tone="bg-indigo-50 dark:bg-indigo-400/10 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-400/25">Scheduled</Badge>
                  <div className="mt-3 text-sm text-muted">Auction opens</div>
                  <div className="text-xl font-extrabold text-ink">{dateTime(auction.startsAt)}</div>
                  <div className="mt-1 font-mono text-sm text-indigo-600 dark:text-indigo-400">in {timeLeft(auction.startsAt, now)}</div>
                  <div className="mt-3 text-xs text-faint">Start price {inr(auction.startPrice)} · EMD {inrCompact(auction.emd)}</div>
                  {canParticipate && !emdLocked && (
                    <Btn variant="outline" className="mt-4 w-full" onClick={() => lockEmd(auction.id)}><Lock size={14} /> Pre-lock EMD</Btn>
                  )}
                  {emdLocked && <div className="mt-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ EMD locked — you're ready for the start</div>}
                </div>
              )}
              {auction.status === 'closed' && (
                <div className="text-center">
                  <Badge tone="bg-surface-3 text-muted ring-line-strong">Auction closed</Badge>
                  <div className="mt-3 text-[10px] font-bold uppercase text-faint">Winning bid</div>
                  <div className="text-2xl font-extrabold text-ink">{inr(auction.currentBid)}</div>
                  <div className="mt-1 text-xs text-faint">Winner: {auction.leaderName ?? 'Reserve not met'}</div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-5 text-center text-sm text-muted">
              <FileText size={20} className="mx-auto mb-2 text-faint" />
              This lot hasn't been scheduled for auction yet.
            </Card>
          )}

          <Card className="p-4 text-xs text-muted leading-relaxed">
            <b className="text-ink">How it works:</b> lock the EMD ({inrCompact(lot.emdAmount)}) to activate bidding.
            If you don't win, EMD is auto-refunded when the auction closes. Winner proceeds to settlement & pickup — all simulated in this prototype.
          </Card>
        </div>
      </div>
    </div>
  );
}
