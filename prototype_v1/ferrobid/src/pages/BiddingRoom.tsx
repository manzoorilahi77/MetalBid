import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Gavel, Timer, Zap, Users, TrendingUp, Bot, Crown } from 'lucide-react';
import { useApp, DEMO_USER_ID } from '../store';
import { Card, Badge, Btn, Modal, Field, inputCls, LotImage, Toggle } from '../components/ui';
import { AnimatedInr, FlipClock, Confetti } from '../components/fx';
import { inr, inrCompact, timeLeft, clockTime, cx } from '../utils';

export default function BiddingRoom() {
  const { auctionId } = useParams();
  const nav = useNavigate();
  const { auctions, lots, bids, now, placeBid, autoBid, setAutoBid, wallet, userName } = useApp();
  const a = auctions.find((x) => x.id === auctionId);
  const lot = a && lots.find((l) => l.id === a.lotId);
  const [autoOpen, setAutoOpen] = useState(false);
  const [maxBid, setMaxBid] = useState('');
  const [step, setStep] = useState('');
  const [custom, setCustom] = useState('');

  if (!a || !lot) return <div className="text-sm text-muted">Auction not found.</div>;

  const myAuto = autoBid[a.id];
  const ladder = bids.filter((b) => b.auctionId === a.id).sort((x, y) => y.at - x.at);
  const minNext = a.currentBid + a.increment;
  const iAmLeading = a.leaderId === DEMO_USER_ID;
  const closed = a.status === 'closed';
  const secondsLeft = Math.max(0, (a.endsAt - now) / 1000);
  const urgent = secondsLeft < 120 && !closed;

  const quick = [1, 2, 4].map((m) => a.currentBid + a.increment * m);

  return (
    <div>
      {closed && iAmLeading && <Confetti />}
      <button onClick={() => nav(`/lot/${lot.id}`)} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-steel-800 cursor-pointer">
        <ArrowLeft size={15} /> Lot details
      </button>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* main bidding panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 border-b border-line p-4">
              <LotImage hues={lot.imageHues} className="h-14 w-20 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-faint">{lot.id} · {lot.quantity} · {lot.grade}</div>
                <div className="truncate font-bold text-ink">{lot.title}</div>
              </div>
              {closed
                ? <Badge tone="bg-surface-3 text-muted ring-line-strong">Closed</Badge>
                : <Badge tone="bg-ember-50 dark:bg-ember-400/10 text-ember-700 dark:text-ember-300 ring-ember-200 dark:ring-ember-400/25"><span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse" /> LIVE</Badge>}
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <div className="relative overflow-hidden rounded-2xl bg-steel-950 p-4 text-center text-white sm:col-span-1">
                {urgent && <div className="pointer-events-none absolute inset-0 bg-red-500/10 animate-pulse" />}
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-steel-300"><Timer size={11} /> Time left</div>
                <FlipClock
                  text={closed ? '00:00' : timeLeft(a.endsAt, now)}
                  className={cx('text-3xl font-bold', urgent ? 'text-red-400' : 'text-ember-400')}
                />
                {/* time progress */}
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cx('h-full rounded-full transition-all duration-1000', urgent ? 'bg-red-500' : 'bg-gradient-to-r from-ember-600 to-ember-400')}
                    style={{ width: `${closed ? 0 : Math.max(0, Math.min(100, ((a.endsAt - now) / (a.endsAt - a.startsAt)) * 100))}%` }}
                  />
                </div>
                {a.extensions > 0 && <div className="mt-1.5 text-[10px] font-semibold text-amber-300">⚡ auto-extended ×{a.extensions} (late bids)</div>}
                {urgent && a.extensions === 0 && <div className="mt-1.5 text-[10px] text-steel-300">late bids extend by 2 min</div>}
              </div>
              <div className="text-center sm:col-span-2">
                <div className="text-[10px] font-bold uppercase text-faint">Current highest</div>
                <div className="font-display text-4xl font-bold text-ink"><AnimatedInr value={a.currentBid} /></div>
                <div className={cx('mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', iAmLeading ? 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300' : 'bg-surface-3 text-muted')}>
                  <Crown size={12} /> {iAmLeading ? "You're leading!" : a.leaderName ?? 'No bids yet'}
                </div>
                <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-faint">
                  <span className="flex items-center gap-1"><Users size={12} /> {a.bidderCount} bidders</span>
                  <span className="flex items-center gap-1"><TrendingUp size={12} /> incr {inr(a.increment)}</span>
                  <span>reserve {inrCompact(a.reserve)}</span>
                </div>
              </div>
            </div>

            {!closed && (
              <div className="border-t border-line bg-surface-2/60 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {quick.map((amt) => (
                    <Btn key={amt} variant="outline" size="sm" onClick={() => placeBid(a.id, amt)}>
                      <Gavel size={13} /> {inr(amt)}
                    </Btn>
                  ))}
                  <div className="flex flex-1 min-w-48 items-center gap-2">
                    <input
                      value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder={`Min ${inr(minNext)}`} className={inputCls}
                    />
                    <Btn variant="accent" onClick={() => { if (custom) { placeBid(a.id, Number(custom)); setCustom(''); } }}>
                      Place bid
                    </Btn>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-faint">Wallet {inrCompact(wallet.balance)} available · EMD locked for this lot ✓</div>
                  <button onClick={() => setAutoOpen(true)} className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer', myAuto?.active ? 'bg-emerald-100 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300' : 'bg-steel-500/10 text-steel-700 dark:text-steel-300 hover:bg-steel-500/20')}>
                    <Zap size={13} /> {myAuto?.active ? `Auto-bid ON · up to ${inrCompact(myAuto.max)}` : 'Set up auto-bid'}
                  </button>
                </div>
              </div>
            )}
            {closed && (
              <div className="border-t border-line p-5 text-center">
                <div className="text-sm font-bold text-ink">{iAmLeading ? '🎉 You won this auction!' : `Auction won by ${a.leaderName ?? '—'}`}</div>
                <div className="mt-1 text-xs text-muted">{iAmLeading ? 'Settlement will begin shortly — track it under Fulfilment.' : 'Your EMD is auto-refunded to your wallet.'}</div>
                {iAmLeading && <Btn variant="primary" className="mt-3" onClick={() => nav('/buyer/fulfilment')}>Track fulfilment</Btn>}
              </div>
            )}
          </Card>
        </div>

        {/* live ladder */}
        <Card className="flex flex-col overflow-hidden max-h-[560px]">
          <div className="border-b border-line px-4 py-3 text-sm font-bold text-ink">Live bid ladder</div>
          <div className="flex-1 overflow-y-auto thin-scroll p-2">
            {ladder.length === 0 && <div className="p-6 text-center text-xs text-faint">No bids yet — be the first!</div>}
            {ladder.map((b, i) => {
              const mine = b.bidderId === DEMO_USER_ID;
              return (
                <div key={b.id} className={cx('mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2', i === 0 && 'animate-bid-flash animate-ladder-in', mine ? 'bg-emerald-50 dark:bg-emerald-400/10 ring-1 ring-emerald-200 dark:ring-emerald-400/25' : 'bg-surface-2')}>
                  <div className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', i === 0 ? 'bg-ember-500 text-white' : 'bg-line text-muted')}>
                    {i === 0 ? <Crown size={13} /> : ladder.length - i}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-ink truncate">
                      {mine ? `${userName} (you)` : b.bidderName}
                      {b.auto && <Badge tone="bg-sky-50 dark:bg-sky-400/10 text-sky-600 dark:text-sky-400 ring-sky-200 dark:ring-sky-400/25"><Bot size={9} /> auto</Badge>}
                    </div>
                    <div className="text-[10px] text-faint">{clockTime(b.at)}</div>
                  </div>
                  <div className={cx('text-sm font-extrabold', i === 0 ? 'text-ember-600 dark:text-ember-400' : 'text-muted')}>{inrCompact(b.amount)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* auto-bid modal */}
      <Modal open={autoOpen} onClose={() => setAutoOpen(false)} title="Auto-bid (proxy bidding)">
        <p className="mb-4 text-sm text-muted">
          ferroBid will bid on your behalf whenever you're outbid — by your chosen step, never exceeding your maximum.
        </p>
        <div className="space-y-3">
          <Field label="Maximum bid (₹)" hint={`Current highest is ${inr(a.currentBid)}`}>
            <input className={inputCls} value={maxBid} onChange={(e) => setMaxBid(e.target.value.replace(/[^\d]/g, ''))} placeholder={String(a.currentBid + a.increment * 10)} />
          </Field>
          <Field label="Bid step (₹)" hint={`Minimum increment is ${inr(a.increment)}`}>
            <input className={inputCls} value={step} onChange={(e) => setStep(e.target.value.replace(/[^\d]/g, ''))} placeholder={String(a.increment)} />
          </Field>
          {myAuto?.active && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-400/10 px-4 py-3 ring-1 ring-emerald-200 dark:ring-emerald-400/25">
              <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Auto-bid is active (max {inrCompact(myAuto.max)})</span>
              <Toggle on onChange={() => setAutoBid(a.id, myAuto.max, myAuto.step, false)} />
            </div>
          )}
          <Btn
            variant="accent" className="w-full"
            disabled={!maxBid || Number(maxBid) < minNext}
            onClick={() => { setAutoBid(a.id, Number(maxBid), Number(step || a.increment), true); setAutoOpen(false); }}
          >
            <Zap size={15} /> Activate auto-bid
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
