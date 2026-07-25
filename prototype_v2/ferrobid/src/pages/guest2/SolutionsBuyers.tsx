/* Guest 2 — Solutions · For Buyers (FAANG-level Luxury Flagship Page).
   Includes interactive sample inspection explorer, dynamic buyer ROI calculator,
   4-step interactive buyer journey stepper, anti-snipe simulator, FAANG comparison matrix,
   and executive buyer spotlights. */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, Gavel, Truck, ShieldCheck, ArrowRight,
  ChevronRight, TrendingUp, CheckCircle2, Clock, Lock, PackageSearch,
  Sparkles, ChevronDown, Search, FileText,
  Check, X, BadgeCheck, MapPin, Calculator, Zap, BarChart3,
  Shield, FileCheck, ArrowUpRight
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, cx } from '../../components/ui'
import { Section, CtaBand, usePageMeta, CountUp } from './marketing'

/* ---------------------------------------------------------------------------
   DATA STRUCTURES FOR INTERACTIVE COMPONENTS
--------------------------------------------------------------------------- */

// 1. Interactive Inspection Report Samples
type InspectionLot = {
  id: string
  title: string
  category: string
  location: string
  quantity: string
  inspector: string
  inspectorId: string
  inspectedDate: string
  images: string[]
  specs: { label: string; value: string; pct: number }[]
  checklist: { item: string; verified: boolean }[]
  certNo: string
}

const INSPECTION_LOTS: InspectionLot[] = [
  {
    id: 'lot-hms1',
    title: 'Heavy Melting Scrap (HMS 1/2) - 80:20 Mix',
    category: 'Ferrous Scrap',
    location: 'JSW Yard 4 · Toranagallu, Karnataka',
    quantity: '450 Metric Tons',
    inspector: 'Rajesh V. Sharma',
    inspectorId: 'FE-1049',
    inspectedDate: 'Yesterday at 14:30',
    images: ['/images/auction_steel_coils.png', '/images/inspection.jpg', '/images/hero_bidding_facility.jpg'],
    specs: [
      { label: 'Fe Metal Purity', value: '94.2%', pct: 94.2 },
      { label: 'Piece Thickness (>6mm)', value: '88.0%', pct: 88.0 },
      { label: 'Non-Ferrous Contaminants', value: '<0.5%', pct: 99.5 },
      { label: 'Moisture / Oil Content', value: '<0.2%', pct: 99.8 },
    ],
    checklist: [
      { item: 'Zero radioactive contamination certified (Gamma detector passed)', verified: true },
      { item: 'No hollow cylinders or sealed gas tanks present', verified: true },
      { item: 'Weighbridge calibrated & certified by Metrology Board', verified: true },
      { item: 'Free from municipal waste, dirt & non-metallic slag', verified: true },
    ],
    certNo: 'MTC-2026-HMS-88421',
  },
  {
    id: 'lot-hrcoils',
    title: 'Prime Hot-Rolled Steel Coils (IS 2062 E250)',
    category: 'Flat Steel',
    location: 'Tata Steel Processing Yard · Jamshedpur',
    quantity: '180 Metric Tons (6 Coils)',
    inspector: 'Anand Kumar',
    inspectorId: 'FE-8812',
    inspectedDate: 'Today at 09:15',
    images: ['/images/buyer_hero.jpg', '/images/tile_steel.jpg', '/images/hero_coils.png'],
    specs: [
      { label: 'Yield Strength (ReH)', value: '290 MPa', pct: 92.0 },
      { label: 'Tensile Strength (Rm)', value: '440 MPa', pct: 95.0 },
      { label: 'Thickness Tolerance (3.15mm)', value: '±0.04mm', pct: 98.0 },
      { label: 'Edge Condition', value: 'Mill Edge Clean', pct: 100 },
    ],
    checklist: [
      { item: 'Original Mill Test Certificate (MTC) attached & verified', verified: true },
      { item: 'No edge tears, heavy rusting or handling indentations', verified: true },
      { item: 'Stenciled coil numbers match physical manufacturer tags', verified: true },
      { item: 'Weatherproof plastic tarp strapping verified for transit', verified: true },
    ],
    certNo: 'MTC-2026-HRC-90145',
  },
  {
    id: 'lot-copper',
    title: 'Shredded Copper Cathodes & Wire Scrap (Birch/Cliff)',
    category: 'Non-Ferrous',
    location: 'Adani Logistics Park · Mundra Port',
    quantity: '35 Metric Tons',
    inspector: 'Priya Sundaram',
    inspectorId: 'FE-3301',
    inspectedDate: 'Jul 24, 2026',
    images: ['/images/auction_copper_cathodes.png', '/images/tile_copper.jpg', '/images/hero_copper.png'],
    specs: [
      { label: 'Cu Content Grade', value: '99.96%', pct: 99.96 },
      { label: 'Insulation / Enamel Residual', value: '<0.08%', pct: 99.2 },
      { label: 'Specific Gravity', value: '8.92 g/cm³', pct: 96.0 },
      { label: 'Bale Density', value: '3.2 MT/m³', pct: 90.0 },
    ],
    checklist: [
      { item: 'Spectrometer chemical assay report verified (Cu 99.96%)', verified: true },
      { item: 'Individual bale tags & security seals verified', verified: true },
      { item: 'Zero solder, tinning or heavy oxidation found', verified: true },
      { item: 'Customs duty clearance & bill of entry verified', verified: true },
    ],
    certNo: 'MTC-2026-CUP-44109',
  },
]

// 2. Interactive Stepper Data
const BUYER_STEPS = [
  {
    num: '01',
    title: 'Shortlist & Filter',
    subtitle: 'Search 64+ live catalogues',
    icon: <PackageSearch className="size-6 text-ember" />,
    desc: 'Filter live scrap & metal auctions by material grade, location, EMD budget band, and instant pickup availability. Star lots to build your custom watchlist.',
    bullets: [
      'Filter by Fe %, non-ferrous grade & location proximity',
      'Download full physical inspection reports & photo sets',
      'Set automated SMS / WhatsApp alerts when target lots go live',
    ],
    mockBadge: 'Live Watchlist Active',
    mockVal: '14 Lots Selected',
  },
  {
    num: '02',
    title: 'Fund EMD in Wallet',
    subtitle: 'Lock pre-bid money per lot',
    icon: <Wallet className="size-6 text-steel" />,
    desc: 'Lock earnest money deposit (EMD) only on the exact lots you wish to bid on. Your EMD remains 100% refundable — lose the lot, and funds auto-release instantly.',
    bullets: [
      'Top up via Instant UPI, RTGS, NetBanking, or Bank Guarantee',
      'Auto-release engine unlocks funds within 72 hours of auction close',
      'Zero subscription or annual membership fees to join',
    ],
    mockBadge: 'EMD Protection Active',
    mockVal: '₹2,50,000 Locked (Auto-Refundable)',
  },
  {
    num: '03',
    title: 'Bid Live with Anti-Snipe',
    subtitle: 'Fair pricing, no bot snipes',
    icon: <Gavel className="size-6 text-ember" />,
    desc: 'Compete in transparent forward auctions with real-time rate tickers. Anti-snipe protection extends the close window whenever last-second bids land.',
    bullets: [
      'Set Auto-Bid ceiling — the engine increments minimum steps for you',
      'Anti-snipe automatically adds +2 minutes if bid lands in final 30s',
      'Complete cryptographic audit log of every placed bid',
    ],
    mockBadge: 'Anti-Snipe Active',
    mockVal: 'Winning Bid: ₹38,450 / MT',
  },
  {
    num: '04',
    title: 'Weighment, Pay & Lift',
    subtitle: 'Pay exact weighed quantity',
    icon: <Truck className="size-6 text-steel" />,
    desc: 'H1 winning bidder gets an instant digital Delivery Order (DO). Schedule truck placement at the yard, record calibrated weighments, and settle the final billed amount.',
    bullets: [
      'Pay strictly for actual net weighed tonnage at lifting',
      'Generate digital gate passes directly inside your dashboard',
      'Automated GST e-invoices and weighbridge slips generated instantly',
    ],
    mockBadge: 'Gate Pass Ready',
    mockVal: 'Delivery Order #DO-9921 Issued',
  },
]

// 3. FAANG Comparison Matrix Data
const COMPARISON_ROWS = [
  {
    feature: 'Pre-Bid Material Inspection',
    trad: 'Unverified seller descriptions; physical yard visits required at buyer cost',
    ferrobid: '100% physically inspected by certified field executives with photos & chemical assay',
  },
  {
    feature: 'Earnest Money (EMD) Safety',
    trad: 'Manual cheque deposits; delayed refunds taking weeks or months',
    ferrobid: 'Instant wallet lock with automated 72-hour refund engine on un-won lots',
  },
  {
    feature: 'Bidding Fairness & Anti-Snipe',
    trad: 'WhatsApp / offline cartel bids; last-second sniping with zero transparency',
    ferrobid: 'Real-time forward auction engine with anti-snipe clock extensions & proxy bidding',
  },
  {
    feature: 'Weighment & Settlement',
    trad: 'Risky yard weighbridges, arbitrary deduction claims, and hidden broker fees',
    ferrobid: 'Calibrated weighment slips, automated GST invoice generation, zero hidden commissions',
  },
  {
    feature: 'Logistics & Gate Pass Dispatch',
    trad: 'Manual paperwork delays truck loading for days at seller yards',
    ferrobid: '1-click digital Delivery Order (DO) & vehicle gate-pass issuance',
  },
]

// 4. FAQ List with Categories
const FAQ_CATEGORIES = ['All', 'EMD & Wallet', 'Inspection & Quality', 'Bidding & Anti-Snipe', 'Lifting & Logistics']

const FAQS_DETAILED = [
  {
    cat: 'EMD & Wallet',
    q: 'What is EMD, and how quickly do I get my money back if I do not win?',
    a: 'EMD (Earnest Money Deposit) is refundable earnest money locked per lot to ensure bidder commitment. If you lose a lot, your locked EMD is automatically released back to your FerroBid wallet within 72 hours (often instantly upon auction closing). You can re-use it for next bids or withdraw it to your registered bank account via 1-click RTGS.',
  },
  {
    cat: 'EMD & Wallet',
    q: 'Are there any hidden buyers fees or registration charges?',
    a: 'No. Creating a buyer account, completing business KYC, and browsing all live and upcoming auction catalogues is 100% free. FerroBid charges a transparent, flat platform service fee only when you successfully win and settle a lot.',
  },
  {
    cat: 'Inspection & Quality',
    q: 'How does FerroBid verify metal quality before the auction?',
    a: 'Every listed lot undergoes mandatory physical verification by a trained FerroBid Field Inspector. They document physical dimensions, photograph lot conditions, check for radioactive/chemical hazards, inspect mill certificates, and upload a verified 42-point checklist. You bid on documented facts.',
  },
  {
    cat: 'Inspection & Quality',
    q: 'What happens if the material at lifting differs from the inspection report?',
    a: 'FerroBid operates under strict Buyer Protection guidelines. If physical material at lifting shows significant discrepancy from the published report (e.g. heavy non-metallic contamination or incorrect grade), your bid is protected and our resolution team settles or cancels the lot with full EMD protection.',
  },
  {
    cat: 'Bidding & Anti-Snipe',
    q: 'How does the Anti-Snipe protection work during live auctions?',
    a: 'To prevent bots or malicious last-second snipers from taking a lot in the final millisecond, any valid bid placed within the final 30 seconds of an auction automatically extends the countdown timer by +2 minutes. This ensures every genuine buyer has time to respond.',
  },
  {
    cat: 'Bidding & Anti-Snipe',
    q: 'What is Auto-Bid / Proxy Bidding, and how does it work?',
    a: 'Auto-Bid lets you set your maximum ceiling rate per metric ton. The platform engine automatically places incremental minimum bids on your behalf only when another buyer bids against you — up to your maximum ceiling. You never overpay.',
  },
  {
    cat: 'Lifting & Logistics',
    q: 'How is the final invoice amount calculated if scrap weight varies?',
    a: 'Catalogue weights are indicative target quantities. Final billing is strictly based on net weighbridge weight recorded at vehicle lifting. You pay only for the exact weighed metric tonnage multiplied by your winning bid rate per UOM.',
  },
  {
    cat: 'Lifting & Logistics',
    q: 'Does FerroBid assist with vehicle gate passes and transit clearance?',
    a: 'Yes. Once payment is confirmed, a digital Delivery Order (DO) and vehicle gate pass are instantly generated in your dashboard. You can assign driver phone numbers, truck registration details, and track pickup status end-to-end.',
  },
]

/* ---------------------------------------------------------------------------
   MAIN COMPONENT — SolutionsBuyers
--------------------------------------------------------------------------- */

export default function SolutionsBuyers() {
  usePageMeta({
    title: 'For Buyers — Verified Metal Procurement Platform',
    description: 'Source verified scrap and metal without yard-visit gambles. Shortlist lots, fund auto-refundable EMD, bid live with anti-snipe protection, pay weighed tonnage, and lift.',
  })

  const nav = useNavigate()

  // 1. Live Auction Hero Simulator State
  const [heroBidRate, setHeroBidRate] = useState(38450)
  const [heroBidCount, setHeroBidCount] = useState(14)
  const [heroBidSuccess, setHeroBidSuccess] = useState(false)

  const handleHeroBid = () => {
    setHeroBidRate((prev) => prev + 250)
    setHeroBidCount((prev) => prev + 1)
    setHeroBidSuccess(true)
    setTimeout(() => setHeroBidSuccess(false), 2500)
  }

  // 2. Interactive Inspection Explorer State
  const [selectedLotId, setSelectedLotId] = useState<string>('lot-hms1')
  const [activeLotTab, setActiveLotTab] = useState<'specs' | 'photos' | 'checklist'>('specs')
  const activeLot = useMemo(() => INSPECTION_LOTS.find((l) => l.id === selectedLotId) || INSPECTION_LOTS[0], [selectedLotId])
  const [selectedImage, setSelectedImage] = useState<string>(activeLot.images[0])

  // 3. Interactive Stepper State
  const [activeStep, setActiveStep] = useState<number>(0)

  // 4. ROI Calculator State
  const [volTons, setVolTons] = useState<number>(450)
  const [avgRate, setAvgRate] = useState<number>(42000)
  const [visitsPerMonth, setVisitsPerMonth] = useState<number>(6)

  const roiCalculations = useMemo(() => {
    // 3.8% bid optimization + savings on yard visits (₹18,500 per visit)
    const annualBidSavings = Math.round(volTons * avgRate * 12 * 0.038)
    const annualVisitSavings = visitsPerMonth * 12 * 18500
    const totalSavings = annualBidSavings + annualVisitSavings
    const hoursSaved = visitsPerMonth * 12 * 14 // 14 hours per visit trip
    return {
      bidSavings: annualBidSavings,
      visitSavings: annualVisitSavings,
      total: totalSavings,
      hours: hoursSaved,
    }
  }, [volTons, avgRate, visitsPerMonth])

  // 5. Anti-Snipe Simulator State
  const [snipeTime, setSnipeTime] = useState<number>(12)
  const [snipeExtended, setSnipeExtended] = useState<boolean>(false)
  const [snipeLog, setSnipeLog] = useState<{ time: string; text: string; type: 'bid' | 'extend' | 'info' }[]>([
    { time: '00:45', text: 'Auction entering final 1-minute window. Current H1: ₹38,200/MT', type: 'info' },
  ])

  const triggerSnipeBid = () => {
    const newLog = [
      { time: '00:08', text: '⚡ Buyer #B-902 placed bid at ₹38,450/MT in final 10s!', type: 'bid' as const },
      { time: '02:00', text: '🛡️ ANTI-SNIPE TRIGGERED: Countdown automatically extended by +2:00 mins!', type: 'extend' as const },
      ...snipeLog,
    ]
    setSnipeLog(newLog)
    setSnipeTime(120)
    setSnipeExtended(true)
  }

  // 6. FAQ State
  const [faqCat, setFaqCat] = useState<string>('All')
  const [faqSearch, setFaqSearch] = useState<string>('')

  const filteredFaqs = useMemo(() => {
    return FAQS_DETAILED.filter((item) => {
      const catMatch = faqCat === 'All' || item.cat === faqCat
      const searchMatch = !faqSearch || item.q.toLowerCase().includes(faqSearch.toLowerCase()) || item.a.toLowerCase().includes(faqSearch.toLowerCase())
      return catMatch && searchMatch
    })
  }, [faqCat, faqSearch])

  return (
    <Page className="space-y-20 sm:space-y-32 pb-16">
      
      {/* ---------------------------------------------------------------------------
         1. FAANG EDITORIAL HERO & LIVE FLASH AUCTION PREVIEW WIDGET
      --------------------------------------------------------------------------- */}
      <section className="pt-4 sm:pt-10 animate-fade-up">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Hero Left Column: Editorial Headline & Actions */}
          <div className="lg:col-span-7 max-w-2xl">
            {/* Top Tag */}
            <div className="inline-flex items-center gap-2 rounded-full bg-ember-soft border border-ember/25 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-ember-strong mb-6 shadow-sm">
              <span className="size-2 rounded-full bg-ember animate-live-pulse" />
              Verified Industrial Buying Engine
            </div>

            <h1 className="font-display text-4xl sm:text-6xl lg:text-[3.75rem] font-extrabold tracking-tight leading-[1.06] text-balance">
              Source verified metal <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-ember via-ember-strong to-amber-600 bg-clip-text text-transparent">
                without the yard gamble
              </span>
            </h1>

            <p className="text-base sm:text-xl text-ink-muted mt-6 leading-relaxed text-pretty font-normal">
              Shortlist certified catalogues, fund auto-refundable EMD only on lots you contest, and bid live rates with 100% field inspection reports in hand. Win, pay weighed tonnage, lift.
            </p>

            {/* CTA Action Row */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button size="lg" className="shadow-lg shadow-ember/20" onClick={() => nav('/browse')}>
                Browse 64+ Live Auctions <ArrowRight className="size-5 ml-1" />
              </Button>
              <Button size="lg" variant="secondary" onClick={() => nav('/login')}>
                Register as Verified Buyer
              </Button>
            </div>

            {/* Micro Trust Pills */}
            <div className="mt-10 pt-6 border-t border-line grid grid-cols-3 gap-4 text-left">
              <div>
                <div className="font-display text-xl font-bold text-ink num">₹480+ Cr</div>
                <div className="text-xs text-ink-muted mt-0.5 font-medium">Bidding Volume</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 num flex items-center gap-1">
                  <CheckCircle2 className="size-4 shrink-0" /> 100%
                </div>
                <div className="text-xs text-ink-muted mt-0.5 font-medium">Inspected Lots</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold text-steel dark:text-steel-strong num">72 Hours</div>
                <div className="text-xs text-ink-muted mt-0.5 font-medium">Auto EMD Release</div>
              </div>
            </div>
          </div>

          {/* Hero Right Column: Interactive Live Bidding Card */}
          <div className="lg:col-span-5 relative">
            {/* Ambient Backlight Glow */}
            <div className="absolute -top-12 -right-8 size-80 bg-ember/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 size-72 bg-steel/15 rounded-full blur-3xl pointer-events-none" />

            {/* Main Interactive Auction Card */}
            <div className="relative rounded-3xl bg-surface/90 backdrop-blur-2xl border border-line-strong/80 p-6 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.35)] space-y-5">
              
              {/* Card Header & Live Status */}
              <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-ember-soft text-ember-strong text-[11px] font-mono font-bold tracking-tight">
                    LOT #FB-8842 · LIVE NOW
                  </div>
                  <h3 className="font-display text-base font-bold text-ink mt-1.5 leading-snug">
                    Heavy Melting Scrap (HMS 1/2)
                  </h3>
                  <div className="text-xs text-ink-muted flex items-center gap-1.5 mt-1">
                    <MapPin className="size-3.5 text-ember shrink-0" /> JSW Steel Yard · Karnataka
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Closing In</div>
                  <div className="num font-mono text-sm font-extrabold text-ember flex items-center justify-end gap-1">
                    <Clock className="size-3.5 animate-spin" style={{ animationDuration: '4s' }} /> 02h 14m 38s
                  </div>
                </div>
              </div>

              {/* Inspector Verification Chip */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-surface-2/80 border border-line text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-ember-soft text-ember-strong grid place-items-center font-display font-extrabold text-xs">
                    RV
                  </div>
                  <div>
                    <div className="font-bold text-ink flex items-center gap-1">
                      Rajesh V. <BadgeCheck className="size-3.5 text-emerald-600 shrink-0" />
                    </div>
                    <div className="text-[11px] text-ink-muted">Field Inspector #1049</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                  <ShieldCheck className="size-3" /> Report Verified
                </span>
              </div>

              {/* Live Rate Display */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-steel-soft/60 to-surface border border-steel/20 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Current Winning Rate</div>
                  <div className="num text-2xl font-extrabold text-ink mt-0.5">
                    ₹{heroBidRate.toLocaleString('en-IN')} <span className="text-xs font-sans text-ink-muted">/ MT</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-0.5">
                    <TrendingUp className="size-3.5" /> +₹250 step
                  </div>
                  <div className="text-[11px] text-ink-faint mt-0.5 num">{heroBidCount} Bids Placed</div>
                </div>
              </div>

              {/* Interactive Bid Trigger */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleHeroBid}
                  className="w-full py-3.5 px-4 rounded-2xl bg-ember hover:bg-ember-strong text-white font-display font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <Gavel className="size-4 transition-transform group-hover:-rotate-12" />
                  Simulate Placing Next Bid (₹{(heroBidRate + 250).toLocaleString('en-IN')})
                </button>

                {heroBidSuccess && (
                  <div className="text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-bid-in flex items-center justify-center gap-1 pt-1">
                    <CheckCircle2 className="size-3.5" /> Bid recorded! Anti-snipe timer extended.
                  </div>
                )}
              </div>

              {/* Anti-Snipe Guarantee Strip */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-ink-muted border-t border-line">
                <span className="flex items-center gap-1">
                  <Lock className="size-3 text-steel" /> EMD Required: ₹50,000 (100% Refundable)
                </span>
                <span className="flex items-center gap-1 font-semibold text-ember">
                  <Zap className="size-3" /> Anti-Snipe Active
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
              <CountUp to={480} prefix="₹" suffix=" Cr+" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Procurement Settled</div>
            <div className="text-[11px] text-ink-faint">Across 1,200+ completed catalogues</div>
          </div>

          <div className="space-y-1 text-center sm:text-left pt-4 sm:pt-0 sm:pl-6">
            <div className="num text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight flex items-center justify-center sm:justify-start gap-1">
              <CountUp to={100} suffix="%" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Pre-Bid Inspected</div>
            <div className="text-[11px] text-ink-faint">Verified on-site by field inspectors</div>
          </div>

          <div className="space-y-1 text-center sm:text-left pt-4 sm:pt-0 sm:pl-6">
            <div className="num text-3xl sm:text-4xl font-extrabold text-ember tracking-tight">
              <CountUp to={0} suffix="%" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Snipe Fraud Rate</div>
            <div className="text-[11px] text-ink-faint">Protected by dynamic auto-extension</div>
          </div>

          <div className="space-y-1 text-center sm:text-left pt-4 sm:pt-0 sm:pl-6">
            <div className="num text-3xl sm:text-4xl font-extrabold text-steel dark:text-steel-strong tracking-tight">
              &lt;72 Hours
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Auto EMD Release</div>
            <div className="text-[11px] text-ink-faint">Instant RTGS wallet refund guarantee</div>
          </div>

        </div>
      </section>

      {/* ---------------------------------------------------------------------------
         3. INTERACTIVE INSPECTION REPORT EXPLORER
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Verified Before You Bid"
        title={<>Inspect the metal, <span className="text-ember">not the promise</span>.</>}
        lede="No more sending teams to remote yards or risking unverified scrap quality. Every lot on FerroBid comes with a full digital field report, chemical assay, and high-res photography."
      >
        <div className="mt-8 space-y-6">
          
          {/* Lot Selector Tabs */}
          <div className="flex flex-wrap gap-2 sm:gap-3 border-b border-line pb-4">
            {INSPECTION_LOTS.map((lot) => (
              <button
                key={lot.id}
                type="button"
                onClick={() => { setSelectedLotId(lot.id); setSelectedImage(lot.images[0]) }}
                className={cx(
                  'px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-display font-bold transition-all cursor-pointer flex items-center gap-2',
                  selectedLotId === lot.id
                    ? 'bg-ember text-white shadow-md shadow-ember/20'
                    : 'bg-surface border border-line text-ink-muted hover:text-ink hover:bg-surface-2'
                )}
              >
                <FileCheck className="size-4" />
                {lot.title.split('-')[0]}
              </button>
            ))}
          </div>

          {/* Report Viewer Container */}
          <div className="card bg-surface p-6 sm:p-8 border border-line-strong grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Visual Gallery & Media Preview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-line aspect-video sm:aspect-4/3 bg-black">
                <img
                  src={selectedImage}
                  alt={activeLot.title}
                  className="w-full h-full object-cover transition-opacity duration-300"
                />
                <div className="absolute top-3 left-3 bg-surface/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-mono font-bold text-ink border border-line shadow-sm">
                  {activeLot.certNo}
                </div>
                <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-[10px] font-mono">
                  GPS Tagged · Verified
                </div>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-2">
                {activeLot.images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={cx(
                      'size-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0',
                      selectedImage === img ? 'border-ember scale-95 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'
                    )}
                  >
                    <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Interactive Report Specs & Details */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Report Header */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-3 py-1 rounded-full bg-steel-soft text-steel-strong font-bold text-xs">
                    {activeLot.category}
                  </span>
                  <span className="text-xs text-ink-muted flex items-center gap-1">
                    <Clock className="size-3.5 text-ember" /> {activeLot.inspectedDate}
                  </span>
                </div>

                <h3 className="font-display text-xl sm:text-2xl font-bold text-ink mt-2">
                  {activeLot.title}
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted mt-1 flex items-center gap-1.5">
                  <MapPin className="size-4 text-ember shrink-0" /> {activeLot.location} · <strong className="text-ink">{activeLot.quantity}</strong>
                </p>
              </div>

              {/* Sub-Tabs: Specs vs Checklist */}
              <div className="flex border-b border-line text-xs font-display font-bold">
                <button
                  type="button"
                  onClick={() => setActiveLotTab('specs')}
                  className={cx(
                    'py-2 px-4 border-b-2 transition-colors cursor-pointer',
                    activeLotTab === 'specs' ? 'border-ember text-ember' : 'border-transparent text-ink-muted hover:text-ink'
                  )}
                >
                  Chemical & Spec Breakdown
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLotTab('checklist')}
                  className={cx(
                    'py-2 px-4 border-b-2 transition-colors cursor-pointer',
                    activeLotTab === 'checklist' ? 'border-ember text-ember' : 'border-transparent text-ink-muted hover:text-ink'
                  )}
                >
                  42-Point Field Checklist
                </button>
              </div>

              {/* Sub-Tab Content */}
              {activeLotTab === 'specs' ? (
                <div className="space-y-3 pt-1">
                  {activeLot.specs.map((spec) => (
                    <div key={spec.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-ink-muted">{spec.label}</span>
                        <span className="font-mono font-bold text-ink">{spec.value}</span>
                      </div>
                      <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ember rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, spec.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  {activeLot.checklist.map((chk, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-2/60 border border-line text-xs">
                      <span className="mt-0.5 size-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                        <Check className="size-3 stroke-[3]" />
                      </span>
                      <span className="text-ink font-medium">{chk.item}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Report Footer Action */}
              <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-steel-soft text-steel-strong grid place-items-center font-bold text-xs">
                    {activeLot.inspector.charAt(0)}
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-ink">{activeLot.inspector}</div>
                    <div className="text-[11px] text-ink-muted">Certified Field Auditor</div>
                  </div>
                </div>

                <Button size="sm" variant="secondary" onClick={() => nav('/browse')}>
                  View Live Catalogue <ArrowUpRight className="size-4 ml-1" />
                </Button>
              </div>

            </div>

          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         4. FAANG INTERACTIVE 4-STEP BUYER JOURNEY STEPPER
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="The Buyer Loop"
        title={<>Four simple steps, <span className="text-ember">every single auction</span>.</>}
        lede="Designed for high-volume corporate procurement teams. From initial shortlist to yard gate pass, every phase is transparent and audited."
      >
        <div className="mt-8 grid lg:grid-cols-12 gap-8 items-center">
          
          {/* Stepper Buttons (Left Column) */}
          <div className="lg:col-span-5 space-y-3">
            {BUYER_STEPS.map((step, idx) => (
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
                    {BUYER_STEPS[activeStep].icon}
                  </div>
                  <div>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ember">
                      STAGE {BUYER_STEPS[activeStep].num} OF 04
                    </span>
                    <h3 className="font-display text-xl font-bold text-ink">
                      {BUYER_STEPS[activeStep].title}
                    </h3>
                  </div>
                </div>

                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  {BUYER_STEPS[activeStep].mockBadge}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                {BUYER_STEPS[activeStep].desc}
              </p>

              {/* Feature Bullets */}
              <ul className="space-y-2.5">
                {BUYER_STEPS[activeStep].bullets.map((bullet, i) => (
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
                  Platform Guarantee
                </span>
                <span className="num text-sm font-mono font-extrabold text-ink">
                  {BUYER_STEPS[activeStep].mockVal}
                </span>
              </div>

            </div>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         5. BUYER ROI & FINANCIAL MARGIN ESTIMATOR
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Financial Intelligence"
        title={<>Calculate your procurement <span className="text-ember">savings & ROI</span>.</>}
        lede="See how much your organization saves annually by switching from unorganized yard trips to FerroBid's verified digital bidding engine."
      >
        <div className="mt-8 card bg-surface p-6 sm:p-10 border border-line-strong shadow-xl grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Sliders Input Column */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* Slider 1: Monthly Volume */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <label className="font-display font-bold text-ink flex items-center gap-2">
                  <BarChart3 className="size-4 text-ember" /> Monthly Procurement Volume
                </label>
                <span className="num font-mono font-extrabold text-ember text-base">
                  {volTons.toLocaleString('en-IN')} MT
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={5000}
                step={50}
                value={volTons}
                onChange={(e) => setVolTons(Number(e.target.value))}
                className="w-full h-2 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-ember"
              />
              <div className="flex justify-between text-[11px] text-ink-faint">
                <span>50 MT</span>
                <span>2,500 MT</span>
                <span>5,000 MT</span>
              </div>
            </div>

            {/* Slider 2: Average Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <label className="font-display font-bold text-ink flex items-center gap-2">
                  <Calculator className="size-4 text-steel" /> Avg Metal Rate per Ton
                </label>
                <span className="num font-mono font-extrabold text-steel dark:text-steel-strong text-base">
                  ₹{avgRate.toLocaleString('en-IN')} / MT
                </span>
              </div>
              <input
                type="range"
                min={20000}
                max={150000}
                step={1000}
                value={avgRate}
                onChange={(e) => setAvgRate(Number(e.target.value))}
                className="w-full h-2 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-steel"
              />
              <div className="flex justify-between text-[11px] text-ink-faint">
                <span>₹20,000</span>
                <span>₹85,000</span>
                <span>₹1,50,000</span>
              </div>
            </div>

            {/* Slider 3: Yard Visits */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <label className="font-display font-bold text-ink flex items-center gap-2">
                  <MapPin className="size-4 text-ember" /> Yard Inspection Trips / Month
                </label>
                <span className="num font-mono font-extrabold text-ink text-base">
                  {visitsPerMonth} Trips
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={visitsPerMonth}
                onChange={(e) => setVisitsPerMonth(Number(e.target.value))}
                className="w-full h-2 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-ember"
              />
              <div className="flex justify-between text-[11px] text-ink-faint">
                <span>1 Trip</span>
                <span>10 Trips</span>
                <span>20 Trips</span>
              </div>
            </div>

          </div>

          {/* Calculation Output Card (Right Column) */}
          <div className="lg:col-span-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-steel-soft/80 via-surface to-ember-soft/30 border border-line-strong shadow-lg space-y-6">
              
              <div className="text-xs font-bold uppercase tracking-wider text-ember-strong flex items-center gap-1.5">
                <Sparkles className="size-4" /> Estimated Annual Financial Advantage
              </div>

              {/* Total Annual Value Number */}
              <div>
                <div className="text-xs text-ink-muted font-medium">Total Calculated Annual Value</div>
                <div className="num text-3xl sm:text-5xl font-extrabold text-ink tracking-tight mt-1">
                  ₹{roiCalculations.total.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Breakdown List */}
              <div className="space-y-3 border-t border-b border-line py-4 text-xs sm:text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Direct Bid Rate Savings (3.8% avg margin):</span>
                  <span className="num font-bold text-emerald-600 dark:text-emerald-400">
                    +₹{roiCalculations.bidSavings.toLocaleString('en-IN')} / yr
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Saved Travel & Yard Inspection Expenses:</span>
                  <span className="num font-bold text-steel dark:text-steel-strong">
                    +₹{roiCalculations.visitSavings.toLocaleString('en-IN')} / yr
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">Executive Man-Hours Reclaimed:</span>
                  <span className="num font-bold text-ink">
                    {roiCalculations.hours} Hours / yr
                  </span>
                </div>
              </div>

              {/* Liquidity Footnote */}
              <div className="flex items-center gap-2 text-xs text-ink-muted font-medium">
                <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                EMD liquidity released within 72 hours of lost bids.
              </div>

            </div>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         6. ANTI-SNIPE & LIVE BIDDING ENGINE SHOWCASE
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Auction Tech Standard"
        title={<>Fair bidding protection <span className="text-ember">powered by Anti-Snipe</span>.</>}
        lede="Say goodbye to WhatsApp cartels and millisecond bot-sniping. Our enterprise auction engine ensures genuine market discovery."
      >
        <div className="mt-8 card bg-surface p-6 sm:p-10 border border-line-strong shadow-xl grid lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Anti-Snipe Simulator Controls */}
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ember-soft text-ember-strong text-xs font-bold">
              <Zap className="size-3.5" /> Interactive Engine Simulator
            </div>

            <h3 className="font-display text-2xl font-bold text-ink">
              Watch Anti-Snipe Protection in Action
            </h3>

            <p className="text-sm text-ink-muted leading-relaxed">
              When a buyer submits a bid in the final 30 seconds, the engine automatically extends the countdown timer by +2 minutes. No last-second bot steals allowed.
            </p>

            <button
              type="button"
              onClick={triggerSnipeBid}
              className="py-3 px-5 rounded-2xl bg-ember hover:bg-ember-strong text-white font-display font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Gavel className="size-4" /> Simulate Last-Second Bid (00:08 Remaining)
            </button>

            {/* Key Features */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-surface-2/60 border border-line text-xs space-y-1">
                <div className="font-bold text-ink flex items-center gap-1">
                  <Shield className="size-3.5 text-steel" /> Auto-Bid Ceiling
                </div>
                <div className="text-ink-muted">Set max limit; engine bids minimum steps.</div>
              </div>
              <div className="p-3 rounded-xl bg-surface-2/60 border border-line text-xs space-y-1">
                <div className="font-bold text-ink flex items-center gap-1">
                  <FileText className="size-3.5 text-ember" /> Audit Log
                </div>
                <div className="text-ink-muted">Cryptographic timestamp on every bid.</div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Event Stream */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl bg-canvas border border-line-strong p-5 font-mono text-xs space-y-3 shadow-inner">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-ink-muted font-bold flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-live-pulse" /> LIVE ENGINE LOG
                </span>
                <span className={cx('font-bold', snipeExtended ? 'text-ember animate-live-pulse' : 'text-ink')}>
                  Time Left: 00:{snipeTime < 10 ? `0${snipeTime}` : snipeTime}
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {snipeLog.map((log, idx) => (
                  <div
                    key={idx}
                    className={cx(
                      'p-2.5 rounded-xl border leading-relaxed',
                      log.type === 'extend'
                        ? 'bg-ember-soft/80 border-ember/40 text-ember-strong font-bold'
                        : log.type === 'bid'
                        ? 'bg-steel-soft/60 border-steel/30 text-steel-strong font-bold'
                        : 'bg-surface border-line text-ink-muted'
                    )}
                  >
                    <span className="text-[10px] text-ink-faint mr-2">[{log.time}]</span>
                    {log.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         7. FAANG COMPARISON MATRIX
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Why Buyers Switch"
        title={<>Unorganized yard buying vs <span className="text-ember">FerroBid</span>.</>}
        lede="Compare traditional scrap purchasing against FerroBid’s institutional marketplace framework."
      >
        <div className="mt-8 overflow-x-auto rounded-3xl border border-line-strong shadow-lg bg-surface">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-line bg-surface-2/70 text-xs font-display font-bold uppercase tracking-wider">
                <th className="p-4 sm:p-5 text-ink">Comparison Pillar</th>
                <th className="p-4 sm:p-5 text-ink-muted w-2/5">Traditional Yard Bidding</th>
                <th className="p-4 sm:p-5 text-ember w-2/5 bg-ember-soft/30">FerroBid Verified Platform</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs sm:text-sm">
              {COMPARISON_ROWS.map((row, i) => (
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
         8. EXECUTIVE BUYER TESTIMONIALS SPOTLIGHT
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Executive Proof"
        title={<>Trusted by procurement leaders <span className="text-ember">worldwide</span>.</>}
        lede="See how top re-rolling mills, foundries, and metal exporters rely on FerroBid to source verified scrap."
      >
        <div className="mt-8 card bg-gradient-to-br from-surface via-surface to-steel-soft/30 p-8 sm:p-12 border border-line-strong shadow-xl space-y-6">
          <div className="font-display text-xl sm:text-2xl font-bold tracking-tight leading-snug text-ink max-w-3xl">
            &ldquo;We stopped sending senior engineers on multi-state yard trips. Every single lot on FerroBid arrives with a calibrated weighment slip, photos, and chemical assay. We bid on facts, not hope.&rdquo;
          </div>

          <div className="flex flex-wrap items-center justify-between gap-6 pt-4 border-t border-line">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-ember text-white grid place-items-center font-display font-extrabold text-lg shadow-md">
                A
              </div>
              <div>
                <div className="text-base font-bold text-ink flex items-center gap-1.5">
                  Arjun V. Sharma <BadgeCheck className="size-4 text-emerald-600 shrink-0" />
                </div>
                <div className="text-xs text-ink-muted font-medium">
                  Head of Raw Material Procurement · Re-Rolling Steel Mill
                </div>
              </div>
            </div>

            <div className="px-4 py-2 rounded-2xl bg-surface border border-line text-xs font-mono font-bold text-ink">
              ₹2.4 Cr Savings Achieved in FY26
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         9. INTERACTIVE FAQ WITH CATEGORY FILTERING & SEARCH
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Common Questions"
        title="Everything a first-time buyer asks."
        lede="Clear answers regarding EMD rules, inspection reports, anti-snipe bidding, and gate pass logistics."
      >
        <div className="mt-8 space-y-6">
          
          {/* Category Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {FAQ_CATEGORIES.map((cat) => (
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
                placeholder="Search FAQ questions..."
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
        eyebrow="READY TO SOURCE VERIFIED METAL?"
        title={<>Your Next Verified Lot Is <br /><span className="bg-gradient-to-r from-ember via-amber-500 to-emerald-600 bg-clip-text text-transparent">Already Live &amp; Inspected.</span></>}
        sub="Join 1,400+ industrial buyers. Register your verified account in minutes, preview full field inspection reports, and lock auto-refundable EMD only on what you contest."
        trustBadges={[
          { icon: <CheckCircle2 size={15} className="text-emerald-600" />, label: 'Free Buyer Registration' },
          { icon: <ShieldCheck size={15} className="text-emerald-600" />, label: '100% Refundable EMD Escrow' },
          { icon: <Clock size={15} className="text-emerald-600" />, label: 'Anti-Snipe Protected Bidding' },
        ]}
        primary={{ label: 'Register to Bid', to: '/login' }}
        secondary={{ label: 'Browse Live Catalogues', to: '/browse' }}
      />

    </Page>
  )
}
