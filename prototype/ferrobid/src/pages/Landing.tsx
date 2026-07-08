import { useNavigate } from 'react-router-dom';
import { Flame, Gavel, ShieldCheck, Truck, ArrowRight, Timer, BadgeCheck } from 'lucide-react';
import { useApp, PERSONAS } from '../store';
import { roleHome } from '../components/shell';
import { LotImage, Badge } from '../components/ui';
import { inrCompact, timeLeft } from '../utils';

export default function Landing() {
  const nav = useNavigate();
  const { lots, auctions, switchRole, now } = useApp();
  const liveAuctions = auctions.filter((a) => a.status === 'live');

  return (
    <div className="min-h-full bg-steel-950 text-white">
      {/* top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ember-500 to-ember-700 shadow-lg shadow-ember-900/40">
            <Flame size={20} strokeWidth={2.5} />
          </div>
          <div className="leading-none">
            <div className="text-lg font-extrabold tracking-tight">ferro<span className="text-ember-500">Bid</span></div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-steel-300">Digital Metal Auctions</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="rounded-xl px-4 py-2 text-sm font-semibold text-steel-200 hover:text-white cursor-pointer">
            Browse as Guest
          </button>
          <button onClick={() => nav('/auth/login')} className="rounded-xl bg-ember-600 px-4 py-2 text-sm font-bold hover:bg-ember-500 cursor-pointer shadow-lg shadow-ember-900/40">
            Register / Login
          </button>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-5 pb-14 pt-10 text-center">
        <Badge tone="bg-white/10 text-ember-300 ring-white/20" className="mb-5">Clickable Prototype · v1.0 · All data simulated</Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
          India's transparent marketplace for <span className="bg-gradient-to-r from-ember-400 to-ember-600 bg-clip-text text-transparent">metal &amp; scrap auctions</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-steel-200">
          Verified sellers, inspected lots, live competitive bidding and managed fulfilment —
          the complete lot lifecycle from listing to handover, on one platform.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => nav('/auth/login')} className="flex items-center gap-2 rounded-xl bg-ember-600 px-6 py-3 font-bold hover:bg-ember-500 cursor-pointer shadow-lg shadow-ember-900/40">
            Start bidding <ArrowRight size={17} />
          </button>
          <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="rounded-xl border border-white/20 px-6 py-3 font-semibold text-steel-100 hover:bg-white/5 cursor-pointer">
            Explore live auctions
          </button>
        </div>

        {/* trust strip */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: <ShieldCheck size={18} />, t: 'Verified entities', s: 'KYC + entity checks before selling' },
            { icon: <Gavel size={18} />, t: 'Inspected lots', s: 'Physical verification & reports' },
            { icon: <Truck size={18} />, t: 'Managed fulfilment', s: 'Settlement → pickup → handover' },
          ].map((f) => (
            <div key={f.t} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10 text-left">
              <span className="text-ember-400">{f.icon}</span>
              <span>
                <span className="block text-sm font-bold">{f.t}</span>
                <span className="block text-[11px] text-steel-300">{f.s}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* live now */}
      <section className="bg-slate-100 px-5 py-12 text-slate-800">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-steel-950">
              <span className="h-2.5 w-2.5 rounded-full bg-ember-500 animate-pulse" /> Live right now
            </h2>
            <button onClick={() => { switchRole('guest'); nav('/browse'); }} className="text-sm font-bold text-steel-700 hover:underline cursor-pointer">View all →</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveAuctions.map((a) => {
              const lot = lots.find((l) => l.id === a.lotId)!;
              return (
                <button key={a.id} onClick={() => { switchRole('guest'); nav(`/lot/${lot.id}`); }} className="overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-slate-200 hover:shadow-lg transition-shadow cursor-pointer">
                  <LotImage hues={lot.imageHues} label={lot.metal} className="h-32 w-full" />
                  <div className="p-4">
                    <div className="text-sm font-bold text-steel-950 leading-snug">{lot.title}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{lot.quantity} · {lot.location}</div>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Current bid</div>
                        <div className="text-lg font-extrabold text-steel-900">{inrCompact(a.currentBid)}</div>
                      </div>
                      <Badge tone="bg-ember-50 text-ember-700 ring-ember-200"><Timer size={11} /> {timeLeft(a.endsAt, now)}</Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* demo personas */}
      <section className="px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-xl font-extrabold">Walk the prototype as any role</h2>
          <p className="mt-1 text-center text-sm text-steel-300">Jump straight into a persona — you can switch anytime from the header.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PERSONAS.map((p) => (
              <button
                key={p.role}
                onClick={() => { switchRole(p.role); nav(roleHome(p.role)); }}
                className="flex items-start gap-3 rounded-2xl bg-white/5 p-4 text-left ring-1 ring-white/10 hover:bg-white/10 hover:ring-ember-500/50 transition-colors cursor-pointer"
              >
                <BadgeCheck size={18} className="mt-0.5 shrink-0 text-ember-400" />
                <span>
                  <span className="block text-sm font-bold">{p.label}</span>
                  <span className="block text-xs text-steel-300">{p.name} — {p.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-steel-400">
        ferroBid prototype · AspiraSys for Metal Bid Technologies · All transactions, payments and data are simulated
      </footer>
    </div>
  );
}
