/* ---------------------------------------------------------------------------
   Notification preferences — per-event toggles grouped by area, plus
   delivery channels. Local state only (demo); Save fires a toast.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Gavel, CalendarClock, Wallet, Send } from 'lucide-react'
import { Page } from '../layout/Chrome'
import { PageHeader, Button, Toggle, Select, Field } from '../components/ui'
import { useStore } from '../store/store'

type PrefKey =
  | 'outbid' | 'results' | 'autobidExhausted'
  | 'catalogueLive' | 'closingSoon' | 'followedCategories'
  | 'topups' | 'emdMoves'
  | 'chInApp' | 'chEmail' | 'chSms' | 'chWhatsapp'

const DEFAULTS: Record<PrefKey, boolean> = {
  outbid: true, results: true, autobidExhausted: true,
  catalogueLive: true, closingSoon: true, followedCategories: false,
  topups: true, emdMoves: true,
  chInApp: true, chEmail: true, chSms: false, chWhatsapp: true,
}

function PrefRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div>
        <div className="text-sm font-semibold text-ink">{label}</div>
        <div className="text-xs text-ink-muted mt-0.5">{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-line bg-surface-2/60">
        <span className="text-ember">{icon}</span>
        <h2 className="font-display font-bold text-sm">{title}</h2>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  )
}

export default function NotificationPrefs() {
  const pushToast = useStore((s) => s.pushToast)
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULTS)
  const [leadTime, setLeadTime] = useState('30')

  const setPref = (k: PrefKey) => (v: boolean) => setPrefs((p) => ({ ...p, [k]: v }))

  const save = () => {
    pushToast({
      kind: 'success',
      title: 'Preferences saved',
      body: 'Your notification settings have been updated (demo).',
    })
  }

  return (
    <Page>
      <PageHeader
        title="Notification preferences"
        sub="Choose which auction events reach you and on which channels. Critical account and payment alerts are always delivered."
        actions={<Button onClick={save}>Save preferences</Button>}
      />

      <div className="grid lg:grid-cols-2 gap-4 max-w-5xl">
        <SectionCard icon={<Gavel size={16} />} title="Bidding">
          <PrefRow
            label="Outbid alerts"
            desc="Instant alert the moment a rival takes H1 on a lot you are leading."
            checked={prefs.outbid} onChange={setPref('outbid')}
          />
          <PrefRow
            label="Win / loss results"
            desc="Lot-wise result when a catalogue closes — sold, STA or unsold."
            checked={prefs.results} onChange={setPref('results')}
          />
          <PrefRow
            label="Auto-bid exhausted"
            desc="Warns you when bidding crosses your proxy ceiling so you can raise it."
            checked={prefs.autobidExhausted} onChange={setPref('autobidExhausted')}
          />
        </SectionCard>

        <SectionCard icon={<CalendarClock size={16} />} title="Auctions">
          <PrefRow
            label="Catalogue goes live"
            desc="When a catalogue you shortlisted from opens for bidding."
            checked={prefs.catalogueLive} onChange={setPref('catalogueLive')}
          />
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="flex-1">
              <div className="text-sm font-semibold text-ink">Closing-soon reminder</div>
              <div className="text-xs text-ink-muted mt-0.5">A nudge before lots you shortlisted start closing.</div>
              {prefs.closingSoon && (
                <Field label="Lead time" className="mt-3 max-w-40">
                  <Select value={leadTime} onChange={(e) => setLeadTime(e.target.value)}>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">60 minutes</option>
                  </Select>
                </Field>
              )}
            </div>
            <Toggle checked={prefs.closingSoon} onChange={setPref('closingSoon')} />
          </div>
          <PrefRow
            label="New catalogue in followed categories"
            desc="When a fresh catalogue is published in metal categories you follow."
            checked={prefs.followedCategories} onChange={setPref('followedCategories')}
          />
        </SectionCard>

        <SectionCard icon={<Wallet size={16} />} title="Wallet & EMD">
          <PrefRow
            label="Top-up confirmations"
            desc="Receipt with UTR reference every time money lands in your wallet."
            checked={prefs.topups} onChange={setPref('topups')}
          />
          <PrefRow
            label="EMD lock & release"
            desc="Lot-wise alerts when pre-bid EMD is locked or auto-released after close."
            checked={prefs.emdMoves} onChange={setPref('emdMoves')}
          />
        </SectionCard>

        <SectionCard icon={<Send size={16} />} title="Channels">
          <PrefRow
            label="In-app"
            desc="Notification bell inside ferroBid — recommended to keep on."
            checked={prefs.chInApp} onChange={setPref('chInApp')}
          />
          <PrefRow
            label="Email"
            desc="Detailed summaries, invoices and delivery-order documents."
            checked={prefs.chEmail} onChange={setPref('chEmail')}
          />
          <PrefRow
            label="SMS"
            desc="Short text alerts for outbids and closing reminders."
            checked={prefs.chSms} onChange={setPref('chSms')}
          />
          <PrefRow
            label="WhatsApp"
            desc="Rich alerts with lot photos and one-tap links to the bidding console."
            checked={prefs.chWhatsapp} onChange={setPref('chWhatsapp')}
          />
        </SectionCard>
      </div>

      <p className="text-xs text-ink-faint mt-6 max-w-5xl">
        Statutory communications — tax invoices, EMD forfeiture notices and dispute updates — are always sent
        regardless of these settings.
      </p>
    </Page>
  )
}
