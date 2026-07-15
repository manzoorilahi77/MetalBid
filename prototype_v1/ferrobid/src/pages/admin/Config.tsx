import { ShieldAlert, FileCheck2 } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Toggle, Field, inputCls, Badge } from '../../components/ui';

const RISK_NUM_LABEL: Record<string, string> = {
  autoSuspendAfterDefaults: 'Auto-suspend after N payment defaults',
  sameIpThreshold: 'Flag same-IP cluster at N+ distinct bidders',
};

const KYC_POLICY_LABEL: Record<string, string> = {
  requireGSTForBusiness: 'GST certificate required (business bidders)',
  requireITR: 'ITR (latest year) required for every buyer',
  requirePCB: 'Pollution Control Board certificate required for every buyer',
};

const NUM_LABEL: Record<string, string> = {
  auctionAutoExtensionWindowSec: 'Auto-extension trigger window (seconds before close)',
  auctionAutoExtensionBySec: 'Auto-extension duration (seconds added)',
  defaultEmdPercent: 'Default EMD (% of reserve)',
  maxAutoExtensions: 'Max auto-extensions per auction',
  walletTopupLimit: 'Wallet top-up limit (₹)',
  sessionTimeoutMin: 'Session timeout before re-auth required (minutes)',
};
const POLICY_LABEL: Record<string, string> = {
  requireGST: 'GST certificate required',
  requirePAN: 'Business PAN required',
  requireBankProof: 'Bank proof (cancelled cheque) required',
  requireMSME: 'MSME / Udyam certificate required',
};
const NOTIF_LABEL: Record<string, string> = {
  onEntityVerified: 'Entity verified', onLotVerified: 'Lot verified', onAuctionCreated: 'Auction created',
  onWon: 'Auction won', onSettled: 'Settlement completed', onPickupScheduled: 'Pickup scheduled', onHandover: 'Handover complete',
};

export default function Config() {
  const { config, updateConfig } = useApp();

  return (
    <div>
      <SectionTitle title="System Configuration" sub="Platform parameters, entity-verification policy and notification rules (all mock)" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-ink">Auction & wallet parameters</h3>
          <p className="mb-4 text-[11px] text-faint">The bidding engine reads these values live — try shrinking the extension window.</p>
          <div className="space-y-3">
            {Object.entries(config.platform).map(([k, v]) => (
              <Field key={k} label={NUM_LABEL[k] ?? k}>
                <input
                  className={inputCls} value={String(v)}
                  onChange={(e) => updateConfig('platform', k, Number(e.target.value.replace(/[^\d]/g, '') || 0))}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-ink">Entity verification policy</h3>
          <p className="mb-4 text-[11px] text-faint">Documents required to unlock the Seller capability.</p>
          <div className="space-y-3">
            {Object.entries(config.entityVerificationPolicy).filter(([, v]) => typeof v === 'boolean').map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted">{POLICY_LABEL[k] ?? k}</span>
                <Toggle on={v as boolean} onChange={() => updateConfig('entityVerificationPolicy', k, !v)} />
              </div>
            ))}
            <div className="rounded-xl bg-surface-2 px-3.5 py-3 text-xs text-muted ring-1 ring-line">
              Review SLA: <b className="text-ink">{config.entityVerificationPolicy.reviewSLA}</b> ·
              Auto-return after <b className="text-ink">{config.entityVerificationPolicy.autoReturnAfterDays} days</b> of inactivity
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-ink">Lifecycle notifications</h3>
          <p className="mb-4 text-[11px] text-faint">Fire a notification on each hand-off.</p>
          <div className="space-y-3">
            {Object.entries(config.notifications).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted">{NOTIF_LABEL[k] ?? k}</span>
                <Toggle on={v as boolean} onChange={() => updateConfig('notifications', k, !v)} />
              </div>
            ))}
          </div>
          <Badge tone="bg-surface-3 text-muted ring-line-strong" className="mt-4">Changes apply in-session only (prototype)</Badge>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink"><FileCheck2 size={15} className="text-steel-500" /> Buyer KYC document policy</h3>
          <p className="mb-4 text-[11px] text-faint">PAN, Aadhar, photo, address proof & cancelled cheque are always required. These are conditional.</p>
          <div className="space-y-3">
            {Object.entries(config.kycPolicy).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted">{KYC_POLICY_LABEL[k] ?? k}</span>
                <Toggle on={v as boolean} onChange={() => updateConfig('kycPolicy', k, !v)} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink"><ShieldAlert size={15} className="text-red-500" /> Risk & fraud controls</h3>
          <p className="mb-4 text-[11px] text-faint">Auto-suspension and same-IP collusion detection thresholds — read live by Bid Monitor.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted">Auto-suspend enabled</span>
              <Toggle on={config.risk.autoSuspendEnabled} onChange={() => updateConfig('risk', 'autoSuspendEnabled', !config.risk.autoSuspendEnabled)} />
            </div>
            {(['autoSuspendAfterDefaults', 'sameIpThreshold'] as const).map((k) => (
              <Field key={k} label={RISK_NUM_LABEL[k]}>
                <input
                  type="number" min={2} className={inputCls} value={config.risk[k]}
                  onChange={(e) => updateConfig('risk', k, Number(e.target.value.replace(/[^\d]/g, '') || 2))}
                />
              </Field>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
