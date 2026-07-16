/* ---------------------------------------------------------------------------
   Profile & settings — identity header, editable details, preferences,
   security, and (for buyers) the seller-capability card.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Moon, Sun, ShieldCheck, Smartphone, LogOut, Store } from 'lucide-react'
import { Page } from '../layout/Chrome'
import {
  PageHeader, Button, Chip, Avatar, Field, Input, Select, EmptyState,
} from '../components/ui'
import { useStore, ROLE_LABEL } from '../store/store'
import { fmtDate } from '../lib/format'
import type { User } from '../types'

function standingChip(standing: User['standing']) {
  switch (standing) {
    case 'good': return <Chip tone="success">Good standing</Chip>
    case 'watchlist': return <Chip tone="warning">Watchlist</Chip>
    case 'defaulter': return <Chip tone="danger">Defaulter</Chip>
  }
}

function kycChip(kyc: User['kycStatus']) {
  switch (kyc) {
    case 'verified': return <Chip tone="success">KYC verified</Chip>
    case 'pending': return <Chip tone="warning">KYC pending</Chip>
    case 'rejected': return <Chip tone="danger">KYC rejected</Chip>
    case 'none': return <Chip tone="neutral">KYC not started</Chip>
  }
}

function ProfileBody({ me }: { me: User }) {
  const role = useStore((s) => s.role)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const pushToast = useStore((s) => s.pushToast)
  const nav = useNavigate()

  const [form, setForm] = useState({
    name: me.name, email: me.email, phone: me.phone,
    firm: me.firm, gstin: me.gstin, city: me.city,
  })
  const [language, setLanguage] = useState('en')

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = () => pushToast({ kind: 'success', title: 'Profile updated (demo)', body: 'Changes are local to this session.' })

  return (
    <>
      {/* Identity header */}
      <div className="card p-6 mb-4 flex flex-wrap items-center gap-5">
        <Avatar name={me.name} hue={me.avatarHue} size={72} />
        <div className="flex-1 min-w-52">
          <h2 className="font-display text-xl font-bold">{me.name}</h2>
          <div className="text-sm text-ink-muted">{me.firm} · {me.city}</div>
          <div className="text-xs text-ink-faint mt-0.5">Member since {fmtDate(me.joinedAt)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="steel">{ROLE_LABEL[role]}</Chip>
          {standingChip(me.standing)}
          {kycChip(me.kycStatus)}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Editable details */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-display font-bold mb-4">Account details</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name"><Input value={form.name} onChange={setF('name')} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={setF('email')} /></Field>
            <Field label="Phone" hint="Used for OTP sign-in and SMS alerts.">
              <Input className="num" value={form.phone} onChange={setF('phone')} />
            </Field>
            <Field label="Firm / company"><Input value={form.firm} onChange={setF('firm')} /></Field>
            <Field label="GSTIN" hint="Changes to GSTIN trigger re-verification.">
              <Input className="num" value={form.gstin} onChange={setF('gstin')} />
            </Field>
            <Field label="City"><Input value={form.city} onChange={setF('city')} /></Field>
          </div>
          <div className="flex justify-end mt-5">
            <Button onClick={save}>Save changes</Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Preferences */}
          <div className="card p-6">
            <h3 className="font-display font-bold mb-4">Preferences</h3>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-sm font-semibold text-ink">Appearance</div>
                <div className="text-xs text-ink-muted mt-0.5">Currently {theme === 'dark' ? 'dark' : 'light'} theme.</div>
              </div>
              <Button variant="secondary" size="sm" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </Button>
            </div>
            <Field label="Language" hint="Interface language (demo stub).">
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </Select>
            </Field>
          </div>

          {/* Security */}
          <div className="card p-6">
            <h3 className="font-display font-bold mb-4">Security</h3>
            <div className="space-y-2.5">
              <Button variant="secondary" size="sm" className="w-full justify-start"
                onClick={() => pushToast({ kind: 'info', title: 'Change phone', body: 'An OTP would be sent to your current number to begin the change (demo).' })}>
                <Smartphone size={14} /> Change phone number
              </Button>
              <Button variant="secondary" size="sm" className="w-full justify-start"
                onClick={() => pushToast({ kind: 'info', title: 'Sessions cleared', body: 'You would be signed out on all other devices (demo).' })}>
                <LogOut size={14} /> Logout of all devices
              </Button>
            </div>
          </div>

          {/* Seller capability (buyers only) */}
          {role === 'buyer' && (
            <div className="card p-6 border-steel/25 bg-steel-soft/30">
              <div className="flex items-center gap-2 mb-2">
                <Store size={16} className="text-steel" />
                <h3 className="font-display font-bold">Seller capability</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {me.sellerVerified
                  ? <Chip tone="success"><ShieldCheck size={12} /> Seller verified</Chip>
                  : <Chip tone="neutral">Not a seller yet</Chip>}
                {kycChip(me.kycStatus)}
              </div>
              <p className="text-xs text-ink-muted mb-4">
                {me.sellerVerified
                  ? 'You can submit lots for inspection and cataloguing from the seller workspace.'
                  : 'Complete seller KYC to dispose your own scrap and surplus material through ferroBid auctions.'}
              </p>
              <Button variant="steel" size="sm" onClick={() => nav('/buyer/kyc')}>
                {me.sellerVerified ? 'View KYC details' : 'Start seller KYC'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function Profile() {
  const me = useStore((s) => s.currentUser)
  return (
    <Page>
      <PageHeader
        title="Profile & settings"
        sub="Your identity on ferroBid — account details, preferences and security."
      />
      {me ? (
        <ProfileBody key={me.id} me={me} />
      ) : (
        <EmptyState
          title="You are not signed in"
          body="Sign in with your registered phone number to view and edit your profile."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      )}
    </Page>
  )
}
