/* Guest 2 — Solutions · For Sellers (FAANG-level Luxury Flagship Page).
   Includes live seller liquidation desk simulator, dynamic seller revenue yield calculator,
   4-step interactive seller pipeline stepper, confidential reserve & STA engine showcase,
   yard inspection explorer, FAANG comparison matrix, and executive seller testimonials. */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PackagePlus, ClipboardCheck, BookOpen, Banknote, ShieldCheck, ArrowRight,
  ChevronRight, TrendingUp, CheckCircle2, Lock, Sparkles, ChevronDown,
  Search, Check, X, BadgeCheck, MapPin, Calculator, Zap, BarChart3,
  Shield, Coins, AlertCircle, CheckCircle, EyeOff
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, cx } from '../../components/ui'
import { Section, CtaBand, usePageMeta, CountUp } from './marketing'

/* ---------------------------------------------------------------------------
   DATA STRUCTURES FOR SELLER INTERACTIVE COMPONENTS
--------------------------------------------------------------------------- */

// 1. Interactive Seller Pipeline Steps
const SELLER_PIPELINE = [
  {
    num: '01',
    title: 'Submit Lot & Specifications',
    subtitle: 'Bulk CSV / photo upload',
    icon: <PackagePlus className="size-6 text-ember" />,
    desc: 'Submit your surplus metal, mill scrap, or heavy machinery inventory in minutes. Upload photos, indicative quantities, grade details, and yard locations.',
    bullets: [
      'Bulk inventory upload via simple Excel / CSV template',
      'Set your confidential reserve rate per metric ton',
      'Choose preferred auction date and lifting timeframe',
    ],
    mockBadge: 'Submission Received',
    mockVal: 'Lot #SL-9910 Created',
  },
  {
    num: '02',
    title: 'On-Site Field Inspection',
    subtitle: 'Zero plant disruption',
    icon: <ClipboardCheck className="size-6 text-steel" />,
    desc: 'Our certified field inspector visits your yard, photographs the lot, verifies grade/thickness, and verifies weighbridge calibration without disturbing your plant operations.',
    bullets: [
      'Complete physical verification & 42-point quality check',
      'Spectrometer chemical assay & radioactive safety scan',
      'Verified digital inspection report attached to catalogue',
    ],
    mockBadge: 'Field Audit Passed',
    mockVal: 'Report #FE-8810 Verified',
  },
  {
    num: '03',
    title: 'Catalogued with Sealed Reserve',
    subtitle: 'Reserve 100% confidential',
    icon: <BookOpen className="size-6 text-ember" />,
    desc: 'Your lot enters a scheduled live auction exposed to 1,400+ EMD-backed corporate buyers. Your reserve price remains strictly confidential and encrypted.',
    bullets: [
      'Reserve rate is never revealed to buyers or competing bidders',
      'Auction closes below reserve automatically switch to STA status',
      'Only KYC-verified, EMD-funded buyers are allowed to bid',
    ],
    mockBadge: 'Reserve Encrypted',
    mockVal: '🔒 Sealed Reserve Active',
  },
  {
    num: '04',
    title: 'Live Bidding & GST Settlement',
    subtitle: 'Get paid, issue gate pass',
    icon: <Banknote className="size-6 text-steel" />,
    desc: 'Watch competitive bidding drive up your price in real time. Upon auction closing, post-auction settlement processes GST/TCS with instant fund transfer.',
    bullets: [
      'Automated GST & TCS tax computation and compliance invoice',
      '1-click digital Delivery Order (DO) & vehicle gate pass',
      'Weighbridge slip reconciles final billed weight at lifting',
    ],
    mockBadge: 'Settlement Complete',
    mockVal: 'GST Invoice Issued · Funds Credited',
  },
]

// 2. FAANG Seller Comparison Matrix Data
const SELLER_COMPARISON_ROWS = [
  {
    feature: 'Price Realization & Competition',
    trad: '1 or 2 local scrap dealers; price negotiated in private with high margins',
    ferrobid: '1,400+ EMD-backed corporate buyers competing live, driving +4.2% average price lift',
  },
  {
    feature: 'Reserve Rate Protection',
    trad: 'No reserve protection; pressure to sell at dealer’s lowball offer',
    ferrobid: '100% confidential reserve price; below-reserve closes as STA (zero forced sales)',
  },
  {
    feature: 'Yard Inspections & Disruption',
    trad: 'Dozens of unvetted dealers visiting your plant, interrupting operations',
    ferrobid: 'Single visit by a certified FerroBid auditor; buyers inspect the digital catalogue',
  },
  {
    feature: 'Weighment & Deduction Transparency',
    trad: 'Arbitrary moisture/dirt deductions (5-15%) and dubious dealer weighbridges',
    ferrobid: 'Calibrated weighbridge slip reconciliation; zero un-audited deductions',
  },
  {
    feature: 'Tax & Compliance Audit Trail',
    trad: 'Manual cash transactions or delayed GST/TCS filing causing tax liability',
    ferrobid: '100% digital tax audit trail; automated GST & TCS computation with instant receipt',
  },
]

// 3. FAQ List with Categories for Sellers
const SELLER_FAQ_CATEGORIES = ['All', 'Reserve & STA Rules', 'Yard Inspection', 'Buyer EMD & Security', 'Payment & GST Settlement']

const SELLER_FAQS_DETAILED = [
  {
    cat: 'Reserve & STA Rules',
    q: 'How is my reserve price protected during the live auction?',
    a: 'Your reserve price is strictly confidential and encrypted in the system — buyers never see it. If the highest bid (H1) at auction close is below your reserve price, the auction automatically enters STA (Subject To Approval) status. The material is never forcibly sold below reserve. You retain full control to accept the H1 rate, issue a counter-offer, or decline.',
  },
  {
    cat: 'Reserve & STA Rules',
    q: 'What happens if an auction closes in STA (Subject To Approval)?',
    a: 'In an STA situation, you receive a notification in your seller dashboard with the highest bidder’s rate. You have up to 48 hours to either: (1) Accept the H1 bid and proceed to settlement, (2) Propose a counter-offer rate to H1, or (3) Reject the bid and re-list the lot for a future scheduled auction.',
  },
  {
    cat: 'Yard Inspection',
    q: 'Do I need to manage yard visits when buyers want to inspect the scrap?',
    a: 'No! That is one of FerroBid’s biggest seller benefits. You do not need to host dozens of unverified buyers at your facility. A single certified FerroBid Field Auditor visits your yard, conducts a complete physical & chemical inspection, takes high-res photographs, and files a verified catalogue report.',
  },
  {
    cat: 'Yard Inspection',
    q: 'How long does a field inspection take, and does it interrupt plant operations?',
    a: 'Inspections typically take 45–90 minutes per lot. Our field auditors follow strict industrial safety protocols and work around your operational schedule to ensure zero disruption to your daily plant activities.',
  },
  {
    cat: 'Buyer EMD & Security',
    q: 'Who is allowed to bid on my listed material?',
    a: 'Only KYC-verified corporate entities who have deposited earnest money (EMD) specifically for your lot can place bids. Defaulters or unvetted brokers are strictly blocked from participating.',
  },
  {
    cat: 'Buyer EMD & Security',
    q: 'What happens if the winning H1 buyer defaults on payment or fails to lift?',
    a: 'Because buyers must lock refundable EMD prior to bidding, any default results in immediate forfeiture of the buyer’s EMD. The forfeited EMD is credited to you per platform terms, and the lot is offered to H2 or re-auctioned.',
  },
  {
    cat: 'Payment & GST Settlement',
    q: 'When and how do I receive payment for sold surplus metal?',
    a: 'After auction closing and buyer payment settlement, funds are transferred directly to your corporate bank account via RTGS/NEFT within 48 hours. Full GST e-invoices and TCS certificates are generated automatically in your portal.',
  },
  {
    cat: 'Payment & GST Settlement',
    q: 'Can I sell surplus scrap if my company already has a buyer account?',
    a: 'Yes! Selling is a built-in platform capability, not a separate registration. Once your corporate business entity and GST details are verified, selling features unlock instantly on your existing login.',
  },
]

/* ---------------------------------------------------------------------------
   MAIN COMPONENT — SolutionsSellers
--------------------------------------------------------------------------- */

export default function SolutionsSellers() {
  usePageMeta({
    title: 'For Sellers — Industrial Asset Liquidation & Surplus Metal Platform',
    description: 'Turn industrial scrap and surplus metal into maximum market price with paperwork handled. Inspected, catalogued, and sold to EMD-backed corporate buyers with confidential reserve rate protection.',
  })

  const nav = useNavigate()

  // 1. Live Seller Desk Simulator State
  const [heroBidRate, setHeroBidRate] = useState(41800)
  const [heroBidCount, setHeroBidCount] = useState(18)
  const [heroStaStatus, setHeroStaStatus] = useState<'bidding' | 'approved' | 'sta'>('bidding')

  const handleSimulateClose = () => {
    if (heroBidRate >= 40000) {
      setHeroStaStatus('approved')
    } else {
      setHeroStaStatus('sta')
    }
  }

  const handleResetHero = () => {
    setHeroBidRate(41800)
    setHeroBidCount(18)
    setHeroStaStatus('bidding')
  }

  // 2. Interactive Pipeline Stepper State
  const [activeStep, setActiveStep] = useState<number>(0)

  // 3. Seller Yield Calculator State
  const [surplusTons, setSurplusTons] = useState<number>(850)
  const [baseRate, setBaseRate] = useState<number>(38000)
  const [middlemanDeductionPct, setMiddlemanDeductionPct] = useState<number>(5.0)

  const yieldCalculations = useMemo(() => {
    // Base valuation = SurplusTons * BaseRate
    const rawValuation = surplusTons * baseRate
    // Middleman payout = RawValuation * (1 - MiddlemanDeductionPct/100)
    const middlemanPayout = Math.round(rawValuation * (1 - middlemanDeductionPct / 100))
    // FerroBid payout = RawValuation * 1.042 (4.2% competitive bidding lift)
    const ferrobidPayout = Math.round(rawValuation * 1.042)
    // Net cash gain
    const netGain = ferrobidPayout - middlemanPayout

    return {
      rawValuation,
      middlemanPayout,
      ferrobidPayout,
      netGain,
    }
  }, [surplusTons, baseRate, middlemanDeductionPct])

  // 4. Confidential Reserve & STA Simulator State
  const [staMode, setStaMode] = useState<'above' | 'below'>('below')
  const [staDecision, setStaDecision] = useState<'none' | 'accepted' | 'countered' | 'rejected'>('none')

  // 5. FAQ State
  const [faqCat, setFaqCat] = useState<string>('All')
  const [faqSearch, setFaqSearch] = useState<string>('')

  const filteredFaqs = useMemo(() => {
    return SELLER_FAQS_DETAILED.filter((item) => {
      const catMatch = faqCat === 'All' || item.cat === faqCat
      const searchMatch = !faqSearch || item.q.toLowerCase().includes(faqSearch.toLowerCase()) || item.a.toLowerCase().includes(faqSearch.toLowerCase())
      return catMatch && searchMatch
    })
  }, [faqCat, faqSearch])

  return (
    <Page className="space-y-20 sm:space-y-32 pb-16">
      
      {/* ---------------------------------------------------------------------------
         1. FAANG EDITORIAL SELLER HERO & LIVE LIQUIDATION DESK WIDGET
      --------------------------------------------------------------------------- */}
      <section className="pt-4 sm:pt-10 animate-fade-up">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Hero Left Column: Editorial Headline & Actions */}
          <div className="lg:col-span-7 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-ember-soft border border-ember/25 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-ember-strong mb-6 shadow-sm">
              <Shield className="size-3.5" /> Institutional Asset Disposal Engine
            </div>

            <h1 className="font-display text-4xl sm:text-6xl lg:text-[3.75rem] font-extrabold tracking-tight leading-[1.06] text-balance">
              Turn surplus metal into <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-ember via-ember-strong to-amber-600 bg-clip-text text-transparent">
                maximized market yield
              </span>
            </h1>

            <p className="text-base sm:text-xl text-ink-muted mt-6 leading-relaxed text-pretty font-normal">
              Submit your material once. Our certified field team inspects it, catalogues it, and exposes it to 1,400+ EMD-backed corporate buyers — with your reserve rate 100% confidential and protected.
            </p>

            {/* CTA Action Row */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button size="lg" className="shadow-lg shadow-ember/20" onClick={() => nav('/login')}>
                List Your Surplus Lot <ArrowRight className="size-5 ml-1" />
              </Button>
              <Button size="lg" variant="secondary" onClick={() => nav('/g2/contact')}>
                Schedule Yard Inspection
              </Button>
            </div>

            {/* Micro Trust Pills */}
            <div className="mt-10 pt-6 border-t border-line grid grid-cols-3 gap-4 text-left">
              <div>
                <div className="font-display text-xl font-bold text-ink num">100%</div>
                <div className="text-xs text-ink-muted mt-0.5 font-medium">Confidential Reserve</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 num flex items-center gap-1">
                  <TrendingUp className="size-4 shrink-0" /> +4.2%
                </div>
                <div className="text-xs text-ink-muted mt-0.5 font-medium">Avg Price Realization</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold text-steel dark:text-steel-strong num">1,400+</div>
                <div className="text-xs text-ink-muted mt-0.5 font-medium">EMD Buyers</div>
              </div>
            </div>
          </div>

          {/* Hero Right Column: Interactive Seller Liquidation Desk Widget */}
          <div className="lg:col-span-5 relative">
            {/* Ambient Backlight Glow */}
            <div className="absolute -top-12 -right-8 size-80 bg-ember/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 size-steel/15 rounded-full blur-3xl pointer-events-none" />

            {/* Main Interactive Seller Desk Card */}
            <div className="relative rounded-3xl bg-surface/90 backdrop-blur-2xl border border-line-strong/80 p-6 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.35)] space-y-5">
              
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-steel-soft text-steel-strong text-[11px] font-mono font-bold tracking-tight">
                    LOT #SL-9910 · SELLER DISPOSAL DESK
                  </div>
                  <h3 className="font-display text-base font-bold text-ink mt-1.5 leading-snug">
                    850 MT Mixed Heavy Steel Scrap
                  </h3>
                  <div className="text-xs text-ink-muted flex items-center gap-1.5 mt-1">
                    <MapPin className="size-3.5 text-ember shrink-0" /> Jindal Plant Yard · Odisha
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                    <Lock className="size-3" /> Reserve Sealed
                  </div>
                </div>
              </div>

              {/* Confidential Reserve Status Box */}
              <div className="p-3.5 rounded-2xl bg-surface-2/80 border border-line text-xs space-y-1">
                <div className="flex justify-between items-center font-bold text-ink">
                  <span className="flex items-center gap-1.5">
                    <EyeOff className="size-4 text-ember" /> Confidential Reserve Rate:
                  </span>
                  <span className="font-mono text-ember font-extrabold">₹40,000 / MT (Hidden)</span>
                </div>
                <div className="text-[11px] text-ink-muted">
                  Buyers cannot see your reserve price. Below-reserve closes as STA (Subject to Approval).
                </div>
              </div>

              {/* Live H1 Bidding Rate Monitor */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-steel-soft/60 to-surface border border-steel/20 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Current Highest Bid (H1)</div>
                  <div className="num text-2xl font-extrabold text-ink mt-0.5">
                    ₹{heroBidRate.toLocaleString('en-IN')} <span className="text-xs font-sans text-ink-muted">/ MT</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-0.5">
                    <TrendingUp className="size-3.5" /> Exceeds Reserve!
                  </div>
                  <div className="text-[11px] text-ink-faint mt-0.5 num">{heroBidCount} Active Bids</div>
                </div>
              </div>

              {/* Interactive Auction Close Trigger */}
              <div className="space-y-2">
                {heroStaStatus === 'bidding' ? (
                  <button
                    type="button"
                    onClick={handleSimulateClose}
                    className="w-full py-3.5 px-4 rounded-2xl bg-ember hover:bg-ember-strong text-white font-display font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <CheckCircle className="size-4" />
                    Simulate Auction Close & Verify Reserve Hit
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium space-y-2 animate-bid-in">
                    <div className="font-bold text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-600" /> Auction Closed — Sale Auto-Approved!
                    </div>
                    <div>
                      Highest Bid of <strong>₹{heroBidRate.toLocaleString('en-IN')}/MT</strong> exceeds your confidential reserve (₹40,000). Total Lot Value: <strong>₹{((heroBidRate * 850) / 100000).toFixed(2)} Lakhs</strong>.
                    </div>
                    <button
                      type="button"
                      onClick={handleResetHero}
                      className="text-xs text-emerald-800 dark:text-emerald-200 font-bold underline cursor-pointer"
                    >
                      Reset Simulator
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Guarantee Strip */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-ink-muted border-t border-line">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3 text-steel" /> EMD-Backed Bidders Only
                </span>
                <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <Banknote className="size-3" /> GST / TCS Auto-Computed
                </span>
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
              <CountUp to={100} suffix="%" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Confidential Reserve</div>
            <div className="text-[11px] text-ink-faint">Sealed and encrypted from all buyers</div>
          </div>

          <div className="space-y-1 text-center sm:text-left pt-4 sm:pt-0 sm:pl-6">
            <div className="num text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight flex items-center justify-center sm:justify-start gap-1">
              <CountUp to={4.2} prefix="+" suffix="%" decimals={1} />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Avg Price Lift</div>
            <div className="text-[11px] text-ink-faint">Above baseline yard scrap valuation</div>
          </div>

          <div className="space-y-1 text-center sm:text-left pt-4 sm:pt-0 sm:pl-6">
            <div className="num text-3xl sm:text-4xl font-extrabold text-ember tracking-tight">
              <CountUp to={1400} suffix="+" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">EMD-Backed Buyers</div>
            <div className="text-[11px] text-ink-faint">KYC-verified corporate buyers</div>
          </div>

          <div className="space-y-1 text-center sm:text-left pt-4 sm:pt-0 sm:pl-6">
            <div className="num text-3xl sm:text-4xl font-extrabold text-steel dark:text-steel-strong tracking-tight">
              &lt;48 Hours
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Post-Auction Settlement</div>
            <div className="text-[11px] text-ink-faint">Direct RTGS payment with GST / TCS</div>
          </div>

        </div>
      </section>

      {/* ---------------------------------------------------------------------------
         3. INTERACTIVE SELLER REVENUE YIELD CALCULATOR
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Revenue Intelligence"
        title={<>Calculate your liquidation <span className="text-ember">revenue yield</span>.</>}
        lede="See how much more revenue your company realizes by switching from local scrap dealers to FerroBid’s competitive 1,400+ buyer network."
      >
        <div className="mt-8 card bg-surface p-6 sm:p-10 border border-line-strong shadow-xl grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Sliders Input Column */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Slider 1: Surplus Volume */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <label className="font-display font-bold text-ink flex items-center gap-2">
                  <BarChart3 className="size-4 text-ember" /> Surplus Material / Scrap Volume
                </label>
                <span className="num font-mono font-extrabold text-ember text-base">
                  {surplusTons.toLocaleString('en-IN')} MT
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={10000}
                step={50}
                value={surplusTons}
                onChange={(e) => setSurplusTons(Number(e.target.value))}
                className="w-full h-2 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-ember"
              />
              <div className="flex justify-between text-[11px] text-ink-faint">
                <span>100 MT</span>
                <span>5,000 MT</span>
                <span>10,000 MT</span>
              </div>
            </div>

            {/* Slider 2: Base Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <label className="font-display font-bold text-ink flex items-center gap-2">
                  <Calculator className="size-4 text-steel" /> Estimated Base Scrap Rate
                </label>
                <span className="num font-mono font-extrabold text-steel dark:text-steel-strong text-base">
                  ₹{baseRate.toLocaleString('en-IN')} / MT
                </span>
              </div>
              <input
                type="range"
                min={20000}
                max={120000}
                step={1000}
                value={baseRate}
                onChange={(e) => setBaseRate(Number(e.target.value))}
                className="w-full h-2 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-steel"
              />
              <div className="flex justify-between text-[11px] text-ink-faint">
                <span>₹20,000</span>
                <span>₹70,000</span>
                <span>₹1,20,000</span>
              </div>
            </div>

            {/* Slider 3: Middleman Deduction % */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <label className="font-display font-bold text-ink flex items-center gap-2">
                  <Coins className="size-4 text-ember" /> Traditional Dealer Commission & Deductions
                </label>
                <span className="num font-mono font-extrabold text-ink text-base">
                  {middlemanDeductionPct.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={1.0}
                max={10.0}
                step={0.5}
                value={middlemanDeductionPct}
                onChange={(e) => setMiddlemanDeductionPct(Number(e.target.value))}
                className="w-full h-2 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-ember"
              />
              <div className="flex justify-between text-[11px] text-ink-faint">
                <span>1.0%</span>
                <span>5.0%</span>
                <span>10.0%</span>
              </div>
            </div>

          </div>

          {/* Calculation Output Card (Right Column) */}
          <div className="lg:col-span-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-steel-soft/80 via-surface to-ember-soft/30 border border-line-strong shadow-lg space-y-6">
              
              <div className="text-xs font-bold uppercase tracking-wider text-ember-strong flex items-center gap-1.5">
                <Sparkles className="size-4" /> Estimated Net Seller Cash Advantage
              </div>

              {/* Net Cash Gain Number */}
              <div>
                <div className="text-xs text-ink-muted font-medium">Additional Net Revenue Realized</div>
                <div className="num text-3xl sm:text-5xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">
                  +₹{yieldCalculations.netGain.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Comparison Breakdown */}
              <div className="space-y-3 border-t border-b border-line py-4 text-xs sm:text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">FerroBid Realization (+4.2% bid lift):</span>
                  <span className="num font-bold text-ink">
                    ₹{yieldCalculations.ferrobidPayout.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Traditional Dealer Net Payout:</span>
                  <span className="num font-bold text-ink-faint">
                    ₹{yieldCalculations.middlemanPayout.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Eliminated Middleman Fees:</span>
                  <span className="num font-bold text-ember">
                    {middlemanDeductionPct}% Saved
                  </span>
                </div>
              </div>

              {/* Settlement Footnote */}
              <div className="flex items-center gap-2 text-xs text-ink-muted font-medium">
                <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                GST / TCS compliance handled with direct RTGS payment in &lt;48 hours.
              </div>

            </div>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         4. FAANG INTERACTIVE 4-STEP SELLER PIPELINE STEPPER
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="The Seller Pipeline"
        title={<>Submit once, <span className="text-ember">we handle the rest</span>.</>}
        lede="Designed to streamline industrial asset liquidation. From lot submission to bank account credit, every step is fully managed."
      >
        <div className="mt-8 grid lg:grid-cols-12 gap-8 items-center">
          
          {/* Stepper Buttons (Left Column) */}
          <div className="lg:col-span-5 space-y-3">
            {SELLER_PIPELINE.map((step, idx) => (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={cx(
                  'w-full text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4',
                  activeStep === idx
                    ? 'bg-surface border-ember ring-2 ring-ember/20 shadow-md'
                    : 'bg-surface/50 border-line hover:border-line-strong hover:bg-surface'
                )}
              >
                <div className={cx(
                  'size-10 rounded-xl grid place-items-center font-mono font-bold text-sm shrink-0',
                  activeStep === idx ? 'bg-ember text-white' : 'bg-surface-2 text-ink-muted'
                )}>
                  {step.num}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-base text-ink flex items-center justify-between">
                    {step.title}
                    {activeStep === idx && <ChevronRight className="size-4 text-ember" />}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">{step.subtitle}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Stepper Preview Display (Right Column) */}
          <div className="lg:col-span-7">
            <div className="card bg-gradient-to-br from-surface to-surface-2/60 p-6 sm:p-8 border border-line-strong shadow-xl space-y-6">
              
              {/* Card Header */}
              <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-surface border border-line shadow-sm">
                    {SELLER_PIPELINE[activeStep].icon}
                  </div>
                  <div>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ember">
                      STAGE {SELLER_PIPELINE[activeStep].num} OF 04
                    </span>
                    <h3 className="font-display text-xl font-bold text-ink">
                      {SELLER_PIPELINE[activeStep].title}
                    </h3>
                  </div>
                </div>

                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  {SELLER_PIPELINE[activeStep].mockBadge}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                {SELLER_PIPELINE[activeStep].desc}
              </p>

              {/* Feature Bullets */}
              <ul className="space-y-2.5">
                {SELLER_PIPELINE[activeStep].bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-ink font-medium">
                    <span className="mt-0.5 size-4 rounded-full bg-ember-soft text-ember-strong grid place-items-center shrink-0">
                      <Check className="size-3 stroke-[3]" />
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              {/* Stage Value Metric Strip */}
              <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between">
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                  System Status
                </span>
                <span className="num text-sm font-mono font-extrabold text-ink">
                  {SELLER_PIPELINE[activeStep].mockVal}
                </span>
              </div>

            </div>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         5. CONFIDENTIAL RESERVE & STA ENGINE SHOWCASE
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Protection Built In"
        title={<>Your confidential reserve rate, <span className="text-ember">your terms</span>.</>}
        lede="Never worry about forced lowball sales. Your reserve price remains 100% confidential, and below-reserve closes automatically trigger STA status."
      >
        <div className="mt-8 card bg-surface p-6 sm:p-10 border border-line-strong shadow-xl grid lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Interactive STA Engine Controls */}
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ember-soft text-ember-strong text-xs font-bold">
              <Zap className="size-3.5" /> Interactive STA Engine Simulator
            </div>

            <h3 className="font-display text-2xl font-bold text-ink">
              Test Below-Reserve Auction Protection (STA)
            </h3>

            <p className="text-sm text-ink-muted leading-relaxed">
              If an auction closes below your confidential reserve, it automatically enters STA (Subject to Approval). The material is <strong>never auto-sold</strong>. You retain 100% control to Accept, Counter, or Reject.
            </p>

            {/* Mode Switcher */}
            <div className="flex gap-2 p-1 rounded-xl bg-surface-2 border border-line w-fit">
              <button
                type="button"
                onClick={() => { setStaMode('below'); setStaDecision('none') }}
                className={cx(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  staMode === 'below' ? 'bg-ember text-white shadow-sm' : 'text-ink-muted hover:text-ink'
                )}
              >
                Simulate Below-Reserve (STA)
              </button>
              <button
                type="button"
                onClick={() => { setStaMode('above'); setStaDecision('none') }}
                className={cx(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  staMode === 'above' ? 'bg-steel text-white shadow-sm' : 'text-ink-muted hover:text-ink'
                )}
              >
                Simulate Above-Reserve Hit
              </button>
            </div>

            {/* Decision Buttons (for STA mode) */}
            {staMode === 'below' && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-ink">Seller Action Options:</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStaDecision('accepted')}
                    className={cx(
                      'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                      staDecision === 'accepted' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-surface border-line text-ink hover:bg-surface-2'
                    )}
                  >
                    Accept H1 Bid
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaDecision('countered')}
                    className={cx(
                      'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                      staDecision === 'countered' ? 'bg-amber-600 text-white border-amber-600' : 'bg-surface border-line text-ink hover:bg-surface-2'
                    )}
                  >
                    Issue Counter-Offer
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaDecision('rejected')}
                    className={cx(
                      'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                      staDecision === 'rejected' ? 'bg-danger text-white border-danger' : 'bg-surface border-line text-ink hover:bg-surface-2'
                    )}
                  >
                    Reject & Re-Auction
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Dynamic Display Card */}
          <div className="lg:col-span-6">
            <div className="p-6 rounded-2xl bg-canvas border border-line-strong space-y-4 shadow-inner">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-mono font-bold text-ink flex items-center gap-1.5">
                  <Lock className="size-3.5 text-ember" /> SELLER CONFIDENTIAL DESK
                </span>
                <span className="text-xs font-mono font-bold text-ember">
                  Reserve: ₹42,000 / MT
                </span>
              </div>

              {staMode === 'below' ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-1">
                    <div className="font-bold text-sm flex items-center gap-1.5">
                      <AlertCircle className="size-4 text-amber-600" /> STA STATUS ACTIVE (Below Reserve)
                    </div>
                    <div>
                      Auction closed at H1 bid of <strong>₹39,500 / MT</strong> (Reserve was ₹42,000). The material is locked and pending your decision.
                    </div>
                  </div>

                  {staDecision !== 'none' && (
                    <div className="p-3.5 rounded-xl bg-surface border border-line text-xs space-y-1 animate-bid-in">
                      <div className="font-bold text-ink">
                        {staDecision === 'accepted' && '✅ Decision Recorded: You accepted the ₹39,500/MT bid. Proceeding to GST settlement.'}
                        {staDecision === 'countered' && '🤝 Counter-Offer Sent: Proposed ₹40,800/MT to H1 buyer. Buyer has 24h to accept.'}
                        {staDecision === 'rejected' && '❌ Decision Recorded: Bid rejected. EMD auto-released to buyer; lot available to re-auction.'}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs space-y-1">
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" /> RESERVE MET — AUTO APPROVED!
                  </div>
                  <div>
                    Highest Bid landed at <strong>₹43,800 / MT</strong> (+₹1,800 over confidential reserve). Settlement initiated automatically.
                  </div>
                </div>
              )}

              <div className="text-[11px] text-ink-faint pt-2 border-t border-line">
                * Reserve rates are encrypted with AES-256 and never visible to prospective buyers or competitors.
              </div>
            </div>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         6. INTERACTIVE SELLER YARD INSPECTION EXPLORER
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Inspection Handled For You"
        title={<>Zero yard tours, <span className="text-ember">100% verified demand</span>.</>}
        lede="Our field auditors take care of lot inspection, photography, and weighbridge calibration so you don't spend time hosting dozens of scrap dealers at your plant."
      >
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="card p-6 space-y-3 border border-line hover:border-line-strong transition-all">
            <div className="size-10 rounded-xl bg-ember-soft text-ember-strong grid place-items-center font-bold">
              01
            </div>
            <h3 className="font-display font-bold text-base text-ink">Zero Plant Disruption</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Auditor visits your yard on your schedule. No unvetted dealers roaming your plant premises.
            </p>
          </div>

          <div className="card p-6 space-y-3 border border-line hover:border-line-strong transition-all">
            <div className="size-10 rounded-xl bg-steel-soft text-steel-strong grid place-items-center font-bold">
              02
            </div>
            <h3 className="font-display font-bold text-base text-ink">Weighbridge Calibration</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              We verify and record calibrated weighbridge slips to eliminate post-sale tonnage disputes.
            </p>
          </div>

          <div className="card p-6 space-y-3 border border-line hover:border-line-strong transition-all">
            <div className="size-10 rounded-xl bg-ember-soft text-ember-strong grid place-items-center font-bold">
              03
            </div>
            <h3 className="font-display font-bold text-base text-ink">Chemical & Photo Assay</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              High-res photo sets and spectrometer chemical composition filed into the digital catalogue.
            </p>
          </div>

          <div className="card p-6 space-y-3 border border-line hover:border-line-strong transition-all">
            <div className="size-10 rounded-xl bg-steel-soft text-steel-strong grid place-items-center font-bold">
              04
            </div>
            <h3 className="font-display font-bold text-base text-ink">Institutional Reach</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Your verified catalogue is instantly broadcast to 1,400+ EMD-backed corporate buyers.
            </p>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         7. FAANG SELLER COMPARISON MATRIX
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Why Sellers Switch"
        title={<>Unorganized scrap dealers vs <span className="text-ember">FerroBid</span>.</>}
        lede="Compare selling surplus metal to traditional local middlemen against FerroBid’s institutional marketplace."
      >
        <div className="mt-8 overflow-x-auto rounded-3xl border border-line-strong shadow-lg bg-surface">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-line bg-surface-2/70 text-xs font-display font-bold uppercase tracking-wider">
                <th className="p-4 sm:p-5 text-ink">Comparison Pillar</th>
                <th className="p-4 sm:p-5 text-ink-muted w-2/5">Traditional Scrap Middlemen</th>
                <th className="p-4 sm:p-5 text-ember w-2/5 bg-ember-soft/30">FerroBid Verified Platform</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs sm:text-sm">
              {SELLER_COMPARISON_ROWS.map((row, i) => (
                <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                  <td className="p-4 sm:p-5 font-display font-bold text-ink">
                    {row.feature}
                  </td>
                  <td className="p-4 sm:p-5 text-ink-muted flex items-start gap-2">
                    <X className="size-4 text-danger shrink-0 mt-0.5" />
                    <span>{row.trad}</span>
                  </td>
                  <td className="p-4 sm:p-5 text-ink font-medium bg-ember-soft/10">
                    <div className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{row.ferrobid}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         8. EXECUTIVE SELLER TESTIMONIALS SPOTLIGHT
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Executive Proof"
        title={<>Trusted by materials GMs & <span className="text-ember">plant managers</span>.</>}
        lede="Hear how industrial principals and plant liquidators maximize surplus value on FerroBid."
      >
        <div className="mt-8 card bg-gradient-to-br from-surface via-surface to-steel-soft/30 p-8 sm:p-12 border border-line-strong shadow-xl space-y-6">
          <div className="font-display text-xl sm:text-2xl font-bold tracking-tight leading-snug text-ink max-w-3xl">
            &ldquo;Our reserve stays sealed, the buyers are verified, and settlement paperwork is handled. We list our plant surplus once and watch a fair, transparent fight decide the market price.&rdquo;
          </div>

          <div className="flex flex-wrap items-center justify-between gap-6 pt-4 border-t border-line">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-ember text-white grid place-items-center font-display font-extrabold text-lg shadow-md">
                S
              </div>
              <div>
                <div className="text-base font-bold text-ink flex items-center gap-1.5">
                  S. Nair <BadgeCheck className="size-4 text-emerald-600 shrink-0" />
                </div>
                <div className="text-xs text-ink-muted font-medium">
                  General Manager, Materials & Asset Disposal · Industrial Principal
                </div>
              </div>
            </div>

            <div className="px-4 py-2 rounded-2xl bg-surface border border-line text-xs font-mono font-bold text-ink">
              ₹4.8 Cr Surplus Liquidated in FY26
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         9. INTERACTIVE FAQ WITH CATEGORY FILTERING & SEARCH
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Common Questions"
        title="What sellers ask before their first catalogue."
        lede="Clear answers regarding reserve protection, STA rules, field audits, and GST settlement."
      >
        <div className="mt-8 space-y-6">
          
          {/* Category Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {SELLER_FAQ_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFaqCat(cat)}
                  className={cx(
                    'px-3.5 py-1.5 rounded-full text-xs font-display font-bold transition-all cursor-pointer',
                    faqCat === cat
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
                placeholder="Search seller FAQ..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-surface border border-line text-xs text-ink focus:outline-none focus:border-ember"
              />
            </div>
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
                No matching questions found for "{faqSearch}". Try searching another keyword.
              </div>
            )}
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         10. FAANG LUXURY CLOSING CTA BANNER
      --------------------------------------------------------------------------- */}
      <CtaBand
        eyebrow="READY TO LIQUIDATE SURPLUS?"
        title={<>Liquidate Plant Surplus To <br /><span className="bg-gradient-to-r from-ember via-amber-500 to-emerald-600 bg-clip-text text-transparent">1,400+ Verified Buyers.</span></>}
        sub="Submit your material once. Our certified field team inspects your yard, catalogues your lot, and protects your reserve price with confidential STA rules."
        trustBadges={[
          { icon: <ShieldCheck size={15} className="text-emerald-600" />, label: '100% Confidential Reserve Protection' },
          { icon: <CheckCircle2 size={15} className="text-emerald-600" />, label: 'Zero Forced Below-Reserve Sales' },
          { icon: <Banknote size={15} className="text-emerald-600" />, label: '<48h Post-Auction GST Settlement' },
        ]}
        primary={{ label: 'List Your Surplus Lot', to: '/login' }}
        secondary={{ label: 'Contact Asset Disposal Team', to: '/g2/contact' }}
      />

    </Page>
  )
}
