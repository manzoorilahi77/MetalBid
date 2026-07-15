import { FileCheck2, FileX2, UserCheck2, Download } from 'lucide-react';
import type { Lot } from '../types';
import { Card, Badge } from './ui';

/** Buyer-facing verification summary — checklist pass/fail + inspector, never the internal notes. */
export function VerificationEvidence({
  verification, canSeeNotes,
}: {
  verification: Lot['verification'];
  canSeeNotes: boolean;
}) {
  if (!verification) return null;
  const entries = Object.entries(verification.checklist ?? {});
  const passCount = entries.filter(([, ok]) => ok).length;

  return (
    <Card className="mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-ink">
          <UserCheck2 size={14} className="text-steel-600 dark:text-steel-300" />
          Verification evidence
        </div>
        {entries.length > 0 && (
          <Badge tone={passCount === entries.length ? 'tone-emerald' : 'tone-amber'}>{passCount}/{entries.length} checks passed</Badge>
        )}
      </div>
      <div className="mt-2 text-xs text-muted">Inspected by <b className="text-ink">{verification.submittedBy ?? '—'}</b>{verification.decidedBy && verification.managerDecision === 'approved' && <> · approved by <b className="text-ink">{verification.decidedBy}</b></>}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button disabled={!verification.reportUploaded} className="flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-[11px] font-semibold text-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-surface-3">
          {verification.reportUploaded ? <FileCheck2 size={13} className="text-emerald-600 dark:text-emerald-400" /> : <FileX2 size={13} />}
          Report {verification.reportUploaded && <Download size={11} />}
        </button>
        <button disabled={!verification.photosUploaded} className="flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-[11px] font-semibold text-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-surface-3">
          {verification.photosUploaded ? <FileCheck2 size={13} className="text-emerald-600 dark:text-emerald-400" /> : <FileX2 size={13} />}
          Photos {verification.photosUploaded && <Download size={11} />}
        </button>
      </div>
      {canSeeNotes && verification.note && (
        <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-[11px] text-muted"><b className="text-ink">Inspector note:</b> {verification.note}</div>
      )}
    </Card>
  );
}
