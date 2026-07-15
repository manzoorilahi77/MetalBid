import type { ReactNode } from 'react';
import { Trophy, FileSignature, CheckCircle2, XCircle, Send, Truck, Rotate3d, Wallet } from 'lucide-react';
import type { EmailLog, Role } from '../types';
import { Card, Badge, Empty } from './ui';

const TYPE_META: Record<EmailLog['type'], { icon: ReactNode; label: string; tone: string }> = {
  auction_won: { icon: <Trophy size={13} />, label: 'Auction won', tone: 'tone-emerald' },
  al_sent: { icon: <Send size={13} />, label: 'Approval Letter sent', tone: 'tone-amber' },
  al_approved: { icon: <CheckCircle2 size={13} />, label: 'Approval Letter approved', tone: 'tone-emerald' },
  al_rejected: { icon: <XCircle size={13} />, label: 'Approval Letter rejected', tone: 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-400/25' },
  escalation_offer: { icon: <FileSignature size={13} />, label: 'Escalation offer', tone: 'tone-violet' },
  dl_sent: { icon: <Send size={13} />, label: 'Delivery Letter sent', tone: 'tone-sky' },
  delivered: { icon: <Truck size={13} />, label: 'Delivered', tone: 'tone-emerald' },
  re_auction: { icon: <Rotate3d size={13} />, label: 'Re-auctioned', tone: 'tone-amber' },
  emd_refunded: { icon: <Wallet size={13} />, label: 'EMD refunded', tone: 'tone-slate' },
};

/** Notification/audit trail for a lot's settlement journey. `viewerRole` filters to "your notifications" for seller/buyer. */
export function EmailTimeline({
  logs, viewerRole, compact, limit,
}: {
  logs: EmailLog[];
  viewerRole?: Role;
  compact?: boolean;
  limit?: number;
}) {
  const visible = (viewerRole === 'seller' || viewerRole === 'buyer')
    ? logs.filter((l) => l.recipientRole === viewerRole)
    : logs;
  const rows = (limit ? visible.slice(0, limit) : visible);

  if (rows.length === 0) return compact ? null : <Empty title="No notifications yet" sub="State-changing actions on this lot will appear here." />;

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {rows.map((log) => {
        const meta = TYPE_META[log.type];
        return compact ? (
          <div key={log.id} className="flex items-center gap-2 text-xs">
            <span className="text-faint">{meta.icon}</span>
            <span className="min-w-0 flex-1 truncate text-muted">{log.subject}</span>
            <span className="shrink-0 text-[10px] text-faint">{log.sentAt}</span>
          </div>
        ) : (
          <Card key={log.id} className="flex items-center gap-3 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">{meta.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-ink">{log.subject}</div>
              <div className="text-[10px] text-faint">{log.sentAt}</div>
            </div>
            <Badge tone={meta.tone} className="capitalize">{log.recipientRole}</Badge>
          </Card>
        );
      })}
    </div>
  );
}
