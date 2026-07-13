import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Gavel, Timer, Zap, Users, TrendingUp, Bot, Crown, LayoutList, Sparkles, BellRing, Minus, Plus, Check } from 'lucide-react';
import { useApp, DEMO_USER_ID } from '../store';
import { Card, Badge, Btn, Modal, Field, inputCls, LotImage, Toggle } from '../components/ui';
import { AnimatedInr, FlipClock, Confetti } from '../components/fx';
import { inr, inrCompact, timeLeft, clockTime, cx } from '../utils';

/* Stepper-style amount entry: tap −/+ to move by one increment, or type digits
   (formatted live in Indian grouping). Value is held as a plain digit string. */
function AmountStepper({ value, onChange, min, step, className }: {
  value: string; onChange: (v: string) => void; min: number; step: number; className?: string;
}) {
  const num = value ? Number(value) : 0;
  const stepBtn = 'flex h-10 w-10 shrink-0 items-center justify-center text-muted hover:bg-surface-3 hover:text-ink cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div className={cx('flex items-center overflow-hidden rounded-xl bg-surface ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-steel-400', className)}>
      <button type="button" disabled={!num || num <= min} onClick={() => onChange(String(Math.max(min, num - step)))} className={stepBtn} aria-label="Decrease bid">
        <Minus size={15} />
      </button>
      <input
        value={num ? num.toLocaleString('en-IN') : ''}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        placeholder={`Min ${inr(min)}`}
        inputMode="numeric"
        className="h-10 w-full min-w-0 border-x border-line bg-transparent text-center text-sm font-bold text-ink placeholder:font-medium placeholder:text-faint focus:outline-none"
      />
      <button type="button" onClick={() => onChange(String(num ? num + step : min))} className={stepBtn} aria-label="Increase bid">
        <Plus size={15} />
      </button>
    </div>
  );
}

/* Circular countdown — remaining auction time at a glance. */
function TimeRing({ frac, urgent, text, closed }: { frac: number; urgent: boolean; text: string; closed?: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="5" stroke="currentColor" className="text-line" />
        {!closed && (
          <circle
            cx="40" cy="40" r={r} fill="none" strokeWidth="5" strokeLinecap="round" stroke="currentColor"
            className={urgent ? 'text-red-500' : 'text-ember-500'}
            strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <FlipClock text={text} className={cx('text-base font-bold', closed ? 'text-faint' : urgent ? 'text-red-500' : 'text-ink')} />
        <span className="text-[9px] font-semibold uppercase tracking-wide text-faint">left</span>
      </div>
    </div>
  );
}

/* User-selectable bid step: multiples of the auction's minimum increment.
   Drives quick chips, the amount stepper, and one-tap bids in every view. */
const stepLabel = (n: number) => (n % 1000 === 0 && n < 100000 ? `₹${n / 1000}k` : inrCompact(n));

function StepPicker({ increment, mult, onChange, dark, className }: {
  increment: number; mult: number; onChange: (m: number) => void; dark?: boolean; className?: string;
}) {
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <span className={cx('text-[10px] font-bold uppercase tracking-wide', dark ? 'text-steel-400' : 'text-faint')}>Bid step</span>
      <div className={cx('flex rounded-lg p-0.5', dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-surface-3')}>
        {[1, 2, 5, 10].map((m) => (
          <button
            key={m} type="button" onClick={() => onChange(m)}
            className={cx(
              'rounded-md px-2 py-1 text-[11px] font-bold cursor-pointer transition-colors',
              mult === m
                ? dark ? 'bg-ember-500/20 text-ember-300' : 'bg-surface text-ink shadow-sm'
                : dark ? 'text-steel-400 hover:text-steel-200' : 'text-faint hover:text-muted',
            )}
          >
            {stepLabel(increment * m)}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  const [view, setView] = useState<'easy' | 'pro' | 'max'>('pro');
  const [showCustom, setShowCustom] = useState(false);
  const [maxSteps, setMaxSteps] = useState(1);
  const [justBid, setJustBid] = useState(false);
  const [stepMult, setStepMult] = useState(1);

  if (!a || !lot) return <div className="text-sm text-muted">Auction not found.</div>;

  const myAuto = autoBid[a.id];
  const ladder = bids.filter((b) => b.auctionId === a.id).sort((x, y) => y.at - x.at);
  const minNext = a.currentBid + a.increment;
  const iAmLeading = a.leaderId === DEMO_USER_ID;
  const closed = a.status === 'closed';
  const secondsLeft = Math.max(0, (a.endsAt - now) / 1000);
  const urgent = secondsLeft < 120 && !closed;

  const bidStep = a.increment * stepMult;
  const easyNext = a.currentBid + bidStep;
  const nextBid = a.currentBid + bidStep * maxSteps;
  const timeFrac = Math.max(0, Math.min(1, (a.endsAt - now) / (a.endsAt - a.startsAt)));
  const quick = [1, 2, 4].map((m) => a.currentBid + bidStep * m);
  const autoQuick = [10, 20, 40].map((m) => a.currentBid + a.increment * m);
  const iHaveBid = ladder.some((b) => b.bidderId === DEMO_USER_ID);

  const ago = (t: number) => {
    const s = Math.max(0, Math.round((now - t) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hr ago`;
  };

  return (
    <div>
      {closed && iAmLeading && <Confetti />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => nav(`/lot/${lot.id}`)} className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-steel-800 cursor-pointer">
          <ArrowLeft size={15} /> Lot details
        </button>
        {/* view switcher */}
        <div className="flex items-center rounded-xl bg-surface-3 p-1 text-xs font-bold">
          <button
            onClick={() => setView('easy')}
            className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 cursor-pointer transition-colors', view === 'easy' ? 'bg-surface text-ink shadow-sm' : 'text-faint hover:text-muted')}
          >
            <Sparkles size={13} /> Easy view
          </button>
          <button
            onClick={() => setView('pro')}
            className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 cursor-pointer transition-colors', view === 'pro' ? 'bg-surface text-ink shadow-sm' : 'text-faint hover:text-muted')}
          >
            <LayoutList size={13} /> Pro view
          </button>
          <button
            onClick={() => setView('max')}
            className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 cursor-pointer transition-colors', view === 'max' ? 'bg-surface text-ember-600 dark:text-ember-400 shadow-sm' : 'text-faint hover:text-muted')}
          >
            <Zap size={13} /> Max
          </button>
        </div>
      </div>

      {view === 'max' && (
      <div className="mx-auto max-w-md">
        <Card className="overflow-hidden">
          {/* one-line status — the first thing the eye lands on */}
          <div className={cx(
            'flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-extrabold',
            closed
              ? 'bg-surface-2 text-muted'
              : iAmLeading
                ? 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'
                : iHaveBid
                  ? 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300'
                  : 'bg-surface-2 text-muted',
          )}>
            {closed
              ? (iAmLeading ? '🎉 You won this auction' : `Closed — won by ${a.leaderName ?? '—'}`)
              : iAmLeading
                ? <><Crown size={13} /> You're leading — sit tight</>
                : iHaveBid
                  ? <><BellRing size={13} /> Outbid — one tap takes it back</>
                  : <><Gavel size={13} /> No bid from you yet</>}
          </div>

          {/* glanceable hero: time ring + price */}
          <div className="flex items-center gap-5 p-5">
            <TimeRing frac={timeFrac} urgent={urgent} closed={closed} text={closed ? '00:00' : timeLeft(a.endsAt, now)} />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wide text-faint">Current highest</div>
              <div className="font-display text-3xl font-bold text-ink"><AnimatedInr value={a.currentBid} /></div>
              <div className="mt-1 text-[11px] text-faint">
                <span className={cx('font-bold', iAmLeading ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted')}>
                  {a.leaderName ? (iAmLeading ? 'you hold it' : a.leaderName) : 'no bids yet'}
                </span>
                {' '}· {a.bidderCount} bidders
              </div>
              <div className="mt-0.5 truncate text-[11px] text-faint">{lot.title} · {lot.quantity}</div>
              {a.extensions > 0 && !closed && <div className="mt-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">⚡ extended ×{a.extensions} — late bids add 2 min</div>}
            </div>
          </div>

          {!closed ? (
            <div className="border-t border-line bg-surface-2/60 p-5">
              {/* bid composer: one number, nudged directly */}
              <div className="text-center text-[10px] font-bold uppercase tracking-wide text-faint">Your next bid</div>
              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => setMaxSteps((s) => Math.max(1, s - 1))}
                  disabled={maxSteps <= 1}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line-strong transition-all hover:bg-surface-3 active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Lower next bid"
                >
                  <Minus size={17} />
                </button>
                <div className="min-w-28 sm:min-w-44 text-center">
                  <div className="font-display text-3xl font-bold text-ink">{inr(nextBid)}</div>
                  <div className="text-[11px] text-faint">current + {maxSteps} × {stepLabel(bidStep)}</div>
                </div>
                <button
                  onClick={() => setMaxSteps((s) => s + 1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line-strong transition-all hover:bg-surface-3 active:scale-95 cursor-pointer"
                  aria-label="Raise next bid"
                >
                  <Plus size={17} />
                </button>
              </div>

              {/* the one big action */}
              <button
                onClick={() => {
                  placeBid(a.id, nextBid);
                  setJustBid(true);
                  setTimeout(() => setJustBid(false), 1200);
                }}
                className={cx(
                  'mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white cursor-pointer transition-all active:scale-[0.99]',
                  justBid
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-b from-ember-500 to-ember-600 hover:from-ember-400 hover:to-ember-500 shadow-lg shadow-ember-500/25',
                )}
              >
                {justBid
                  ? <><Check size={19} strokeWidth={3} /> Bid placed</>
                  : <><Gavel size={18} /> Place bid · {inr(nextBid)}</>}
              </button>
              <div className="mt-2 text-center text-[10px] text-faint">Instant — no confirmation step · wallet {inrCompact(wallet.balance)} · EMD ✓</div>

              <StepPicker increment={a.increment} mult={stepMult} onChange={setStepMult} className="mt-3 justify-center" />

              {/* safety net while away */}
              <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-surface px-3.5 py-2.5 ring-1 ring-line">
                {myAuto?.active ? (
                  <>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300"><Bot size={13} /> Auto-pilot covers you up to {inrCompact(myAuto.max)}</span>
                    <button onClick={() => setAutoBid(a.id, myAuto.max, myAuto.step, false)} className="shrink-0 text-[11px] font-bold text-muted underline cursor-pointer">Off</button>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Bot size={13} /> Stepping away? Auto-pilot can hold your lead.</span>
                    <button onClick={() => setAutoOpen(true)} className="shrink-0 text-[11px] font-bold text-ember-600 dark:text-ember-400 underline cursor-pointer">Set up</button>
                  </>
                )}
              </div>

              {/* single-line ticker: the latest move only */}
              {ladder[0] && (
                <div className="mt-3 flex items-center justify-between text-[11px] text-faint">
                  <span className="truncate">
                    Last: <span className="font-bold text-muted">{ladder[0].bidderId === DEMO_USER_ID ? 'You' : ladder[0].bidderName}</span> · {inrCompact(ladder[0].amount)} · {ago(ladder[0].at)}
                  </span>
                  <button onClick={() => setView('pro')} className="shrink-0 font-bold text-muted underline cursor-pointer">Full ladder</button>
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-line p-5 text-center">
              <div className="text-xs text-muted">{iAmLeading ? 'Settlement will begin shortly — track it under Fulfilment.' : 'Your EMD is auto-refunded to your wallet.'}</div>
              {iAmLeading && <Btn variant="primary" className="mt-3" onClick={() => nav('/buyer/fulfilment')}>Track fulfilment</Btn>}
            </div>
          )}
        </Card>
      </div>
      )}

      {view === 'easy' && (
      <div className="mx-auto max-w-xl space-y-4">
        {/* status hero — one glance tells you everything */}
        <Card className="overflow-hidden">
          <div className={cx(
            'p-5 text-center',
            closed
              ? 'bg-surface-2'
              : iAmLeading
                ? 'bg-emerald-50 dark:bg-emerald-400/10'
                : iHaveBid
                  ? 'bg-red-50 dark:bg-red-400/10'
                  : 'bg-surface-2',
          )}>
            <div className={cx(
              'mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-extrabold',
              closed
                ? 'bg-surface-3 text-ink'
                : iAmLeading
                  ? 'bg-emerald-600 text-white'
                  : iHaveBid
                    ? 'bg-red-600 text-white'
                    : 'bg-steel-800 text-white',
            )}>
              {closed
                ? (iAmLeading ? '🎉 You won this auction!' : 'Auction closed')
                : iAmLeading
                  ? <><Crown size={15} /> You're leading</>
                  : iHaveBid
                    ? <><BellRing size={15} /> You've been outbid</>
                    : <><Gavel size={15} /> You haven't bid yet</>}
            </div>
            <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-faint">
              {a.leaderName ? `Highest bid · ${iAmLeading ? 'you' : a.leaderName}` : 'Highest bid'}
            </div>
            <div className="font-display text-4xl font-bold text-ink"><AnimatedInr value={a.currentBid} /></div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-steel-950 px-4 py-2 text-white">
              <Timer size={14} className={urgent ? 'text-red-400' : 'text-ember-400'} />
              <FlipClock
                text={closed ? '00:00' : timeLeft(a.endsAt, now)}
                className={cx('text-xl font-bold', urgent ? 'text-red-400' : 'text-ember-400')}
              />
              <span className="text-[10px] font-semibold text-steel-300">left</span>
            </div>
            {a.extensions > 0 && !closed && <div className="mt-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">⚡ extended ×{a.extensions} — late bids add 2 min</div>}
            <div className="mt-2 text-[11px] text-faint truncate">{lot.title} · {lot.quantity} · {a.bidderCount} bidders</div>
          </div>

          {/* one-tap action */}
          {!closed && (
            <div className="border-t border-line p-5">
              <StepPicker increment={a.increment} mult={stepMult} onChange={setStepMult} className="mb-3 justify-center" />
              <Btn variant="accent" size="lg" className="w-full justify-center" onClick={() => placeBid(a.id, easyNext)}>
                <Gavel size={17} /> {iAmLeading ? `Strengthen lead · bid ${inr(easyNext)}` : `Take the lead · bid ${inr(easyNext)}`}
              </Btn>
              {!showCustom ? (
                <button onClick={() => setShowCustom(true)} className="mt-2.5 w-full text-center text-xs font-semibold text-faint hover:text-muted cursor-pointer">
                  or enter a different amount
                </button>
              ) : (
                <div className="mt-2.5 flex items-center gap-2">
                  <AmountStepper value={custom} onChange={setCustom} min={minNext} step={bidStep} className="flex-1" />
                  <Btn variant="outline" disabled={!custom || Number(custom) < minNext} onClick={() => { placeBid(a.id, Number(custom)); setCustom(''); setShowCustom(false); }}>
                    Bid
                  </Btn>
                </div>
              )}
              <div className="mt-2 text-center text-[11px] text-faint">Wallet {inrCompact(wallet.balance)} available · EMD locked ✓</div>
            </div>
          )}
          {closed && (
            <div className="border-t border-line p-5 text-center">
              <div className="text-xs text-muted">{iAmLeading ? 'Settlement will begin shortly — track it under Fulfilment.' : `Won by ${a.leaderName ?? '—'}. Your EMD is auto-refunded to your wallet.`}</div>
              {iAmLeading && <Btn variant="primary" className="mt-3" onClick={() => nav('/buyer/fulfilment')}>Track fulfilment</Btn>}
            </div>
          )}
        </Card>

        {/* auto-pilot — set it and get back to work */}
        {!closed && (
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember-50 dark:bg-ember-400/10 text-ember-600 dark:text-ember-400">
                <Bot size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-ink">In a meeting? Put bidding on auto-pilot</div>
                <div className="mt-0.5 text-xs text-muted">Pick your maximum — ferroBid outbids others for you, one step at a time, and stops at your limit.</div>
                {myAuto?.active ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-400/10 px-3.5 py-2.5 ring-1 ring-emerald-200 dark:ring-emerald-400/25">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300"><Zap size={13} /> Auto-pilot ON · up to {inrCompact(myAuto.max)}</span>
                    <button onClick={() => setAutoBid(a.id, myAuto.max, myAuto.step, false)} className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 underline cursor-pointer">Turn off</button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {autoQuick.map((max) => (
                      <Btn key={max} variant="outline" size="sm" onClick={() => setAutoBid(a.id, max, bidStep, true)}>
                        <Zap size={12} /> up to {inrCompact(max)}
                      </Btn>
                    ))}
                    <Btn variant="ghost" size="sm" onClick={() => setAutoOpen(true)}>Custom…</Btn>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* plain-language activity — just the last few moves */}
        <Card className="p-5">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-faint">What's happening</div>
          {ladder.length === 0 && <div className="text-xs text-faint">No bids yet — be the first!</div>}
          <div className="space-y-2.5">
            {ladder.slice(0, 4).map((b, i) => {
              const mine = b.bidderId === DEMO_USER_ID;
              return (
                <div key={b.id} className="flex items-center gap-2.5 text-sm">
                  <span className={cx('h-2 w-2 shrink-0 rounded-full', i === 0 ? 'bg-ember-500' : mine ? 'bg-emerald-500' : 'bg-line-strong')} />
                  <span className="min-w-0 flex-1 truncate text-muted">
                    <span className={cx('font-bold', mine ? 'text-emerald-700 dark:text-emerald-300' : 'text-ink')}>{mine ? 'You' : b.bidderName}</span>
                    {' '}bid <span className="font-bold text-ink">{inrCompact(b.amount)}</span>
                    {b.auto && <span className="text-faint"> (auto)</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-faint">{ago(b.at)}</span>
                </div>
              );
            })}
          </div>
          {ladder.length > 4 && (
            <button onClick={() => setView('pro')} className="mt-3 text-[11px] font-bold text-steel-600 dark:text-steel-300 underline cursor-pointer">
              See full bid ladder ({ladder.length} bids)
            </button>
          )}
        </Card>
      </div>
      )}

      {view === 'pro' && (
      <div className="grid gap-5 lg:grid-cols-3">
        {/* main bidding panel */}
        <div className="min-w-0 lg:col-span-2 space-y-4">
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
                <StepPicker increment={a.increment} mult={stepMult} onChange={setStepMult} className="mb-3" />
                <div className="flex flex-wrap items-center gap-2">
                  {quick.map((amt) => (
                    <Btn key={amt} variant="outline" size="sm" onClick={() => placeBid(a.id, amt)}>
                      <Gavel size={13} /> {inr(amt)}
                    </Btn>
                  ))}
                  <div className="flex flex-1 min-w-56 items-center gap-2">
                    <AmountStepper value={custom} onChange={setCustom} min={minNext} step={bidStep} className="flex-1" />
                    <Btn variant="accent" disabled={!custom || Number(custom) < minNext} onClick={() => { placeBid(a.id, Number(custom)); setCustom(''); }}>
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
      )}

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
