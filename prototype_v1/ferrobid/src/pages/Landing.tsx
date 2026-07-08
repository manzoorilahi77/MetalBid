import { useNavigate } from 'react-router-dom';
import {
  Flame, Gavel, ShieldCheck, Truck, ArrowRight, Timer, BadgeCheck, TrendingUp,
  Users, ClipboardCheck, Banknote, ChevronRight,
} from 'lucide-react';
import { useApp, PERSONAS } from '../store';
import { roleHome } from '../components/shell';
import { LotImage } from '../components/ui';
import { Reveal, CountUp, FlipClock } from '../components/fx';
import { inrCompact, timeLeft } from '../utils';

function Orb({ className }: { className: string }) {
  return <div aria-hidden className={`pointer-events-none absolute rounded-full blur-3xl ${className}`} />;
}

export default function Landing() {
  const nav = useNavigate();
  const { lots, auctions, switchRole, now } = useApp();
  const liveAuctions = auctions.filter((a) => a.status === 'live');

  const tickerItems = [...lots, ...lots].map((l, i) => ({ l, i }));

  return (
    <div className="min-h-full overflow-x-hidden bg-steel-950 text-white">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <Orb className="left-[-10%] top-[-12%] h-105 w-105 bg-ember-600/25 animate-glow-breathe" />
        <Orb className="right-[-8%] top-[22%] h-90 w-90 bg-steel-500/20 animate-glow-breathe" />
        <Orb className="bottom-[-15%] left-[30%] h-80 w-80 bg-ember-500/10" />
        <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      </div>

      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-steel-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ember-500 to-ember-700 shadow-lg shadow-ember-900/50">
              <Flame size={20} strokeWidth={2.5} />
            </div>
            <div className="leading-none">
              <div className="font-display text-lg font-bold tracking-tight">ferro<span className="text-ember-500">Bid</span></div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-steel-300">Digital Metal Auctions</div>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-steel-200 md:flex">
            <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="hover:text-white transition-colors cursor-pointer">Marketplace</button>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#roles" className="hover:text-white transition-colors">Personas</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-steel-200 transition-colors hover:text-white sm:block cursor-pointer">
              Browse as Guest
            </button>
            <button onClick={() => nav('/auth/login')} className="press shine relative overflow-hidden rounded-xl bg-ember-600 px-4 py-2 text-sm font-bold shadow-lg shadow-ember-900/40 transition-colors hover:bg-ember-500 cursor-pointer group">
              Register / Login
            </button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 text-center sm:pt-24">
        <Reveal delay={80}>
          <h1 className="mx-auto max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
            Where India trades metal,
            <span className="block bg-gradient-to-r from-ember-400 via-ember-500 to-amber-400 bg-clip-text text-transparent animate-gradient-pan">
              transparently. Live.
            </span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-steel-200 sm:text-lg">
            Verified sellers. Physically inspected lots. Competitive live bidding with managed
            settlement, logistics and handover — the complete lifecycle on one platform.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => nav('/auth/login')} className="press shine group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-ember-600 px-7 py-3.5 font-bold shadow-xl shadow-ember-900/50 transition-all hover:bg-ember-500 hover:shadow-glow-ember cursor-pointer">
              Start bidding <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="press rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 font-semibold text-steel-100 backdrop-blur transition-colors hover:bg-white/10 cursor-pointer">
              Explore live auctions
            </button>
          </div>
        </Reveal>

        {/* animated stats */}
        <Reveal delay={340}>
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 backdrop-blur sm:grid-cols-4">
            {[
              { v: 2400, s: '+', label: 'Lots auctioned' },
              { v: 96, s: ' Cr+', label: 'GMV realised', p: '₹' },
              { v: 1800, s: '+', label: 'Verified bidders' },
              { v: 99, s: '%', label: 'Fulfilment rate' },
            ].map((x) => (
              <div key={x.label} className="bg-steel-950/60 px-4 py-5">
                <div className="font-display text-2xl font-bold text-white sm:text-3xl">
                  <CountUp to={x.v} suffix={x.s} prefix={x.p ?? ''} />
                </div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-steel-400">{x.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* live ticker marquee */}
      <div className="relative border-y border-white/5 bg-white/[0.03] py-3 backdrop-blur">
        <div className="flex overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)' }}>
          <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10">
            {tickerItems.map(({ l, i }) => (
              <button key={`${l.id}-${i}`} onClick={() => { switchRole('guest'); nav(`/lot/${l.id}`); }} className="flex shrink-0 items-center gap-2.5 text-xs cursor-pointer group">
                <span className={`h-1.5 w-1.5 rounded-full ${l.status === 'live' ? 'bg-ember-500 animate-pulse' : 'bg-steel-500'}`} />
                <span className="font-semibold text-steel-200 group-hover:text-white transition-colors">{l.metal} · {l.title}</span>
                <span className="font-mono font-bold text-ember-400">{inrCompact(l.basePrice)}</span>
                <span className="text-steel-500">{l.quantity}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* live now */}
      <section className="relative px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="mb-7 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ember-400">
                  <span className="h-2 w-2 rounded-full bg-ember-500 animate-pulse" /> Live right now
                </div>
                <h2 className="mt-2 font-display text-3xl font-bold">Bidding is open</h2>
              </div>
              <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="group flex items-center gap-1 text-sm font-bold text-steel-200 transition-colors hover:text-white cursor-pointer">
                View all <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {liveAuctions.map((a, idx) => {
              const lot = lots.find((l) => l.id === a.lotId)!;
              return (
                <Reveal key={a.id} delay={idx * 110}>
                  <button
                    onClick={() => { switchRole('guest'); nav(`/lot/${lot.id}`); }}
                    className="lift group relative w-full overflow-hidden rounded-3xl bg-white/[0.04] text-left ring-1 ring-white/10 backdrop-blur transition-colors hover:ring-ember-500/40 cursor-pointer"
                  >
                    <div className="relative overflow-hidden">
                      <LotImage hues={lot.imageHues} label={lot.metal} className="h-40 w-full transition-transform duration-500 group-hover:scale-[1.04]" />
                      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-steel-950/70 px-2.5 py-1 text-[10px] font-bold text-ember-300 ring-1 ring-white/10 backdrop-blur">
                        <span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse" /> LIVE
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="text-[11px] font-bold text-steel-400">{lot.id} · {lot.quantity} · {lot.location}</div>
                      <div className="mt-1 font-display text-base font-bold leading-snug">{lot.title}</div>
                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-steel-400">Current bid</div>
                          <div className="font-display text-2xl font-bold text-white">{inrCompact(a.currentBid)}</div>
                        </div>
                        <div className="rounded-xl bg-steel-950/70 px-3 py-2 text-right ring-1 ring-white/10">
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-steel-400"><Timer size={10} /> closes in</div>
                          <FlipClock text={timeLeft(a.endsAt, now)} className="text-sm font-bold text-ember-400" />
                        </div>
                      </div>
                    </div>
                  </button>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="relative px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-ember-400">The lifecycle</div>
              <h2 className="mt-2 font-display text-3xl font-bold">From listing to handover — managed end to end</h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <ClipboardCheck size={20} />, t: '1 · Verify', s: 'Entities pass KYC & document checks; every lot is physically inspected with reports and photos.' },
              { icon: <Gavel size={20} />, t: '2 · Bid live', s: 'Real-time ladders, auto-bid, and anti-sniping auto-extension keep the bidding fair and fierce.' },
              { icon: <Banknote size={20} />, t: '3 · Settle', s: 'Winner payment, EMD auto-refunds for losers, invoices — handled by the operations pipeline.' },
              { icon: <Truck size={20} />, t: '4 · Fulfil', s: 'Scheduled pickup, assigned handlers, proof-of-handover. The lot closes with a full audit trail.' },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i * 100}>
                <div className="lift group h-full rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 backdrop-blur transition-colors hover:ring-ember-500/40">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-ember-500/20 to-ember-700/20 text-ember-400 ring-1 ring-ember-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    {f.icon}
                  </div>
                  <div className="mt-4 font-display text-base font-bold">{f.t}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-steel-300">{f.s}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* trust strip */}
          <Reveal delay={150}>
            <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: <ShieldCheck size={17} />, t: 'Verified entities only', s: 'Sellers unlock listing after entity verification' },
                { icon: <BadgeCheck size={17} />, t: 'Inspected lots', s: 'Checklist, report & photos before any auction' },
                { icon: <TrendingUp size={17} />, t: 'Fair price discovery', s: 'Open ladders · anti-sniping extensions' },
              ].map((f) => (
                <div key={f.t} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 ring-1 ring-white/10 text-left backdrop-blur">
                  <span className="text-ember-400">{f.icon}</span>
                  <span>
                    <span className="block text-sm font-bold">{f.t}</span>
                    <span className="block text-[11px] text-steel-400">{f.s}</span>
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* demo personas */}
      <section id="roles" className="relative px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-ember-400">Guided tour</div>
              <h2 className="mt-2 font-display text-3xl font-bold">Walk the prototype as any role</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-steel-300">Jump straight into a persona — switch anytime from the header. Every hand-off between roles is fully clickable.</p>
            </div>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PERSONAS.map((p, i) => (
              <Reveal key={p.role} delay={i * 70}>
                <button
                  onClick={() => { switchRole(p.role); nav(roleHome(p.role)); }}
                  className="lift group flex w-full items-start gap-3.5 rounded-3xl bg-white/[0.04] p-5 text-left ring-1 ring-white/10 backdrop-blur transition-colors hover:ring-ember-500/50 cursor-pointer"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-steel-500/30 to-steel-700/30 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110">
                    <Users size={17} className="text-steel-200" />
                  </div>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-display text-sm font-bold">
                      {p.label}
                      <ArrowRight size={13} className="text-ember-400 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-steel-400">{p.name} — {p.sub}</span>
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-5 pb-20 pt-6">
        <Reveal>
          <div className="animate-gradient-pan relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-r from-ember-700 via-ember-600 to-amber-600 p-10 text-center shadow-2xl shadow-ember-900/40 sm:p-14">
            <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0 2px, transparent 2px 16px)' }} />
            <h2 className="relative font-display text-3xl font-bold sm:text-4xl">Ready to strike while it's hot?</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm text-ember-100 sm:text-base">
              Register in under a minute with mobile + OTP. Every account starts as a Buyer — verified entities unlock selling on the same login.
            </p>
            <button onClick={() => nav('/auth/login')} className="press relative mt-7 rounded-2xl bg-white px-8 py-3.5 font-display font-bold text-ember-700 shadow-xl transition-transform hover:scale-[1.03] cursor-pointer">
              Create your account →
            </button>
          </div>
        </Reveal>
      </section>

      <footer className="relative border-t border-white/5 px-5 py-8 text-center">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2">
          <div className="flex items-center gap-2 font-display text-sm font-bold">
            <Flame size={14} className="text-ember-500" /> ferro<span className="text-ember-500">Bid</span>
          </div>
          <p className="text-xs text-steel-400">Prototype by AspiraSys for Metal Bid Technologies · All transactions, payments and data are simulated</p>
        </div>
      </footer>
    </div>
  );
}
