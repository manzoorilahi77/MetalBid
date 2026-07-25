/* Guest 2 — Contact (FAANG-level Luxury Flagship Page).
   Includes live global trading desks status widget, interactive intent-based inquiry form,
   reference ticket generation, global regional hubs directory, institutional SLA grid,
   searchable onboarding FAQ, and unified FAANG CTA band. */

import { useState, useMemo } from 'react'
import {
  Mail, Phone, MapPin, Clock, ShieldCheck,
  CheckCircle2, ChevronDown, Search, Zap, Globe,
  Building2, Send, Award, Headphones
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Field, Input, Select, Textarea, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { Section, CtaBand, usePageMeta } from './marketing'

/* ---------------------------------------------------------------------------
   DATA STRUCTURES FOR CONTACT PAGE
--------------------------------------------------------------------------- */

type OfficeLocation = {
  city: string
  country: string
  flag: string
  role: string
  address: string
  phone: string
  email: string
  hours: string
  status: string
}

const GLOBAL_OFFICES: OfficeLocation[] = [
  {
    city: 'Mumbai',
    country: 'India (Corporate HQ)',
    flag: '🇮🇳',
    role: 'Global HQ & Field Auditor Command',
    address: 'Level 14, One International Center, Lower Parel, Mumbai, MH 400013',
    phone: '+91 1800-419-000',
    email: 'mumbai.desk@ferrobid.com',
    hours: '09:00 - 20:00 IST (Mon-Sat)',
    status: 'Live Trading Desk',
  },
  {
    city: 'Dubai',
    country: 'UAE (Middle East Hub)',
    flag: '🇦🇪',
    role: 'Commodities & Gulf Billets Desk',
    address: 'Suite 2204, Almas Tower, Jumeirah Lakes Towers, Dubai, UAE',
    phone: '+971 4 399 1040',
    email: 'dubai.desk@ferrobid.com',
    hours: '08:00 - 18:00 GST (Sun-Thu)',
    status: 'Open Now · GMT+4',
  },
  {
    city: 'London',
    country: 'United Kingdom (Europe Hub)',
    flag: '🇬🇧',
    role: 'European Ferrous & Futures Desk',
    address: '15 Bishopsgate, Financial District, London EC2N 3AR',
    phone: '+44 20 7946 0912',
    email: 'london.desk@ferrobid.com',
    hours: '08:00 - 17:00 BST (Mon-Fri)',
    status: 'Open Now · GMT+1',
  },
  {
    city: 'Singapore',
    country: 'Singapore (APAC Hub)',
    flag: '🇸🇬',
    role: 'Asia-Pacific Procurement Logistics',
    address: 'Marina Bay Financial Centre Tower 1, 8 Marina Blvd, Singapore 018981',
    phone: '+65 6789 2040',
    email: 'singapore.desk@ferrobid.com',
    hours: '09:00 - 18:00 SGT (Mon-Fri)',
    status: 'Open Now · GMT+8',
  },
]

const CONTACT_FAQS = [
  {
    cat: 'Onboarding & Account',
    q: 'How fast is business KYC verified for new buyers and sellers?',
    a: 'Corporate KYC applications are processed in real time by our compliance desk. Once GST, PAN, and corporate incorporation documents are uploaded, approval typically completes within 15–30 minutes during desk operating hours.',
  },
  {
    cat: 'Yard Inspection Scheduling',
    q: 'How do I schedule an on-site field inspection for my yard’s scrap?',
    a: 'You can submit a yard inspection request using the form above or by selecting "Schedule Field Inspection". Our auditor command desk will contact you within 2 hours to confirm auditor dispatch to your yard location anywhere in India.',
  },
  {
    cat: 'Escrow & Payments',
    q: 'Who do I contact regarding wallet EMD top-ups or RTGS refunds?',
    a: 'Our Dedicated Escrow & Settlement Desk handles all EMD transactions and RTGS settlements 24/7. You can reach them directly via phone at +91 1800-419-000 (Ext 2) or email escrow@ferrobid.com.',
  },
  {
    cat: 'API & Data Feeds',
    q: 'Does FerroBid offer real-time auction data APIs for enterprise ERPs?',
    a: 'Yes. We provide REST & WebSocket APIs for high-volume enterprise buyers and sellers to integrate live bid rates, inspection reports, and delivery orders directly into SAP, Oracle, or custom ERP systems.',
  },
]

/* ---------------------------------------------------------------------------
   MAIN COMPONENT — Contact
--------------------------------------------------------------------------- */

export default function Contact() {
  usePageMeta({
    title: 'Contact Us — 24/7 Global Corporate & Trading Desks',
    description: 'Connect with FerroBid corporate trading desks worldwide for buyer procurement, plant scrap liquidation, yard inspection scheduling, or institutional support.',
  })

  const pushToast = useStore((s) => s.pushToast)

  // Form State
  const [intent, setIntent] = useState<'buyer' | 'seller' | 'inspection' | 'institutional'>('buyer')
  const [name, setName] = useState('')
  const [firm, setFirm] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [volume, setVolume] = useState('')
  const [message, setMessage] = useState('')
  const [ticketId, setTicketId] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const generatedTicket = `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`
    setTicketId(generatedTicket)

    pushToast({
      kind: 'success',
      title: `Inquiry Ticket #${generatedTicket} Created`,
      body: `Thank you, ${name}. Our global desk has received your request. Estimated response time: <15 mins.`,
    })
  }

  const handleResetForm = () => {
    setTicketId(null)
    setName('')
    setFirm('')
    setEmail('')
    setPhone('')
    setVolume('')
    setMessage('')
  }

  // FAQ Search State
  const [faqSearch, setFaqSearch] = useState('')
  const filteredFaqs = useMemo(() => {
    return CONTACT_FAQS.filter((item) => {
      return !faqSearch || item.q.toLowerCase().includes(faqSearch.toLowerCase()) || item.a.toLowerCase().includes(faqSearch.toLowerCase())
    })
  }, [faqSearch])

  return (
    <Page className="space-y-20 sm:space-y-32 pb-16">
      
      {/* ---------------------------------------------------------------------------
         1. FAANG EDITORIAL CONTACT HERO & GLOBAL DESKS WIDGET
      --------------------------------------------------------------------------- */}
      <section className="pt-4 sm:pt-10 animate-fade-up">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Hero Left Column */}
          <div className="lg:col-span-7 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-ember-soft border border-ember/25 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-ember-strong mb-6 shadow-sm">
              <Globe className="size-3.5" /> 24/7 Global Corporate Desk
            </div>

            <h1 className="font-display text-4xl sm:text-6xl lg:text-[3.75rem] font-extrabold tracking-tight leading-[1.06] text-balance">
              Talk to the team <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-ember via-ember-strong to-amber-600 bg-clip-text text-transparent">
                behind the auctions
              </span>
            </h1>

            <p className="text-base sm:text-xl text-ink-muted mt-6 leading-relaxed text-pretty font-normal">
              Whether you are sourcing metal for a multi-state mill, liquidating plant surplus scrap, scheduling a yard inspection, or inquiring about institutional APIs — our global desk responds within 15 minutes.
            </p>

            {/* Direct Channels Bar */}
            <div className="mt-8 pt-6 border-t border-line grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-line shadow-sm">
                <div className="size-10 rounded-xl bg-ember-soft text-ember-strong grid place-items-center shrink-0">
                  <Phone className="size-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Toll Free Hotline</div>
                  <a href="tel:+911800419000" className="num text-xs font-extrabold text-ink hover:text-ember">1800-419-000</a>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-line shadow-sm">
                <div className="size-10 rounded-xl bg-steel-soft text-steel-strong grid place-items-center shrink-0">
                  <Mail className="size-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Corporate Email</div>
                  <a href="mailto:corporate@ferrobid.com" className="text-xs font-bold text-ink hover:text-steel truncate block">corporate@ferrobid.com</a>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-line shadow-sm">
                <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
                  <Clock className="size-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Average SLA</div>
                  <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">&lt;15 Mins Response</div>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Right Column: Global Desks Live Status Widget */}
          <div className="lg:col-span-5 relative">
            <div className="absolute -top-12 -right-8 size-80 bg-ember/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 size-72 bg-steel/15 rounded-full blur-3xl pointer-events-none" />

            {/* Widget Container */}
            <div className="relative rounded-3xl bg-surface/90 backdrop-blur-2xl border border-line-strong/80 p-6 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.35)] space-y-4">
              
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-mono font-bold text-ember flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-live-pulse" /> GLOBAL TRADING DESKS
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  4 Desks Live
                </span>
              </div>

              {/* Offices Status List */}
              <div className="space-y-2.5">
                {GLOBAL_OFFICES.map((office) => (
                  <div key={office.city} className="p-3 rounded-2xl bg-canvas border border-line flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{office.flag}</span>
                      <div>
                        <div className="font-bold text-ink">{office.city} Desk</div>
                        <div className="text-[11px] text-ink-muted">{office.role}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface text-[10px] font-mono font-bold text-steel border border-line shrink-0">
                      {office.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-center text-[11px] text-ink-faint">
                Connected to institutional market makers &amp; field inspectors 24/7.
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ---------------------------------------------------------------------------
         2. INTERACTIVE ENTERPRISE INQUIRY FORM
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Direct Inquiry Engine"
        title={<>How can our corporate team <span className="text-ember">assist you</span>?</>}
        lede="Select your inquiry type below to route your request directly to the appropriate regional trading desk."
      >
        <div className="mt-8 card bg-surface p-6 sm:p-10 border border-line-strong shadow-xl">
          
          {/* Intent Switcher Pills */}
          <div className="space-y-3 mb-8">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Select Inquiry Purpose:</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIntent('buyer')}
                className={cx(
                  'px-4 py-2 rounded-2xl text-xs font-display font-bold transition-all cursor-pointer flex items-center gap-2',
                  intent === 'buyer' ? 'bg-ember text-white shadow-md shadow-ember/20' : 'bg-surface-2 border border-line text-ink-muted hover:text-ink'
                )}
              >
                <CheckCircle2 className="size-4" /> Corporate Buyer Procurement
              </button>

              <button
                type="button"
                onClick={() => setIntent('seller')}
                className={cx(
                  'px-4 py-2 rounded-2xl text-xs font-display font-bold transition-all cursor-pointer flex items-center gap-2',
                  intent === 'seller' ? 'bg-steel text-white shadow-md shadow-steel/20' : 'bg-surface-2 border border-line text-ink-muted hover:text-ink'
                )}
              >
                <Building2 className="size-4" /> Plant Scrap Liquidation
              </button>

              <button
                type="button"
                onClick={() => setIntent('inspection')}
                className={cx(
                  'px-4 py-2 rounded-2xl text-xs font-display font-bold transition-all cursor-pointer flex items-center gap-2',
                  intent === 'inspection' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-surface-2 border border-line text-ink-muted hover:text-ink'
                )}
              >
                <ShieldCheck className="size-4" /> Schedule Field Inspection
              </button>

              <button
                type="button"
                onClick={() => setIntent('institutional')}
                className={cx(
                  'px-4 py-2 rounded-2xl text-xs font-display font-bold transition-all cursor-pointer flex items-center gap-2',
                  intent === 'institutional' ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20' : 'bg-surface-2 border border-line text-ink-muted hover:text-ink'
                )}
              >
                <Award className="size-4" /> Institutional &amp; Press
              </button>
            </div>
          </div>

          {/* Form / Ticket Confirmation View */}
          {ticketId ? (
            <div className="p-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4 animate-bid-in">
              <div className="size-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 grid place-items-center mx-auto">
                <CheckCircle2 className="size-8" />
              </div>

              <h3 className="font-display text-2xl font-bold text-ink">
                Inquiry Ticket #{ticketId} Generated
              </h3>

              <p className="text-sm text-ink-muted max-w-lg mx-auto leading-relaxed">
                Thank you, <strong>{name}</strong>. Your inquiry regarding <strong>{firm || 'your company'}</strong> has been routed to our regional <strong>{intent.toUpperCase()} desk</strong>.
              </p>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-surface border border-line text-xs font-mono font-bold text-ink">
                <Clock className="size-4 text-emerald-600" /> Response SLA: Guaranteed under 15 minutes
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-6 py-2.5 rounded-xl bg-surface hover:bg-surface-2 border border-line-strong text-xs font-bold text-ink transition-all cursor-pointer"
                >
                  Submit Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <Field label="Full Name *">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Vikramaditya Sharma"
                  />
                </Field>

                <Field label="Company / Entity Name">
                  <Input
                    value={firm}
                    onChange={(e) => setFirm(e.target.value)}
                    placeholder="e.g. Jindal Steel & Power Ltd"
                  />
                </Field>

                <Field label="Corporate Email *">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                  />
                </Field>

                <Field label="Phone / WhatsApp Number">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </Field>

                <Field label="Monthly Metal Volume (Est.)">
                  <Input
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    placeholder="e.g. 500 MT / month"
                  />
                </Field>

                <Field label="Target Metal Category">
                  <Select>
                    <option value="ferrous">Ferrous Scrap (HMS / Shredded)</option>
                    <option value="flat">Flat Steel (HR / CR Coils)</option>
                    <option value="nonferrous">Non-Ferrous (Copper / Aluminium)</option>
                    <option value="heavy">Heavy Industrial Machinery</option>
                    <option value="other">Other Surplus Assets</option>
                  </Select>
                </Field>
              </div>

              <Field label="Detailed Inquiry / Requirements *">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  placeholder="Provide material grade specs, yard location, or procurement timeline details..."
                  rows={4}
                />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                  Strict corporate confidentiality &amp; non-disclosure guarantee.
                </div>

                <Button type="submit" size="lg" className="shadow-lg shadow-ember/20">
                  Submit Inquiry Ticket <Send className="size-4 ml-1" />
                </Button>
              </div>

            </form>
          )}

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         3. GLOBAL REGIONAL HUBS & OFFICES DIRECTORY
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Global Presence"
        title={<>International hubs &amp; <span className="text-ember">regional offices</span>.</>}
        lede="Visit or contact our regional trading floors and compliance centers worldwide."
      >
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {GLOBAL_OFFICES.map((office) => (
            <div key={office.city} className="card p-6 border border-line hover:border-line-strong transition-all bg-surface space-y-4 flex flex-col">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{office.flag}</span>
                  <div>
                    <h3 className="font-display font-bold text-lg text-ink">{office.city}</h3>
                    <div className="text-[11px] text-ink-muted">{office.country}</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                  Active
                </span>
              </div>

              <div className="text-xs text-ink-muted font-medium border-t border-b border-line py-3 space-y-2 flex-1">
                <div className="flex items-start gap-2">
                  <MapPin className="size-4 text-ember shrink-0 mt-0.5" />
                  <span>{office.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-steel shrink-0" />
                  <span>{office.hours}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                <a href={`tel:${office.phone}`} className="num font-bold text-ink hover:text-ember flex items-center gap-1.5">
                  <Phone className="size-3.5 text-ember" /> {office.phone}
                </a>
                <a href={`mailto:${office.email}`} className="font-medium text-steel dark:text-steel-strong hover:underline flex items-center gap-1.5 truncate">
                  <Mail className="size-3.5 text-steel" /> {office.email}
                </a>
              </div>

            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         4. INSTITUTIONAL SUPPORT SLAS & VIP PROTOCOL GRID
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Enterprise Commitments"
        title={<>Institutional support <span className="text-ember">SLA framework</span>.</>}
        lede="Designed for high-volume corporate accounts requiring dedicated support protocols."
      >
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="card p-5 space-y-2 border border-line bg-surface">
            <div className="size-10 rounded-xl bg-ember-soft text-ember-strong grid place-items-center font-bold">
              <Zap className="size-5" />
            </div>
            <h4 className="font-display font-bold text-base text-ink">Priority Yard Dispatch</h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              Certified field auditor dispatched to your yard within 24 hours of request.
            </p>
          </div>

          <div className="card p-5 space-y-2 border border-line bg-surface">
            <div className="size-10 rounded-xl bg-steel-soft text-steel-strong grid place-items-center font-bold">
              <Headphones className="size-5" />
            </div>
            <h4 className="font-display font-bold text-base text-ink">Key Account Manager</h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              Dedicated single point of contact assigned to accounts with &gt;100 MT/month volume.
            </p>
          </div>

          <div className="card p-5 space-y-2 border border-line bg-surface">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center font-bold">
              <ShieldCheck className="size-5" />
            </div>
            <h4 className="font-display font-bold text-base text-ink">Escrow &amp; Tax Helpdesk</h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              Real-time RTGS settlement assistance, GST reconciliation, and TCS credit filings.
            </p>
          </div>

          <div className="card p-5 space-y-2 border border-line bg-surface">
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center font-bold">
              <Phone className="size-5" />
            </div>
            <h4 className="font-display font-bold text-base text-ink">24/7 Bidding Hotline</h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              Live telephone trading desk assistance during high-stakes auction closing windows.
            </p>
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         5. INTERACTIVE SEARCHABLE ONBOARDING FAQ
      --------------------------------------------------------------------------- */}
      <Section
        eyebrow="Onboarding FAQs"
        title="Frequently asked contact questions."
        lede="Quick answers regarding corporate KYC, inspection dispatch, and account managers."
      >
        <div className="mt-8 space-y-6">
          
          {/* Search Bar */}
          <div className="relative max-w-md mx-auto sm:mx-0">
            <Search className="absolute left-3 top-2.5 size-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search contact & onboarding questions..."
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
                No matching questions found for "{faqSearch}". Try another keyword.
              </div>
            )}
          </div>

        </div>
      </Section>

      {/* ---------------------------------------------------------------------------
         6. UNIFIED FAANG LUXURY CLOSING CTA BANNER
      --------------------------------------------------------------------------- */}
      <CtaBand
        eyebrow="CONNECT WITH OUR DESK TODAY"
        title={<>Start Sourcing Or Liquidating <br /><span className="bg-gradient-to-r from-ember via-amber-500 to-emerald-600 bg-clip-text text-transparent">With Full Audit Transparency.</span></>}
        sub="Create your verified enterprise account or speak with a regional trading specialist to streamline your metal procurement."
        trustBadges={[
          { icon: <CheckCircle2 size={15} className="text-emerald-600" />, label: 'Guaranteed <15m Response SLA' },
          { icon: <ShieldCheck size={15} className="text-emerald-600" />, label: '100% Confidential Inquiry Handling' },
          { icon: <Clock size={15} className="text-emerald-600" />, label: '24/7 Global Trading Hotline' },
        ]}
        primary={{ label: 'Register Free Account', to: '/login' }}
        secondary={{ label: 'Browse Live Catalogues', to: '/browse' }}
      />

    </Page>
  )
}
