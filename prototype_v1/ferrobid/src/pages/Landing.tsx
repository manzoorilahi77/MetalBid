import { useNavigate } from 'react-router-dom';
import {
  Flame, Gavel, ShieldCheck, Truck, ArrowRight, Timer, BadgeCheck, TrendingUp,
  Users, ClipboardCheck, Banknote, ChevronRight,
} from 'lucide-react';
import { useApp, PERSONAS } from '../store';
import { roleHome } from '../components/shell';
import { LotImage, ThemeToggle } from '../components/ui';
import { Reveal, CountUp, FlipClock } from '../components/fx';
import { inrCompact, timeLeft } from '../utils';
import { SITE } from '../content/site';
import { HERO, HERO_STATS, LIVE_SECTION, HOW_SECTION, TRUST_ITEMS, ROLES_SECTION, CTA_SECTION } from '../content/landing';

const HOW_ICONS: Record<string, React.ReactNode> = {
  ClipboardCheck: <ClipboardCheck size={20} />,
  Gavel: <Gavel size={20} />,
  Banknote: <Banknote size={20} />,
  Truck: <Truck size={20} />,
};
const TRUST_ICONS: Record<string, React.ReactNode> = {
  ShieldCheck: <ShieldCheck size={17} />,
  BadgeCheck: <BadgeCheck size={17} />,
  TrendingUp: <TrendingUp size={17} />,
};

function Orb({ className }: { className: string }) {
  return <div aria-hidden className={`pointer-events-none absolute rounded-full blur-3xl ${className}`} />;
}

export default function Landing() {
  const nav = useNavigate();
  const { lots, auctions, switchRole, now } = useApp();
  const liveAuctions = auctions.filter((a) => a.status === 'live');

  const tickerItems = [...lots, ...lots].map((l, i) => ({ l, i }));

  return (
    <div className="min-h-full overflow-x-hidden bg-canvas text-ink">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <Orb className="left-[-10%] top-[-12%] h-105 w-105 bg-ember-600/15 dark:bg-ember-600/25 animate-glow-breathe" />
        <Orb className="right-[-8%] top-[22%] h-90 w-90 bg-steel-500/10 dark:bg-steel-500/20 animate-glow-breathe" />
        <Orb className="bottom-[-15%] left-[30%] h-80 w-80 bg-ember-500/10" />
        <div className="absolute inset-0 opacity-[0.35] dot-grid" />
      </div>

      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-glass backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ember-500 to-ember-700 text-white shadow-lg shadow-ember-900/30">
              <Flame size={20} strokeWidth={2.5} />
            </div>
            <div className="leading-none">
              <div className="font-display text-lg font-bold tracking-tight">{SITE.namePrefix}<span className="text-ember-500">{SITE.nameAccent}</span></div>
              <div className="hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-faint sm:block">{SITE.tagline}</div>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="hover:text-ink transition-colors cursor-pointer">Marketplace</button>
            <a href="#how" className="hover:text-ink transition-colors">How it works</a>
            <a href="#roles" className="hover:text-ink transition-colors">Personas</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink sm:block cursor-pointer">
              Browse as Guest
            </button>
            <button onClick={() => nav('/auth/login')} className="press shine relative overflow-hidden whitespace-nowrap rounded-xl bg-ember-600 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-ember-900/30 transition-colors hover:bg-ember-500 cursor-pointer group sm:px-4">
              Register / Login
            </button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 text-center sm:pt-24">
        <Reveal delay={80}>
          <h1 className="mx-auto max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
            {HERO.titleLine1}
            <span className="block bg-gradient-to-r from-ember-400 via-ember-500 to-amber-400 bg-clip-text text-transparent animate-gradient-pan">
              {HERO.titleLine2}
            </span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {HERO.sub}
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => nav('/auth/login')} className="press shine group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-ember-600 px-7 py-3.5 font-bold text-white shadow-xl shadow-ember-900/30 transition-all hover:bg-ember-500 hover:shadow-glow-ember cursor-pointer">
              {HERO.ctaPrimary} <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="press rounded-2xl border border-line-strong bg-surface/60 px-7 py-3.5 font-semibold text-body backdrop-blur transition-colors hover:bg-surface cursor-pointer">
              {HERO.ctaSecondary}
            </button>
          </div>
        </Reveal>

        {/* animated stats */}
        <Reveal delay={340}>
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line backdrop-blur sm:grid-cols-4">
            {HERO_STATS.map((x) => (
              <div key={x.label} className="bg-surface/80 px-4 py-5">
                <div className="font-display text-2xl font-bold text-ink sm:text-3xl">
                  <CountUp to={x.v} suffix={x.s} prefix={'p' in x ? x.p : ''} />
                </div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-faint">{x.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* live ticker marquee */}
      <div className="relative border-y border-line bg-surface/40 py-3 backdrop-blur">
        <div className="flex overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)' }}>
          <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10">
            {tickerItems.map(({ l, i }) => (
              <button key={`${l.id}-${i}`} onClick={() => { switchRole('guest'); nav(`/lot/${l.id}`); }} className="flex shrink-0 items-center gap-2.5 text-xs cursor-pointer group">
                <span className={`h-1.5 w-1.5 rounded-full ${l.status === 'live' ? 'bg-ember-500 animate-pulse' : 'bg-steel-500'}`} />
                <span className="font-semibold text-muted group-hover:text-ink transition-colors">{l.metal} · {l.title}</span>
                <span className="font-mono font-bold text-ember-600 dark:text-ember-400">{inrCompact(l.basePrice)}</span>
                <span className="text-faint">{l.quantity}</span>
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
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ember-600 dark:text-ember-400">
                  <span className="h-2 w-2 rounded-full bg-ember-500 animate-pulse" /> {LIVE_SECTION.kicker}
                </div>
                <h2 className="mt-2 font-display text-3xl font-bold">{LIVE_SECTION.title}</h2>
              </div>
              <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="group flex items-center gap-1 text-sm font-bold text-muted transition-colors hover:text-ink cursor-pointer">
                {LIVE_SECTION.viewAll} <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
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
                    className="lift group relative w-full overflow-hidden rounded-3xl bg-surface text-left ring-1 ring-line shadow-soft backdrop-blur transition-colors hover:ring-ember-500/40 cursor-pointer"
                  >
                    <div className="relative overflow-hidden">
                      <LotImage hues={lot.imageHues} label={lot.metal} className="h-40 w-full transition-transform duration-500 group-hover:scale-[1.04]" />
                      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-steel-950/70 px-2.5 py-1 text-[10px] font-bold text-ember-300 ring-1 ring-white/10 backdrop-blur">
                        <span className="h-1.5 w-1.5 rounded-full bg-ember-500 animate-pulse" /> LIVE
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="text-[11px] font-bold text-faint">{lot.id} · {lot.quantity} · {lot.location}</div>
                      <div className="mt-1 font-display text-base font-bold leading-snug text-ink">{lot.title}</div>
                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-faint">Current bid</div>
                          <div className="font-display text-2xl font-bold text-ink">{inrCompact(a.currentBid)}</div>
                        </div>
                        <div className="rounded-xl bg-surface-2 px-3 py-2 text-right ring-1 ring-line">
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-faint"><Timer size={10} /> closes in</div>
                          <FlipClock text={timeLeft(a.endsAt, now)} className="text-sm font-bold text-ember-600 dark:text-ember-400" />
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
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-ember-600 dark:text-ember-400">{HOW_SECTION.kicker}</div>
              <h2 className="mt-2 font-display text-3xl font-bold">{HOW_SECTION.title}</h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_SECTION.steps.map((f, i) => (
              <Reveal key={f.t} delay={i * 100}>
                <div className="lift group h-full rounded-3xl bg-surface p-6 ring-1 ring-line shadow-soft backdrop-blur transition-colors hover:ring-ember-500/40">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-ember-500/15 to-ember-700/15 text-ember-600 dark:text-ember-400 ring-1 ring-ember-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    {HOW_ICONS[f.icon]}
                  </div>
                  <div className="mt-4 font-display text-base font-bold text-ink">{f.t}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.s}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* trust strip */}
          <Reveal delay={150}>
            <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
              {TRUST_ITEMS.map((f) => (
                <div key={f.t} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 ring-1 ring-line text-left backdrop-blur">
                  <span className="text-ember-600 dark:text-ember-400">{TRUST_ICONS[f.icon]}</span>
                  <span>
                    <span className="block text-sm font-bold text-ink">{f.t}</span>
                    <span className="block text-[11px] text-faint">{f.s}</span>
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
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-ember-600 dark:text-ember-400">{ROLES_SECTION.kicker}</div>
              <h2 className="mt-2 font-display text-3xl font-bold">{ROLES_SECTION.title}</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{ROLES_SECTION.sub}</p>
            </div>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PERSONAS.map((p, i) => (
              <Reveal key={p.role} delay={i * 70}>
                <button
                  onClick={() => { switchRole(p.role); nav(roleHome(p.role)); }}
                  className="lift group flex w-full items-start gap-3.5 rounded-3xl bg-surface p-5 text-left ring-1 ring-line shadow-soft backdrop-blur transition-colors hover:ring-ember-500/50 cursor-pointer"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-steel-500/15 ring-1 ring-line transition-transform duration-300 group-hover:scale-110">
                    <Users size={17} className="text-steel-700 dark:text-steel-200" />
                  </div>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-display text-sm font-bold text-ink">
                      {p.label}
                      <ArrowRight size={13} className="text-ember-500 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-faint">{p.name} — {p.sub}</span>
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
          <div className="animate-gradient-pan relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-r from-ember-700 via-ember-600 to-amber-600 p-10 text-center text-white shadow-2xl shadow-ember-900/40 sm:p-14">
            <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0 2px, transparent 2px 16px)' }} />
            <h2 className="relative font-display text-3xl font-bold sm:text-4xl">{CTA_SECTION.title}</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm text-ember-100 sm:text-base">
              {CTA_SECTION.sub}
            </p>
            <button onClick={() => nav('/auth/login')} className="press relative mt-7 rounded-2xl bg-white px-8 py-3.5 font-display font-bold text-ember-700 shadow-xl transition-transform hover:scale-[1.03] cursor-pointer">
              {CTA_SECTION.button}
            </button>
          </div>
        </Reveal>
      </section>

      <footer className="relative border-t border-line px-5 py-8 text-center">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-ink">
            <Flame size={14} className="text-ember-500" /> {SITE.namePrefix}<span className="text-ember-500">{SITE.nameAccent}</span>
          </div>
          <p className="text-xs text-faint">{SITE.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}
