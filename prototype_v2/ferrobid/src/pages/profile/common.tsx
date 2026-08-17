/* ---------------------------------------------------------------------------
   The three panels every role carries: who you are, how you get in, and how
   the platform behaves for you.

   Only the account form is lifted to the page — the identity plate reads its
   gaps to work out how complete the record is. Everything else is session-local
   demo state and owns itself, because the real mutation path for all of it is
   admin-side `updateUserDetails`.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, BadgeCheck, Bell, Building2, Check, ChevronRight, Download,
  Eye, EyeOff, FileText, Fingerprint, Globe, IdCard, KeyRound, Laptop, LifeBuoy,
  Monitor, Moon, Network, ShieldCheck, Smartphone, Sun, Trash2, UserRound,
} from 'lucide-react'
import {
  Button, Chip, Field, Input, Modal, ProgressBar, Select, Textarea, Toggle, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate } from '../../lib/format'
import type { User } from '../../types'
import { A, Granted, Label, Panel, Row, SaveBar, focusRing } from './kit'

/* ------------------------------ the account form --------------------------- */

/** One shape for both variants. A trade account fills the statutory half and a
    staff account fills the employment half; neither ever sees the other's
    fields, but keeping one type means the plate's completeness maths, the save
    bar and the "jump to the missing field" shortcut are written once. */
export interface ProfileForm {
  name: string; designation: string; email: string; billingEmail: string
  phone: string; altPhone: string
  firm: string; businessType: string; gstin: string; pan: string; udyam: string
  address: string; city: string; state: string; pincode: string
  employeeCode: string; department: string; baseLocation: string; reportingTo: string
  emergencyName: string; emergencyPhone: string
}

export type AccountVariant = 'trade' | 'staff'

export const BUSINESS_TYPES = [
  'Proprietorship', 'Partnership firm', 'Limited Liability Partnership',
  'Private Limited Company', 'Public Limited Company', 'HUF', 'Trust / Society',
]

export const STATES = [
  'Andhra Pradesh', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha',
  'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal',
]

export const REGIONS = ['West', 'North', 'South', 'East', 'Central']

/** Staff employee code, derived from the account id so it is stable across a
    reload without the User record having to carry one yet. */
export const staffCode = (me: User) => `FB-${me.id.replace(/^u-/, '').toUpperCase()}`

const DEPARTMENT: Record<string, string> = {
  field_exec: 'Field operations',
  exec_manager: 'Operations',
  auction_manager: 'Auction floor',
  finance_admin: 'Finance & accounts',
  sub_admin: 'Operations — supervisory',
  super_admin: 'Platform engineering',
  ceo: 'Executive',
}

const REPORTS_TO: Record<string, string> = {
  field_exec: 'Operation Manager',
  exec_manager: 'Sub-Admin (Head of Operations)',
  auction_manager: 'Sub-Admin (Head of Operations)',
  finance_admin: 'CEO / MD',
  sub_admin: 'CEO / MD',
  super_admin: 'CEO / MD',
  ceo: 'Board',
}

export function makeInitialForm(me: User, variant: AccountVariant): ProfileForm {
  return {
    name: me.name,
    designation: variant === 'trade' ? 'Proprietor' : 'Senior executive',
    email: me.email,
    billingEmail: me.email,
    phone: me.phone,
    altPhone: '',
    firm: me.firm,
    businessType: 'Private Limited Company',
    gstin: me.gstin,
    pan: me.gstin ? me.gstin.slice(2, 12) : '',
    udyam: '',
    address: '',
    city: me.city,
    state: 'Maharashtra',
    pincode: '',
    employeeCode: staffCode(me),
    department: DEPARTMENT[me.role] ?? 'Operations',
    baseLocation: me.city,
    reportingTo: REPORTS_TO[me.role] ?? 'Operations',
    emergencyName: '',
    emergencyPhone: '',
  }
}

/** What "complete" means, per variant. Every entry is a shortcut on the plate:
    clicking one opens Account and puts the caret in the field that is missing. */
export function completenessFields(form: ProfileForm, variant: AccountVariant) {
  const trade = [
    { id: 'f-name', label: 'name', filled: Boolean(form.name) },
    { id: 'f-email', label: 'email', filled: Boolean(form.email) },
    { id: 'f-phone', label: 'mobile', filled: Boolean(form.phone) },
    { id: 'f-firm', label: 'firm', filled: Boolean(form.firm) },
    { id: 'f-gstin', label: 'GSTIN', filled: Boolean(form.gstin) },
    { id: 'f-pan', label: 'PAN', filled: Boolean(form.pan) },
    { id: 'f-city', label: 'city', filled: Boolean(form.city) },
    { id: 'f-address', label: 'address', filled: Boolean(form.address) },
    { id: 'f-pincode', label: 'PIN code', filled: Boolean(form.pincode) },
  ]
  const staff = [
    { id: 'f-name', label: 'name', filled: Boolean(form.name) },
    { id: 'f-email', label: 'work email', filled: Boolean(form.email) },
    { id: 'f-phone', label: 'mobile', filled: Boolean(form.phone) },
    { id: 'f-altPhone', label: 'alt. mobile', filled: Boolean(form.altPhone) },
    { id: 'f-baseLocation', label: 'base', filled: Boolean(form.baseLocation) },
    { id: 'f-emergencyName', label: 'contact', filled: Boolean(form.emergencyName) },
    { id: 'f-emergencyPhone', label: 'contact no.', filled: Boolean(form.emergencyPhone) },
  ]
  return variant === 'trade' ? trade : staff
}

/** Owns the form and derives everything the plate and the save bar need. */
export function useAccountForm(me: User, variant: AccountVariant) {
  const initial = useMemo(() => makeInitialForm(me, variant), [me, variant])
  const [form, setForm] = useState<ProfileForm>(initial)
  const dirty = useMemo(
    () => (Object.keys(initial) as (keyof ProfileForm)[]).some((k) => form[k] !== initial[k]),
    [form, initial],
  )
  const setF = (k: keyof ProfileForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))
  const reset = () => setForm(initial)
  const fields = completenessFields(form, variant)
  const gaps = fields.filter((f) => !f.filled)
  return { form, setF, dirty, reset, fields, gaps, done: fields.length - gaps.length }
}

/* ------------------------------ Account section ---------------------------- */

export function AccountSection({ me, variant, form, setF, dirty, reset }: {
  me: User; variant: AccountVariant
  form: ProfileForm
  setF: (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  dirty: boolean; reset: () => void
}) {
  const pushToast = useStore((s) => s.pushToast)
  const save = () => pushToast({
    kind: 'success', title: 'Profile updated (demo)',
    body: 'Changes are local to this session — the live path is an admin-side update.',
  })

  return (
    <>
      <Panel wide icon={<UserRound size={17} />} title="Personal details"
        desc={variant === 'trade'
          ? 'Who signs in, and who we contact about your bids.'
          : 'Who signs in, and how the desk reaches you when something needs a decision.'}>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <Field label="Full name"><Input id="f-name" value={form.name} onChange={setF('name')} /></Field>
          <Field label={variant === 'trade' ? 'Designation' : 'Job title'}
            hint={variant === 'trade' ? 'Printed on delivery orders and gate passes.' : 'Shown beside your name in the audit trail.'}>
            <Input value={form.designation} onChange={setF('designation')} />
          </Field>
          <Field label={
            <span className="flex items-center justify-between gap-2">
              {variant === 'trade' ? 'Email' : 'Work email'}
              <Chip tone="success" className="h-5 text-[10px]"><Check size={10} /> Verified</Chip>
            </span>}>
            <Input id="f-email" type="email" value={form.email} onChange={setF('email')} />
          </Field>
          <Field label={
            <span className="flex items-center justify-between gap-2">Registered mobile
              <Chip tone="success" className="h-5 text-[10px]"><Check size={10} /> Verified</Chip>
            </span>}
            hint="Used for OTP sign-in and every time-critical alert.">
            <Input id="f-phone" className="num" value={form.phone} onChange={setF('phone')} />
          </Field>
          <Field label="Alternate mobile"
            hint={variant === 'trade' ? 'Optional — a backup for lifting coordination.' : 'Reached when the primary number is unavailable mid-shift.'}>
            <Input id="f-altPhone" className="num" value={form.altPhone} onChange={setF('altPhone')} placeholder="+91" />
          </Field>
          {variant === 'trade' ? (
            <Field label="Accounts / billing email" hint="Invoices and TDS documents go here.">
              <Input type="email" value={form.billingEmail} onChange={setF('billingEmail')} />
            </Field>
          ) : (
            <Field label="Base location" hint="Where you normally work from.">
              <Input id="f-baseLocation" value={form.baseLocation} onChange={setF('baseLocation')} />
            </Field>
          )}
        </div>
      </Panel>

      {variant === 'trade' ? (
        <Panel wide icon={<Building2 size={17} />} title="Business & statutory record"
          desc="The details that appear on your invoices, EMD receipts and delivery orders."
          aside={<Chip tone="steel">Locked after KYC</Chip>}>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <Field label="Firm / company"><Input id="f-firm" value={form.firm} onChange={setF('firm')} /></Field>
            <Field label="Constitution">
              <Select value={form.businessType} onChange={setF('businessType')}>
                {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label={
              <span className="flex items-center justify-between gap-2">GSTIN
                <Chip tone="success" className="h-5 text-[10px]"><BadgeCheck size={10} /> Validated</Chip>
              </span>}
              hint="Changing this triggers re-verification and pauses trading until cleared.">
              <Input id="f-gstin" className="num uppercase" value={form.gstin} onChange={setF('gstin')} />
            </Field>
            <Field label="PAN (firm)" hint="Required for TCS deduction on purchases above ₹50 lakh.">
              <Input id="f-pan" className="num uppercase" value={form.pan} onChange={setF('pan')} placeholder="AAECM4321Q" />
            </Field>
            <Field label="Udyam / MSME number" hint="Optional — unlocks MSME payment terms where a counterparty offers them.">
              <Input className="num uppercase" value={form.udyam} onChange={setF('udyam')} placeholder="UDYAM-MH-00-0000000" />
            </Field>
            <Field label="City"><Input id="f-city" value={form.city} onChange={setF('city')} /></Field>
            <Field label="Registered office address" className="sm:col-span-2">
              <Textarea id="f-address" value={form.address} onChange={setF('address')}
                placeholder="Building, street, area" className="min-h-20" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="State">
                <Select value={form.state} onChange={setF('state')}>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="PIN code">
                <Input id="f-pincode" className="num" value={form.pincode} onChange={setF('pincode')} placeholder="400001" maxLength={6} />
              </Field>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <Panel icon={<IdCard size={17} />} title="Staff record"
            desc="Set by the Super Admin when the account was created. Ask them to change any of it."
            aside={<Chip tone="steel">Read-only</Chip>}>
            <Granted items={[
              { label: 'Employee code', value: form.employeeCode },
              { label: 'Sign-in username', value: <span className="lowercase">{me.username ?? me.id.replace(/^u-/, '')}</span> },
              { label: 'Department', value: <span className="font-sans">{form.department}</span> },
              { label: 'Reports to', value: <span className="font-sans">{form.reportingTo}</span> },
              { label: 'Account opened', value: fmtDate(me.joinedAt) },
              { label: 'Account status', value: <span className="font-sans capitalize">{me.accountStatus ?? 'active'}</span> },
            ]}
              note="Removing a role suspends everyone holding it and a ban closes the account — staff accounts are never deleted, so the history behind every decision stays readable." />
          </Panel>

          <Panel icon={<LifeBuoy size={17} />} title="Emergency contact"
            desc="Held for yard visits, late shifts and travel. Seen only by Operations and the Super Admin.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Contact name">
                <Input id="f-emergencyName" value={form.emergencyName} onChange={setF('emergencyName')} placeholder="Full name" />
              </Field>
              <Field label="Contact number">
                <Input id="f-emergencyPhone" className="num" value={form.emergencyPhone} onChange={setF('emergencyPhone')} placeholder="+91" />
              </Field>
            </div>
          </Panel>
        </>
      )}

      {dirty && <SaveBar onDiscard={reset} onSave={save} />}
    </>
  )
}

/* ----------------------------- change password ----------------------------- */

const RULES = [
  { label: 'At least 10 characters', test: (p: string) => p.length >= 10 },
  { label: 'One uppercase and one lowercase letter', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pushToast = useStore((s) => s.pushToast)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)

  const passed = RULES.filter((r) => r.test(next)).length
  const strong = passed === RULES.length
  const mismatch = confirm.length > 0 && confirm !== next
  const ready = current.length > 0 && strong && !mismatch && confirm.length > 0
  const strengthLabel = next.length === 0 ? 'Not set' : ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][passed]

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setShow(false) }
  const submit = () => {
    pushToast({
      kind: 'success', title: 'Password changed',
      body: 'You stay signed in on this device; every other session was signed out (demo).',
    })
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Change password">
      <div className="space-y-4">
        <Field label="Current password">
          <Input type={show ? 'text' : 'password'} value={current} autoComplete="current-password"
            onChange={(e) => setCurrent(e.target.value)} placeholder="Enter your current password" />
        </Field>

        <Field label="New password">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} value={next} autoComplete="new-password"
              className="pr-10" onChange={(e) => setNext(e.target.value)} placeholder="Choose a strong password" />
            <button type="button" onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide passwords' : 'Show passwords'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-ink-muted">Strength</span>
            <span className={cx('text-xs font-bold', strong ? 'text-success' : 'text-warning')}>{strengthLabel}</span>
          </div>
          <ProgressBar value={passed} max={RULES.length} tone={strong ? 'success' : 'warning'} />
          <ul className="mt-3 space-y-1.5">
            {RULES.map((r) => {
              const ok = r.test(next)
              return (
                <li key={r.label} className={cx('flex items-center gap-2 text-xs', ok ? 'text-success' : 'text-ink-muted')}>
                  <span className={cx('grid place-items-center size-4 rounded-full border shrink-0',
                    ok ? 'bg-success-soft border-success/30' : 'border-line-strong')}>
                    {ok && <Check size={10} />}
                  </span>
                  {r.label}
                </li>
              )
            })}
          </ul>
        </div>

        <Field label="Confirm new password"
          hint={mismatch ? <span className="text-danger font-semibold">Passwords do not match.</span> : undefined}>
          <Input type={show ? 'text' : 'password'} value={confirm} autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter the new password" />
        </Field>

        <p className="text-xs text-ink-muted leading-relaxed">
          Changing your password signs you out of every other device. Nothing you have open — a live bid,
          a claimed queue item, an unsigned approval — is affected.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button disabled={!ready} onClick={submit}>Update password</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------ Security section --------------------------- */

const SESSIONS = [
  { device: 'Chrome · Windows 11', where: 'Mumbai, Maharashtra', when: 'Active now', current: true, icon: <Monitor size={15} /> },
  { device: 'ferroBid app · Android', where: 'Mumbai, Maharashtra', when: 'Yesterday, 6:42 PM', current: false, icon: <Smartphone size={15} /> },
  { device: 'Safari · macOS', where: 'Pune, Maharashtra', when: '12 Aug, 11:08 AM', current: false, icon: <Laptop size={15} /> },
]

/** `hardened` is for the three desks whose credential is worth stealing —
    Finance, Super Admin and the CEO. Two-factor stops being a choice, the
    session is short by policy, and sign-in is pinned to known networks. */
export function SecuritySection({ me, hardened, canDeactivate = true }: {
  me: User; hardened?: boolean; canDeactivate?: boolean
}) {
  const pushToast = useStore((s) => s.pushToast)
  const [pwOpen, setPwOpen] = useState(false)
  const [twoFactor, setTwoFactor] = useState(true)
  const [loginAlerts, setLoginAlerts] = useState(true)
  const [ipLock, setIpLock] = useState(hardened ?? false)
  const [hardwareKey, setHardwareKey] = useState(false)
  const [idleTimeout, setIdleTimeout] = useState(hardened ? '15' : '60')

  const demo = (title: string, body: string) => () => pushToast({ kind: 'info', title, body })

  return (
    <>
      <Panel icon={<KeyRound size={17} />} title="Sign-in"
        desc="Your account is protected by a password plus an OTP to your registered mobile."
        flush>
        <Row icon={<KeyRound size={15} />} label="Password" desc="Last changed 3 months ago."
          control={<Button variant="secondary" size="sm" onClick={() => setPwOpen(true)}>Change password</Button>} />
        <Row icon={<Smartphone size={15} />} label="Registered mobile"
          desc={<span className="num">{me.phone}</span>}
          control={<Button variant="secondary" size="sm"
            onClick={demo('Change mobile number', 'An OTP would go to your current number to begin the change (demo).')}>
            Change number
          </Button>} />
        <Row icon={<ShieldCheck size={15} />} label="Two-factor authentication"
          desc={hardened
            ? 'Required on this desk — an OTP on every sign-in, not just from a new device. It cannot be switched off.'
            : 'Require an OTP on every sign-in, not just from a new device. Strongly recommended.'}
          control={hardened
            ? <Chip tone="success"><ShieldCheck size={12} /> Enforced</Chip>
            : <Toggle checked={twoFactor} onChange={setTwoFactor} />} />
        <Row icon={<Bell size={15} />} label="New sign-in alerts"
          desc="Notify me whenever the account is opened from an unrecognised device."
          control={<Toggle checked={loginAlerts} onChange={setLoginAlerts} />} />
      </Panel>

      <Panel icon={<Fingerprint size={17} />} title="Session policy"
        desc="How long a signed-in window stays usable, and from where."
        flush>
        <div className="px-5 sm:px-6 py-4 border-t border-line">
          <Field label="Sign out after inactivity"
            hint={hardened ? 'Capped at 30 minutes for this desk by platform policy.' : 'Applies to this browser only.'}>
            <Select className="max-w-56" value={idleTimeout} onChange={(e) => setIdleTimeout(e.target.value)}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              {!hardened && <option value="60">1 hour</option>}
              {!hardened && <option value="480">8 hours</option>}
            </Select>
          </Field>
        </div>
        <Row icon={<Network size={15} />} label="Restrict sign-in to known networks"
          desc="Only the office and VPN ranges on record may open this account. A new network needs Super Admin approval."
          control={<Toggle checked={ipLock} onChange={setIpLock} />} />
        <Row icon={<Fingerprint size={15} />} label="Hardware security key"
          desc="Register a FIDO2 key as the second factor in place of an SMS OTP."
          control={<Button variant="secondary" size="sm"
            onClick={() => { setHardwareKey(true); pushToast({ kind: 'info', title: 'Register a key', body: 'Your browser would prompt for the key here (demo).' }) }}>
            {hardwareKey ? 'Registered' : 'Register key'}
          </Button>} />
      </Panel>

      <Panel wide icon={<Monitor size={17} />} title="Active sessions"
        desc="Everywhere your account is currently signed in."
        aside={<Button variant="secondary" size="sm"
          onClick={demo('Signed out everywhere', 'All other devices would be signed out (demo).')}>
          Sign out everywhere
        </Button>}
        flush>
        {SESSIONS.map((s) => (
          <Row key={s.device} icon={s.icon}
            label={<span className="flex items-center gap-2">{s.device}
              {s.current && <Chip tone="success" className="h-5 text-[10px]">This device</Chip>}</span>}
            desc={`${s.where} · ${s.when}`}
            control={s.current
              ? <span className="text-xs text-ink-muted">Current</span>
              : <Button variant="ghost" size="sm"
                  onClick={demo('Session revoked', `${s.device} would be signed out (demo).`)}>Revoke</Button>} />
        ))}
      </Panel>

      <Panel wide icon={<AlertTriangle size={17} />} title="Account controls"
        desc="High-impact actions. Anything that would close an account with open positions is reviewed first."
        flush>
        <Row icon={<Download size={15} />} label="Download my data"
          desc="A ZIP of everything this account did on the platform, emailed within 24 hours."
          control={<Button variant="secondary" size="sm"
            onClick={demo('Export requested', 'Your data export would be emailed to you (demo).')}>Request export</Button>} />
        {canDeactivate ? (
          <Row icon={<Trash2 size={15} />} label="Deactivate account"
            desc="Blocked while you hold live bids, locked EMD or an open delivery. Records are retained for statutory audit."
            control={<Button variant="secondary" size="sm" className="text-danger border-danger/40 hover:border-danger"
              onClick={demo('Deactivation requested', 'Compliance would review your open positions before closing the account (demo).')}>
              Deactivate
            </Button>} />
        ) : (
          <Row icon={<Trash2 size={15} />} label="Close this staff account"
            desc="Staff accounts are never deleted — the Super Admin suspends or bans them so the record behind every decision stays readable."
            control={<Chip tone="neutral">Super Admin only</Chip>} />
        )}
      </Panel>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  )
}

/* ---------------------------- Preferences section -------------------------- */

export function PreferencesSection({ variant, notificationSummary, supportLinks }: {
  variant: AccountVariant
  notificationSummary?: string
  supportLinks?: { icon: React.ReactNode; label: string; desc: string; to: string }[]
}) {
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const nav = useNavigate()
  const [language, setLanguage] = useState('en')
  const [dateFormat, setDateFormat] = useState('dmy')
  const [amountStyle, setAmountStyle] = useState('lakh')
  const [density, setDensity] = useState('comfortable')
  const [reduceMotion, setReduceMotion] = useState(false)

  const links = supportLinks ?? [
    { icon: <FileText size={15} />, label: 'Terms of use & privacy policy', desc: 'Version in force since 01 Apr 2025.', to: '/legal' },
    { icon: <LifeBuoy size={15} />, label: 'Help centre', desc: 'Bidding rules, EMD policy, lifting and payment timelines.', to: '/help' },
    { icon: <AlertTriangle size={15} />, label: 'Raise a dispute', desc: 'Quality, quantity or delivery issues on a won lot.', to: '/disputes' },
  ]

  return (
    <>
      <Panel wide icon={<Globe size={17} />} title="Appearance & locale"
        desc="How ferroBid looks, and how it formats every number you read on it."
        flush>
        <Row icon={theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />} label="Theme"
          desc={`Currently the ${theme === 'dark' ? 'dark' : 'light'} theme. Bid rooms stay high-contrast in both.`}
          control={<Button variant="secondary" size="sm" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          </Button>} />
        <div className="px-5 sm:px-6 py-5 border-t border-line grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Field label="Language">
            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </Select>
          </Field>
          <Field label="Date format">
            <Select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
              <option value="dmy">31 Dec 2025</option>
              <option value="num">31/12/2025</option>
            </Select>
          </Field>
          <Field label="Amount display">
            <Select value={amountStyle} onChange={(e) => setAmountStyle(e.target.value)}>
              <option value="lakh">Lakh / crore (₹12.4 L)</option>
              <option value="full">Full figures (₹12,40,000)</option>
            </Select>
          </Field>
          <Field label="Table density" hint="Rows per screen on long lists.">
            <Select value={density} onChange={(e) => setDensity(e.target.value)}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </Select>
          </Field>
        </div>
        <Row label="Reduce motion"
          desc="Turns off countdown pulses, panel entrances and the live ticker. Your system setting already does this — use it to override on this device."
          control={<Toggle checked={reduceMotion} onChange={setReduceMotion} />} />
      </Panel>

      <Panel icon={<Bell size={17} />} title="Notifications"
        desc={notificationSummary ?? 'Outbid alerts, closing reminders, EMD movement and result announcements.'}
        aside={<Button variant="secondary" size="sm" onClick={() => nav('/settings/notifications')}>
          Manage <ChevronRight size={14} />
        </Button>}>
        <div className="flex flex-wrap gap-2">
          <Chip tone="success">In-app on</Chip>
          <Chip tone="success">Email on</Chip>
          <Chip tone="success">WhatsApp on</Chip>
          <Chip tone="neutral">SMS off</Chip>
        </div>
        <p className="text-[13px] text-ink-muted mt-4 leading-relaxed">
          {variant === 'trade'
            ? 'Statutory communications — tax invoices, EMD forfeiture notices and dispute updates — are always delivered regardless of these settings.'
            : 'Anything addressed to you by name — an escalation, a signature request, a handover note — is always delivered regardless of these settings.'}
        </p>
      </Panel>

      <Panel icon={<LifeBuoy size={17} />} title="Legal & support"
        desc="The terms you work under, and how to raise an issue." flush>
        {links.map((l) => (
          <Row key={l.to + l.label} icon={l.icon} label={l.label} desc={l.desc}
            control={<ChevronRight size={16} className="text-ink-muted" />}
            onClick={() => nav(l.to)} />
        ))}
      </Panel>
    </>
  )
}

/* --------------------------------- helpers --------------------------------- */

/** A labelled group of selectable pills — used by half the role sections for
    categories, regions, districts and approval kinds. */
export function PillGroup<T extends string>({ options, value, onChange, render }: {
  options: readonly T[]; value: T[]; onChange: (v: T[]) => void; render?: (v: T) => React.ReactNode
}) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" role="checkbox" aria-checked={value.includes(o)}
          onClick={() => toggle(o)}
          className={cx('h-9 px-3.5 rounded-full border text-[13px] font-semibold transition-colors', focusRing,
            value.includes(o)
              ? cx(A.soft, A.text, 'border-[var(--accent)]/35')
              : 'bg-surface text-ink-muted border-line hover:border-line-strong hover:text-ink')}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  )
}

export { Label }
