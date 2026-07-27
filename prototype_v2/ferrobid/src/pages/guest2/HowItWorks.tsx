/* Guest 2 — How It Works (FAANG-level Luxury Flagship Page).
   Includes interactive lifecycle simulator, dual-persona workflow switcher (buyer vs seller),
   6-stage animated timeline, platform safeguards showcase, searchable jargon glossary explorer,
   international compliance grid, and interactive FAQ. */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardCheck, BookOpen, Gavel, Flag, Banknote, Truck, ShieldCheck,
  ArrowRight, ChevronRight, Lock, Sparkles, ChevronDown, CheckCircle2, Clock,
  Search, Check, Zap,
  Shield, UserCheck, Building2, Scale, Compass, FileText
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, cx } from '../../components/ui'
import { Section, CtaBand, usePageMeta, CountUp } from './marketing'

/* ---------------------------------------------------------------------------
   DATA STRUCTURES FOR HOW IT WORKS
--------------------------------------------------------------------------- */

type LifecycleStage = {
  num: string
  title: string
  term: string
  buyerFocus: string
  sellerFocus: string
  icon: React.ReactNode
  bullets: string[]
  mockBadge: string
  mockVal: string
}

const LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    num: '01',
    title: 'Inspection & Field Audit',
    term: 'As-is-where-is',
    buyerFocus: 'Read verified chemical assay, 42-point checklist & photos before placing any bid.',
    sellerFocus: 'Zero plant disruption. Field auditor visits your yard and files the complete catalogue.',
    icon: <ClipboardCheck className="size-6 text-ember" />,
    bullets: [
      'Field auditor visits yard & measures physical dimensions',
      'Spectrometer chemical assay & radioactive contamination scan',
      '100% verified digital report attached to catalogue',
    ],
    mockBadge: 'Stage 01 Verified',
    mockVal: 'Report #FE-8842 Approved',
  },
  {
    num: '02',
    title: 'Catalogue & Confidential Reserve',
    term: 'Reserve Rate',
    buyerFocus: 'Clear minimum bid increments, per-lot EMD requirements & indicative weights.',
    sellerFocus: 'Reserve rate is 100% confidential & encrypted — buyers never see your minimum price.',
    icon: <BookOpen className="size-6 text-steel" />,
    bullets: [
      'Verified lots grouped into scheduled live auctions',
      'Confidential reserve price sealed with AES-256 encryption',
      'Only KYC-verified buyers funding lot EMD can participate',
    ],
    mockBadge: 'Stage 02 Active',
    mockVal: '🔒 Reserve Sealed & Encrypted',
  },
  {
    num: '03',
    title: 'Live Bidding & Anti-Snipe',
    term: 'Anti-Snipe',
    buyerFocus: 'Set Auto-Bid proxy ceiling. Bids in final 30s auto-extend timer by +2 minutes.',
    sellerFocus: 'Watch real-time competitive bidding ladder drive up lot price realization.',
    icon: <Gavel className="size-6 text-ember" />,
    bullets: [
      'Real-time price ticker with minimum rate increments',
      'Anti-snipe protection prevents last-millisecond bot steals',
      'Complete cryptographic audit log of every placed bid',
    ],
    mockBadge: 'Stage 03 Live',
    mockVal: 'Winning Bid: ₹38,450 / MT',
  },
  {
    num: '04',
    title: 'Close & STA Resolution',
    term: 'H1 · STA',
    buyerFocus: 'Win at or above reserve to secure lot. Un-won EMD auto-refunded to wallet in 72h.',
    sellerFocus: 'H1 below reserve closes as STA (Subject to Approval) — zero forced sales.',
    icon: <Flag className="size-6 text-steel" />,
    bullets: [
      'H1 bid at or above reserve sells automatically',
      'H1 below reserve enters STA — seller retains 100% decision control',
      'Auto-release engine returns EMD to non-winning bidders',
    ],
    mockBadge: 'Stage 04 Resolution',
    mockVal: 'H1 Closed · STA Controlled',
  },
  {
    num: '05',
    title: 'Smart Settlement & Taxing',
    term: 'GST · TCS · DO',
    buyerFocus: 'Pay winning tonnage rate with automated GST & TCS compliance invoices.',
    sellerFocus: 'Instant funds transfer to seller bank account via RTGS/NEFT post-close.',
    icon: <Banknote className="size-6 text-ember" />,
    bullets: [
      'Automated GST & TCS tax computation per government norms',
      '1-click digital Delivery Order (DO) issued upon payment',
      'Direct bank account transfer within 48 hours of settlement',
    ],
    mockBadge: 'Stage 05 Settled',
    mockVal: 'Delivery Order #DO-9921 Issued',
  },
  {
    num: '06',
    title: 'Weighment & Yard Lifting',
    term: 'Weighment',
    buyerFocus: 'Drive truck to calibrated weighbridge. Pay strictly for actual net weighed tonnage.',
    sellerFocus: 'Digital vehicle gate pass & e-way bill verified before truck leaves yard.',
    icon: <Truck className="size-6 text-steel" />,
    bullets: [
      'Gross & Tare weighment recorded at calibrated weighbridge',
      'Digital gate pass & e-way bill generated inside portal',
      'Final billed invoice reconciled with physical weighment slip',
    ],
    mockBadge: 'Stage 06 Completed',
    mockVal: 'Gate Pass Cleared · Truck Lifted',
  },
]

type GlossaryItem = {
  term: string
  def: string
  cat: 'Bidding Rules' | 'Financial & EMD' | 'Inspection & Quality' | 'Logistics & Weighment'
}

const GLOSSARY_FULL: GlossaryItem[] = [
  { term: 'EMD', def: 'Earnest Money Deposit — refundable earnest money locked per lot before bidding. Lose the lot and funds auto-release to your wallet in 72h.', cat: 'Financial & EMD' },
  { term: 'H1', def: 'The highest bid rate recorded on a lot at auction closing time.', cat: 'Bidding Rules' },
  { term: 'STA', def: 'Subject to Approval — when the highest bid (H1) closes below the seller’s confidential reserve rate. The seller retains full rights to accept, counter, or decline.', cat: 'Bidding Rules' },
  { term: 'Reserve Rate', def: 'The seller’s minimum acceptable price per UOM. Strictly confidential and encrypted — never shown to prospective buyers.', cat: 'Bidding Rules' },
  { term: 'As-Is-Where-Is', def: 'Material sells in its current physical condition and yard location, after published inspection report verification.', cat: 'Inspection & Quality' },
  { term: 'Weighment', def: 'Physical re-weighing of loaded vehicles at a calibrated weighbridge during lifting, determining the final billed tonnage.', cat: 'Logistics & Weighment' },
  { term: 'Anti-Snipe', def: 'An automated rule that extends the auction countdown by +2 minutes if a bid lands in the final 30 seconds, ensuring fair price discovery.', cat: 'Bidding Rules' },
  { term: 'Delivery Order (DO)', def: 'An official digital document issued after payment confirmation, authorizing the winning buyer to enter the yard and lift material.', cat: 'Logistics & Weighment' },
]

const HOW_IT_WORKS_FAQS = [
  {
    cat: 'Inspection Mechanics',
    q: 'What does "as-is-where-is" mean for buyers and sellers?',
    a: '"As-is-where-is" means the scrap or surplus metal is sold in its exact present physical condition and yard location after our certified field team inspects it. Buyers inspect the digital report, chemical assay, and high-res photos to bid on facts, while sellers are protected from post-auction quality claims.',
  },
  {
    cat: 'Inspection Mechanics',
    q: 'Who conducts the field inspection, and how is quality verified?',
    a: 'Every lot is physically visited by a certified FerroBid Field Inspector. They photograph physical conditions, verify dimensions, test for radioactive/chemical hazards, check weighbridge calibration, and upload a verified 42-point checklist before the catalogue goes live.',
  },
  {
    cat: 'Bidding & Anti-Snipe',
    q: 'How does anti-snipe protection prevent last-second bot bids?',
    a: 'If any buyer places a bid within the final 30 seconds of an auction countdown, the platform engine automatically extends the close timer by +2 minutes. This cycle repeats until no further bids land, ensuring humans always have time to respond.',
  },
  {
    cat: 'Bidding & Anti-Snipe',
    q: 'What is the exact difference between an H1 win and an STA close?',
    a: 'An H1 win occurs when the highest bid reaches or exceeds the seller’s confidential reserve rate — the sale is approved automatically. An STA (Subject to Approval) close occurs when H1 is below reserve — the seller has 48 hours to accept, counter-offer, or reject the bid.',
  },
  {
    cat: 'Settlement & Billing',
    q: 'How are final quantity and price reconciled at lifting?',
    a: 'Buyers bid a rate per unit of measurement (e.g. ₹/MT). Catalogue weights are indicative estimates. Final billing is strictly calculated by multiplying your winning bid rate by the net weighed tonnage recorded on the calibrated weighbridge slip at lifting.',
  },
  {
    cat: 'Settlement & Billing',
    q: 'How long does EMD refund take if I do not win a lot?',
    a: 'If you do not win a lot, your locked EMD is automatically released back to your FerroBid wallet within 72 hours (often immediately after auction closing). You can re-use it for future auctions or withdraw to your bank account via 1-click RTGS.',
  },
]

/* ---------------------------------------------------------------------------
   MAIN COMPONENT — HowItWorks
--------------------------------------------------------------------------- */

export default function HowItWorks() {
  usePageMeta({
    title: 'How It Works — Industrial Metal Auction Lifecycle',
    description: 'One catalogue, many lots, a fair close. Learn how a scrap metal lot travels from a seller’s yard to a buyer’s truck — inspection, catalogue, live bidding, STA resolution, settlement, and weighment lifting.',
  })

  const nav = useNavigate()

  // 1. Hero Lifecycle Simulator State
  const [heroStageIdx, setHeroStageIdx] = useState<number>(0)
  const activeHeroStage = LIFECYCLE_STAGES[heroStageIdx]

  // 2. Persona Workflow Switcher State (Buyer vs Seller)
  const [persona, setPersona] = useState<'buyer' | 'seller'>('buyer')

  // 3. Interactive Timeline Active Stage State
  const [timelineIdx, setTimelineIdx] = useState<number>(0)
  const activeTimelineStage = LIFECYCLE_STAGES[timelineIdx]

  // 4. Glossary Explorer State
  const [glossaryCat, setGlossaryCat] = useState<string>('All')
  const [glossarySearch, setGlossarySearch] = useState<string>('')

  const filteredGlossary = useMemo(() => {
    return GLOSSARY_FULL.filter((item) => {
      const catMatch = glossaryCat === 'All' || item.cat === glossaryCat
      const searchMatch = !glossarySearch || item.term.toLowerCase().includes(glossarySearch.toLowerCase()) || item.def.toLowerCase().includes(glossarySearch.toLowerCase())
      return catMatch && searchMatch
    })
  }, [glossaryCat, glossarySearch])

  // 5. FAQ State
  const [faqSearch, setFaqSearch] = useState<string>('')
  const filteredFaqs = useMemo(() => {
    return HOW_IT_WORKS_FAQS.filter((item) => {
      return !faqSearch || item.q.toLowerCase().includes(faqSearch.toLowerCase()) || item.a.toLowerCase().includes(faqSearch.toLowerCase())
    })
  }, [faqSearch])

  return (
    <Page className="space-y-20 sm:space-y-32 pb-16">
      
      {/* ---------------------------------------------------------------------------
         1. FAANG EDITORIAL HERO & INTERACTIVE LIFECYCLE SIMULATOR WIDGET
      --------------------------------------------------------------------------- */}
      <section className="pt-4 sm:pt-10 animate-fade-up">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Hero Left Column */}
          <div className="lg:col-span-7 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-ember-soft border border-ember/25 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-ember-strong mb-6 shadow-sm">
              <Compass className="size-3.5" /> International Marketplace Protocol
            </div>

            <h1 className="font-display text-4xl sm:text-6xl lg:text-[3.75rem] font-extrabold tracking-tight leading-[1.06] text-balance">
              One catalogue. Many lots. <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-ember via-ember-strong to-amber-600 bg-clip-text text-transparent">
                A fair close.
              </span>
            </h1>

            <p className="text-base sm:text-xl text-ink-muted mt-6 leading-relaxed text-pretty font-normal">
              An auction on FerroBid is an audited catalogue of individually field-inspected metal lots. Here is exactly how a lot travels from a seller's yard to a buyer's truck.
            </p>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button size="lg" className="shadow-lg shadow-ember/20" onClick={() => nav('/browse')}>
                Browse Live Auctions <ArrowRight className="size-5 ml-1" />
              </Button>
              <Button size="lg" variant="secondary" onClick={() => nav('/login')}>
                Register to Bid / Sell
              </Button>
            </div>

            {/* Micro Stats */}
            <div className="mt-10 pt-6 border-t border-line grid grid-cols-4 gap-3 text-left">
              <div>
                <div className="font-display text-xl font-bold text-ink num">6</div>
                <div className="text-[11px] text-ink-muted mt-0.5 font-medium">Lifecycle Stages</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 num">100%</div>
                <div className="text-[11px] text-ink-muted mt-0.5 font-medium">Inspected First</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold text-steel dark:text-steel-strong num">24/7</div>
                <div className="text-[11px] text-ink-muted mt-0.5 font-medium">Live Audit</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold text-ember num">8</div>
                <div className="text-[11px] text-ink-muted mt-0.5 font-medium">Terms Defined</div>
              </div>
            </div>
          </div>

          {/* Hero Right Column: Interactive Lifecycle Simulator Card */}
          <div className="lg:col-span-5 relative">
            <div className="absolute -top-12 -right-8 size-80 bg-ember/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 size-72 bg-steel/15 rounded-full blur-3xl pointer-events-none" />

            {/* Card Container */}
            <div className="relative rounded-3xl bg-surface/90 backdrop-blur-2xl border border-line-strong/80 p-6 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.35)] space-y-5">
              
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-mono font-bold text-ember flex items-center gap-1.5">
                  <Zap className="size-3.5" /> LIFECYCLE SIMULATOR
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-steel-soft text-steel-strong text-[10px] font-bold">
                  STAGE {activeHeroStage.num} OF 06
                </span>
              </div>

              {/* Stage Step Pills */}
              <div className="grid grid-cols-6 gap-1 p-1 bg-surface-2 rounded-xl border border-line">
                {LIFECYCLE_STAGES.map((s, idx) => (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => setHeroStageIdx(idx)}
                    className={cx(
                      'py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer text-center',
                      heroStageIdx === idx
                        ? 'bg-ember text-white shadow-sm'
                        : 'text-ink-muted hover:text-ink hover:bg-surface'
                    )}
                  >
                    {s.num}
                  </button>
                ))}
              </div>

              {/* Active Stage Mock Preview */}
              <div className="p-4 rounded-2xl bg-canvas border border-line space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-surface border border-line">
                      {activeHeroStage.icon}
                    </div>
                    <div>
                      <div className="font-display font-bold text-sm text-ink">{activeHeroStage.title}</div>
                      <div className="text-[10px] font-mono text-ink-muted">Term: {activeHeroStage.term}</div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-ink-muted leading-relaxed">
                  {activeHeroStage.buyerFocus}
                </p>

                <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {activeHeroStage.mockBadge}
                  </span>
                  <span className="font-mono font-bold text-ink text-[11px]">
                    {activeHeroStage.mockVal}
                  </span>
                </div>
              </div>

              <div className="text-center text-[11px] text-ink-faint">
                Click stages 01–06 above to preview each step of the lot journey.
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ---------------------------------------------------------------------------
         2. LUXURY KPI DASHBOARD RIBBON
      --------------------------------------------------------------------------- */}
      <section>
        <div className="card bg-surface/90 backdrop-blur-xl p-6 sm:p-10 border border-line-strong shadow-lg grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-line">
          
          <div className="space-y-1 text-center sm:text-left">
            <div className="num text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
              <CountUp to={6} />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Lifecycle Stages</div>
            <div className="text-[11px] text-ink-faint">End-to-end transparent workflow</div>
          </div>

          <div className="space-y-1 text-center sm:text-left pt-4 sm:pt-0 sm:pl-6">
            <div className="num text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
              <CountUp to={100} suffix="%" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Inspected First</div>
            <div className="text-[11px] text-ink-faint">Nothing goes live without report</div>
          </div>

          <div className="space-y-1 text-center sm:text-left pt-4 sm:pt-0 sm:pl-6">
            <div className="num text-3xl sm:text-4xl font-extrabold text-ember tracking-tight">
              24/7
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Live Audit Trail</div>
            <div className="text-[11px] text-ink-faint">Cryptographic timestamp on bids</div>
          </div>

          <div className="space-y-1 text-center sm:text-left pt-4 sm:pt-0 sm:pl-6">
            <div className="num text-3xl sm:text-4xl font-extrabold text-steel dark:text-steel-strong tracking-tight">
              <CountUp to={8} />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Terms Defined Openly</div>
            <div className="text-[11px] text-ink-faint">Open jargon definition engine</div>
          </div>

        </div>
      </section>

      {/* ---------------------------------------------------------------------------
         3. DUAL PERSONA WORKFLOW SWITCHER (BUYER VS SELLER)
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Adapted To Your Role"
        title={<>Choose your workflow, <span className="text-ember">see your benefits</span>.</>}
        lede="Whether you are buying verified metal for your factory or liquidating surplus scrap from your plant, FerroBid provides clear transparency."
      >
        <div className="mt-8 space-y-6">
          
          {/* Persona Toggle */}
          <div className="flex justify-center">
            <div className="p-1 rounded-2xl bg-surface border border-line shadow-sm flex gap-2">
              <button
                type="button"
                onClick={() => setPersona('buyer')}
                className={cx(
                  'px-5 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2',
                  persona === 'buyer'
                    ? 'bg-ember text-white shadow-md shadow-ember/20'
                    : 'text-ink-muted hover:text-ink'
                )}
              >
                <UserCheck className="size-4" /> I Want to Buy Verified Scrap
              </button>
              <button
                type="button"
                onClick={() => setPersona('seller')}
                className={cx(
                  'px-5 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2',
                  persona === 'seller'
                    ? 'bg-steel text-white shadow-md shadow-steel/20'
                    : 'text-ink-muted hover:text-ink'
                )}
              >
                <Building2 className="size-4" /> I Want to Liquidate Surplus Scrap
              </button>
            </div>
          </div>

          {/* Persona Focus Banner */}
          <div className="card bg-surface p-6 sm:p-8 border border-line-strong shadow-lg grid sm:grid-cols-3 gap-6 text-left">
            {persona === 'buyer' ? (
              <>
                <div className="space-y-1.5">
                  <div className="font-display font-bold text-sm text-ink flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-600" /> Bidding on Facts
                  </div>
                  <div className="text-xs text-ink-muted leading-relaxed">
                    Full chemical assay & photo inspection reports available before you fund EMD or place bids.
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="font-display font-bold text-sm text-ink flex items-center gap-2">
                    <Zap className="size-4 text-ember" /> Anti-Snipe Fairness
                  </div>
                  <div className="text-xs text-ink-muted leading-relaxed">
                    No last-millisecond bot steals. Bids placed in final 30s auto-extend timer by +2 minutes.
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="font-display font-bold text-sm text-ink flex items-center gap-2">
                    <Scale className="size-4 text-steel" /> Pay Weighed Tonnage
                  </div>
                  <div className="text-xs text-ink-muted leading-relaxed">
                    Final invoice is calculated strictly at lifting via calibrated weighbridge slips. Zero arbitrary fees.
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="font-display font-bold text-sm text-ink flex items-center gap-2">
                    <Lock className="size-4 text-ember" /> Confidential Reserve Rate
                  </div>
                  <div className="text-xs text-ink-muted leading-relaxed">
                    Your reserve rate is encrypted and confidential. Buyers never see it.
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="font-display font-bold text-sm text-ink flex items-center gap-2">
                    <Shield className="size-4 text-steel" /> Zero Forced Below-Reserve Sales
                  </div>
                  <div className="text-xs text-ink-muted leading-relaxed">
                    Below-reserve bids close as STA (Subject to Approval) — you retain 100% decision control.
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="font-display font-bold text-sm text-ink flex items-center gap-2">
                    <Banknote className="size-4 text-emerald-600" /> Automated GST & TCS Settlement
                  </div>
                  <div className="text-xs text-ink-muted leading-relaxed">
                    Full tax compliance invoicing and direct bank account fund release within 48 hours.
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         4. INTERACTIVE 6-STAGE LIFECYCLE TIMELINE
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="The Complete Lifecycle"
        title={<>From yard to truck, <span className="text-ember">step by step</span>.</>}
        lede="Click any stage below to inspect the interactive workflow, buyer/seller focus, and system audit logs."
      >
        <div className="mt-8 grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Timeline Navigation Buttons */}
          <div className="lg:col-span-5 space-y-3">
            {LIFECYCLE_STAGES.map((st, idx) => (
              <button
                key={st.num}
                type="button"
                onClick={() => setTimelineIdx(idx)}
                className={cx(
                  'w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4',
                  timelineIdx === idx
                    ? 'bg-surface border-ember ring-2 ring-ember/20 shadow-md'
                    : 'bg-surface/50 border-line hover:border-line-strong hover:bg-surface'
                )}
              >
                <div className={cx(
                  'size-9 rounded-xl grid place-items-center font-mono font-bold text-xs shrink-0',
                  timelineIdx === idx ? 'bg-ember text-white' : 'bg-surface-2 text-ink-muted'
                )}>
                  {st.num}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-sm text-ink flex items-center justify-between">
                    {st.title}
                    {timelineIdx === idx && <ChevronRight className="size-4 text-ember" />}
                  </div>
                  <div className="text-[11px] text-ink-muted mt-0.5 font-mono">
                    Term: <span className="text-steel font-semibold">{st.term}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right Column: Active Stage Interactive Display Card */}
          <div className="lg:col-span-7">
            <div className="card bg-gradient-to-br from-surface to-surface-2/60 p-6 sm:p-8 border border-line-strong shadow-xl space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-surface border border-line shadow-sm">
                    {activeTimelineStage.icon}
                  </div>
                  <div>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ember">
                      STAGE {activeTimelineStage.num} OF 06 · {activeTimelineStage.term}
                    </span>
                    <h3 className="font-display text-xl font-bold text-ink">
                      {activeTimelineStage.title}
                    </h3>
                  </div>
                </div>

                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  {activeTimelineStage.mockBadge}
                </div>
              </div>

              {/* Role-Specific Focus Box */}
              <div className="p-4 rounded-2xl bg-surface border border-line text-xs space-y-2">
                <div className="font-bold text-ink flex items-center gap-1.5">
                  <Sparkles className="size-4 text-ember" />
                  {persona === 'buyer' ? 'Buyer Advantage:' : 'Seller Advantage:'}
                </div>
                <p className="text-ink-muted leading-relaxed">
                  {persona === 'buyer' ? activeTimelineStage.buyerFocus : activeTimelineStage.sellerFocus}
                </p>
              </div>

              {/* Stage Checklist Bullets */}
              <ul className="space-y-2.5">
                {activeTimelineStage.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-ink font-medium">
                    <span className="mt-0.5 size-4 rounded-full bg-ember-soft text-ember-strong grid place-items-center shrink-0">
                      <Check className="size-3 stroke-[3]" />
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {/* Footer System Audit Strip */}
              <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between">
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                  Audit Verification
                </span>
                <span className="num text-sm font-mono font-extrabold text-ink">
                  {activeTimelineStage.mockVal}
                </span>
              </div>

            </div>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         5. PLATFORM SECURITY & SAFEGUARDS ENGINE SHOWCASE
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Platform Safeguards"
        title={<>Built on three core <span className="text-ember">trust guarantees</span>.</>}
        lede="Every auction on FerroBid operates under strict technical rules that protect buyers and sellers equally."
      >
        <div className="mt-8 grid sm:grid-cols-3 gap-6">
          
          <div className="card p-6 space-y-4 border border-line hover:border-line-strong transition-all bg-surface">
            <div className="size-12 rounded-2xl bg-ember-soft text-ember-strong grid place-items-center">
              <Zap className="size-6" />
            </div>
            <h3 className="font-display font-bold text-lg text-ink">1. Anti-Snipe Engine</h3>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Bids submitted in the final 30 seconds automatically extend the auction clock by +2 minutes. No last-second bot snipes allowed.
            </p>
            <div className="pt-2 text-xs font-mono font-bold text-ember">
              Rule: +2m Dynamic Window
            </div>
          </div>

          <div className="card p-6 space-y-4 border border-line hover:border-line-strong transition-all bg-surface">
            <div className="size-12 rounded-2xl bg-steel-soft text-steel-strong grid place-items-center">
              <Lock className="size-6" />
            </div>
            <h3 className="font-display font-bold text-lg text-ink">2. Confidential Reserve</h3>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Seller reserve prices are encrypted. If the highest bid is below reserve, it closes as STA (Subject to Approval). Zero forced sales.
            </p>
            <div className="pt-2 text-xs font-mono font-bold text-steel dark:text-steel-strong">
              Rule: 100% Encrypted
            </div>
          </div>

          <div className="card p-6 space-y-4 border border-line hover:border-line-strong transition-all bg-surface">
            <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center">
              <ShieldCheck className="size-6" />
            </div>
            <h3 className="font-display font-bold text-lg text-ink">3. 72h EMD Auto-Refund</h3>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Earnest money locked for bidding is automatically released to your wallet within 72 hours of losing a lot. 1-click RTGS withdrawal.
            </p>
            <div className="pt-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              Rule: Instant Escrow Release
            </div>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         6. SEARCHABLE INTERACTIVE JARGON & GLOSSARY EXPLORER
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Speak The Language"
        title={<>The terms, <span className="text-ember">defined openly</span>.</>}
        lede="Defining industry jargon openly is our ultimate trust signal. Browse or search any platform term below."
      >
        <div className="mt-8 space-y-6">
          
          {/* Category Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {['All', 'Bidding Rules', 'Financial & EMD', 'Inspection & Quality', 'Logistics & Weighment'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setGlossaryCat(cat)}
                  className={cx(
                    'px-3.5 py-1.5 rounded-full text-xs font-display font-bold transition-all cursor-pointer',
                    glossaryCat === cat
                      ? 'bg-steel text-white shadow-sm'
                      : 'bg-surface border border-line text-ink-muted hover:text-ink'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-2.5 size-4 text-ink-faint" />
              <input
                type="text"
                placeholder="Search terms (e.g. STA, EMD)..."
                value={glossarySearch}
                onChange={(e) => setGlossarySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-surface border border-line text-xs text-ink focus:outline-none focus:border-ember"
              />
            </div>
          </div>

          {/* Glossary Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredGlossary.length > 0 ? (
              filteredGlossary.map((g) => (
                <div key={g.term} className="card p-5 border border-line hover:border-line-strong transition-all space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="font-display font-extrabold text-base text-ink">{g.term}</dt>
                    <span className="px-2.5 py-0.5 rounded-full bg-steel-soft text-steel-strong text-[10px] font-bold">
                      {g.cat}
                    </span>
                  </div>
                  <dd className="text-xs sm:text-sm text-ink-muted leading-relaxed">{g.def}</dd>
                </div>
              ))
            ) : (
              <div className="sm:col-span-2 p-8 text-center text-xs text-ink-muted">
                No matching terms found for "{glossarySearch}". Try searching "EMD" or "STA".
              </div>
            )}
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         7. INTERNATIONAL COMPLIANCE & QUALITY GRID
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Enterprise Compliance"
        title={<>International standards <span className="text-ember">on every catalogue</span>.</>}
        lede="Designed to satisfy corporate compliance, environmental regulations, and GST/TCS tax audit trails."
      >
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="card p-5 space-y-2 border border-line">
            <div className="size-8 rounded-lg bg-ember-soft text-ember-strong grid place-items-center font-bold">
              <Scale className="size-4" />
            </div>
            <h4 className="font-display font-bold text-sm text-ink">ISO Calibrated Weighbridge</h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              Weighment slips verified against calibrated state metrology standards.
            </p>
          </div>

          <div className="card p-5 space-y-2 border border-line">
            <div className="size-8 rounded-lg bg-steel-soft text-steel-strong grid place-items-center font-bold">
              <ShieldCheck className="size-4" />
            </div>
            <h4 className="font-display font-bold text-sm text-ink">Radiation & Hazard Scan</h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              Gamma radiation and explosive hazard check certified before listing.
            </p>
          </div>

          <div className="card p-5 space-y-2 border border-line">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center font-bold">
              <FileText className="size-4" />
            </div>
            <h4 className="font-display font-bold text-sm text-ink">GST & TCS E-Invoicing</h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              Automated government tax compliance portal integration.
            </p>
          </div>

          <div className="card p-5 space-y-2 border border-line">
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 grid place-items-center font-bold">
              <Truck className="size-4" />
            </div>
            <h4 className="font-display font-bold text-sm text-ink">E-Way Bill Gate Pass</h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              Digital gate pass & transit e-way bill issued directly inside buyer portal.
            </p>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         8. INTERACTIVE SEARCHABLE FAQ
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Common Questions"
        title="The mechanics, answered clearly."
        lede="Answers regarding as-is-where-is rules, STA decisions, weighment, and anti-snipe logic."
      >
        <div className="mt-8 space-y-6">
          
          {/* Search Input */}
          <div className="relative max-w-md mx-auto sm:mx-0">
            <Search className="absolute left-3 top-2.5 size-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search mechanics & questions..."
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-surface border border-line text-xs text-ink focus:outline-none focus:border-ember"
            />
          </div>

          {/* Accordion List */}
          <div className="divide-y divide-line border border-line rounded-2xl bg-surface overflow-hidden shadow-sm">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((it, idx) => (
                <details key={idx} className="group">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden px-6 py-4 hover:bg-surface-2 transition-colors">
                    <span className="font-display font-bold text-sm sm:text-base text-ink">{it.q}</span>
                    <ChevronDown className="size-4 text-ink-faint shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-6 pb-5 text-xs sm:text-sm text-ink-muted leading-relaxed">
                    {it.a}
                  </div>
                </details>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-ink-muted">
                No matching questions found for "{faqSearch}". Try another search term.
              </div>
            )}
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         9. FAANG LUXURY CLOSING CTA BANNER
      --------------------------------------------------------------------------- */}
      <CtaBand
        eyebrow="SEE THE PROTOCOL IN ACTION"
        title={<>Now Follow A Real Lot Through <br /><span className="bg-gradient-to-r from-ember via-amber-500 to-emerald-600 bg-clip-text text-transparent">Its Countdown &amp; Audit Trail.</span></>}
        sub="Open any live catalogue to inspect real field reports, chemical composition breakdown, anti-snipe countdown extensions, and automated gate pass issuing."
        trustBadges={[
          { icon: <CheckCircle2 size={15} className="text-emerald-600" />, label: 'Transparent Bidding Protocol' },
          { icon: <ShieldCheck size={15} className="text-emerald-600" />, label: 'ISO Calibrated Weighbridge Audits' },
          { icon: <Clock size={15} className="text-emerald-600" />, label: '24/7 Live Monitoring Desk' },
        ]}
        primary={{ label: 'Browse Live Catalogues', to: '/browse' }}
        secondary={{ label: 'Explore For Buyers', to: '/g2/solutions/buyers' }}
      />

    </Page>
  )
}
