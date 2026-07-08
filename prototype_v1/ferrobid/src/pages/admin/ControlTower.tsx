import { useState } from 'react';
import {
  Radio, PauseCircle, PlayCircle, TimerReset, Ban, Gavel, Users, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, Btn, Modal, Field, inputCls, Empty, LotImage } from '../../components/ui';
import { inr, timeLeft, clockTime, cx } from '../../utils';

type Pending =
  | { kind: 'pause' | 'cancel'; auctionId: string }
  | { kind: 'extend'; auctionId: string }
  | { kind: 'void'; bidId: string; label: string };

/** Super Admin live-auction override centre (WBS v3.1 F43). Every action needs a reason → audit. */
export default function ControlTower() {
  const { auctions, lots, bids, now, pauseAuction, resumeAuction, extendAuction, cancelAuction, voidBid } = useApp();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [mins, setMins] = useState(10);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = auctions
    .filter((a) => a.status === 'live' || a.status === 'paused' || a.status === 'scheduled')
    .sort((a, b) => (a.status === 'live' ? -1 : 1) - (b.status === 'live' ? -1 : 1) || a.endsAt - b.endsAt);

  const confirm = () => {
    if (!pending || !reason.trim()) return;
    if (pending.kind === 'pause') pauseAuction(pending.auctionId, reason);
    if (pending.kind === 'cancel') cancelAuction(pending.auctionId, reason);
    if (pending.kind === 'extend') extendAuction(pending.auctionId, mins, reason);
    if (pending.kind === 'void') voidBid(pending.bidId, reason);
    setPending(null);
    setReason('');
  };

  const modalTitle = pending?.kind === 'pause' ? 'Pause auction' : pending?.kind === 'cancel' ? 'Cancel auction'
    : pending?.kind === 'extend' ? 'Force-extend auction' : 'Void bid';

  return (
    <div>
      <SectionTitle
        title="Auction Control Tower"
        sub="Emergency overrides on money-in-motion — every action requires a reason and lands in the audit trail"
        right={<Badge tone="tone-ember"><Radio size={12} /> {auctions.filter((a) => a.status === 'live').length} live now</Badge>}
      />
      {rows.length === 0 && <Empty title="Nothing live or scheduled" sub="Live, paused and scheduled auctions appear here with override controls." />}

      <div className="space-y-3">
        {rows.map((a) => {
          const lot = lots.find((l) => l.id === a.lotId)!;
          const abids = bids.filter((b) => b.auctionId === a.id).slice(-6).reverse();
          const open = expanded === a.id;
          return (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <LotImage hues={lot.imageHues} label={lot.metal} className="h-12 w-18 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-faint">{a.id} · {lot.id} · {lot.location}</div>
                  <div className="text-sm font-bold text-ink">{lot.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-faint">
                    <span>Highest <b className="text-ink">{inr(a.currentBid)}</b>{a.leaderName && <> · {a.leaderName}</>}</span>
                    <span className="flex items-center gap-1"><Users size={11} /> {a.bidderCount}</span>
                    <span>{a.extensions} extensions</span>
                  </div>
                </div>
                {a.status === 'live' && <Badge tone="tone-ember"><Radio size={11} /> {timeLeft(a.endsAt, now)}</Badge>}
                {a.status === 'paused' && <Badge tone="bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25"><PauseCircle size={11} /> Paused · {timeLeft(now + (a.pausedRemaining ?? 0), now)} left</Badge>}
                {a.status === 'scheduled' && <Badge tone="bg-indigo-50 dark:bg-indigo-400/10 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-400/25">Scheduled</Badge>}

                <div className="flex flex-wrap items-center gap-1.5">
                  {a.status === 'live' && (
                    <>
                      <Btn size="sm" variant="outline" onClick={() => setPending({ kind: 'pause', auctionId: a.id })}><PauseCircle size={13} /> Pause</Btn>
                      <Btn size="sm" variant="outline" onClick={() => { setMins(10); setPending({ kind: 'extend', auctionId: a.id }); }}><TimerReset size={13} /> Extend</Btn>
                    </>
                  )}
                  {a.status === 'paused' && (
                    <Btn size="sm" variant="success" onClick={() => resumeAuction(a.id)}><PlayCircle size={13} /> Resume</Btn>
                  )}
                  <Btn size="sm" variant="danger" onClick={() => setPending({ kind: 'cancel', auctionId: a.id })}><Ban size={13} /> Cancel</Btn>
                  {abids.length > 0 && (
                    <Btn size="sm" variant="ghost" onClick={() => setExpanded(open ? null : a.id)}>
                      <Gavel size={13} /> Bids {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </Btn>
                  )}
                </div>
              </div>

              {a.pauseReason && (
                <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-400/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-400/25">
                  <b>Pause reason:</b> {a.pauseReason}
                </div>
              )}

              {open && (
                <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {abids.map((b, i) => (
                    <div key={b.id} className={cx('flex items-center gap-3 rounded-lg border px-3 py-2', i === 0 ? 'border-ember-200 dark:border-ember-400/25 bg-ember-50/50 dark:bg-ember-400/10' : 'border-line bg-surface')}>
                      <span className="w-14 shrink-0 text-[11px] font-semibold text-faint">{clockTime(b.at)}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{b.bidderName}</span>
                      <span className="text-[13px] font-extrabold text-ink">{inr(b.amount)}</span>
                      {i === 0 && <Badge tone="tone-ember">Highest</Badge>}
                      <button
                        title="Void this bid (reason required)"
                        onClick={() => setPending({ kind: 'void', bidId: b.id, label: `${b.bidderName} — ${inr(b.amount)}` })}
                        className="rounded-lg p-1.5 text-faint hover:bg-red-50 dark:hover:bg-red-400/10 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <p className="pt-1 text-[11px] text-faint">Voiding removes the bid and recalculates the highest — the bidder is notified (mock).</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={!!pending} onClose={() => { setPending(null); setReason(''); }} title={modalTitle}>
        <div className="space-y-4">
          {pending?.kind === 'void' && <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold text-ink">{pending.label}</div>}
          {pending?.kind === 'extend' && (
            <Field label="Extend by">
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 30].map((m) => (
                  <button key={m} onClick={() => setMins(m)}
                    className={cx('rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer', mins === m ? 'border-steel-600 bg-steel-500/10 text-steel-800 dark:text-steel-200' : 'border-line text-muted hover:bg-surface-2')}>
                    +{m} min
                  </button>
                ))}
              </div>
            </Field>
          )}
          {pending?.kind === 'cancel' && (
            <p className="text-xs text-muted">Scheduled auctions return their lot to the approved pool; live auctions close the lot and auto-refund EMDs (mock).</p>
          )}
          <Field label="Reason (mandatory — written to the audit trail)">
            <textarea className={inputCls} rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={pending?.kind === 'void' ? 'e.g. Confirmed shill-bid pattern from linked accounts.' : 'e.g. Seller reported a listing error in the lot description.'} />
          </Field>
          <Btn variant={pending?.kind === 'cancel' || pending?.kind === 'void' ? 'danger' : 'accent'} className="w-full" disabled={!reason.trim()} onClick={confirm}>
            Confirm {modalTitle.toLowerCase()}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
