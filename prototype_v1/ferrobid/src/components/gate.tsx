import type { ReactNode } from 'react';
import { Lock, ShieldQuestion, Hourglass, Eye } from 'lucide-react';
import { useApp } from '../store';
import { DEMO_SUB_ADMIN_ID, atLeast, overCeiling, LEVEL_LABEL } from '../permissions';
import type { ApprovalType, ExecFunction, ModulePermission } from '../types';
import { Btn, Badge } from './ui';
import { cx, inrCompact } from '../utils';

export interface Gate {
  /** true when the current persona is the scoped Sub-Admin */
  scopedRole: boolean;
  perm?: ModulePermission;
  canView: boolean;
  canAct: boolean;
  canApprove: boolean;
}

/** Resolve the current persona's rights on an ops module. Exec & Super Admin pass through unrestricted. */
export function useGate(module: string): Gate {
  const { role, admins } = useApp();
  if (role !== 'subadmin') {
    return { scopedRole: false, canView: true, canAct: true, canApprove: role === 'exec' || role === 'superadmin' };
  }
  const perm = admins.find((a) => a.id === DEMO_SUB_ADMIN_ID)?.scoped?.[module];
  return {
    scopedRole: true,
    perm,
    canView: atLeast(perm, 'view'),
    canAct: atLeast(perm, 'act'),
    canApprove: atLeast(perm, 'approve'),
  };
}

/**
 * Permission-aware action button (WBS v3.1 F14/F42).
 * - Exec / Super Admin → behaves like a normal Btn.
 * - Sub-Admin `view` level → disabled with a lock.
 * - Sub-Admin `act` level → runs directly, EXCEPT when the action is risky or over the ₹ ceiling,
 *   in which case it turns into a "Send for approval" maker request.
 */
export function GatedBtn({
  module, risky, value, approval, onAllowed, children,
  variant = 'primary', size = 'sm', className, disabled,
}: {
  module: string;
  risky?: boolean;
  value?: number;
  approval?: { type: ApprovalType; title: string; detail: string; refId: string; payload?: Record<string, unknown> };
  onAllowed: () => void;
  children: ReactNode;
  variant?: 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}) {
  const gate = useGate(module);
  const { approvals, requestApproval } = useApp();

  if (!gate.scopedRole || gate.canApprove) {
    return <Btn variant={variant} size={size} className={className} disabled={disabled} onClick={onAllowed}>{children}</Btn>;
  }

  if (!gate.canAct) {
    return (
      <span title="View only — a Super Admin can raise your permission level for this module">
        <Btn variant="outline" size={size} className={className} disabled>
          <Lock size={12} /> {children}
        </Btn>
      </span>
    );
  }

  const needsApproval = (risky || overCeiling(gate.perm, value)) && !!approval;
  if (!needsApproval) {
    return <Btn variant={variant} size={size} className={className} disabled={disabled} onClick={onAllowed}>{children}</Btn>;
  }

  const pending = approvals.some((a) => a.status === 'pending' && a.type === approval!.type && a.refId === approval!.refId);
  if (pending) {
    return (
      <span title="Awaiting Executive/Super Admin decision">
        <Btn variant="outline" size={size} className={className} disabled>
          <Hourglass size={12} /> Awaiting approval
        </Btn>
      </span>
    );
  }
  const why = risky ? 'This action is maker-checker protected' : `Above your ₹ ceiling (${inrCompact(gate.perm!.ceiling)})`;
  return (
    <span title={`${why} — sends a request to Executive/Super Admin`}>
      <Btn variant="outline" size={size} disabled={disabled}
        className={cx('!border-amber-300 dark:!border-amber-400/40 !text-amber-700 dark:!text-amber-300 hover:!bg-amber-50 dark:hover:!bg-amber-400/10', className)}
        onClick={() => requestApproval({ ...approval!, amount: value })}
      >
        <ShieldQuestion size={13} /> Send for approval
      </Btn>
    </span>
  );
}

/** Badge summarising the Sub-Admin's grant on the current module — shown in page headers. */
export function ScopeBadge({ module }: { module: string }) {
  const gate = useGate(module);
  if (!gate.scopedRole || !gate.perm) return null;
  const p = gate.perm;
  const bits = [LEVEL_LABEL[p.level], p.metals !== 'All' && p.metals, p.region !== 'All' && p.region, p.ceiling > 0 && `≤ ${inrCompact(p.ceiling)}`].filter(Boolean);
  return (
    <Badge tone="tone-violet" className="whitespace-nowrap">
      {p.level === 'view' ? <Eye size={11} /> : <ShieldQuestion size={11} />} Your access: {bits.join(' · ')}
    </Badge>
  );
}

/** Route wrapper: hides an inherited module page entirely when the grant is `hidden`. */
export function ModuleGate({ module, label, children }: { module: string; label: string; children: ReactNode }) {
  const gate = useGate(module);
  if (gate.scopedRole && !gate.canView) return <LockedPanel label={label} />;
  return <>{children}</>;
}

/** Full-page lock for modules granted no access. */
export function LockedPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface-2 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-line text-faint"><Lock size={20} /></div>
      <div className="text-sm font-bold text-muted">Permission required</div>
      <p className="max-w-sm text-xs text-faint">
        Your Sub-Admin account doesn't have access to <b>{label}</b>.
        A Super Admin can grant it from <b>Admins &amp; Permissions</b> — gating is visual (demo RBAC).
      </p>
    </div>
  );
}

/** Route wrapper: separates Field Executive Officer (lot inspection) from Executive Manager (KYC/settlement/logistics/handover). */
export function ExecFunctionGate({ allow, label, children }: { allow: ExecFunction[]; label: string; children: ReactNode }) {
  const { role, execFunction } = useApp();
  if (role === 'exec' && !allow.includes(execFunction)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface-2 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-line text-faint"><Lock size={20} /></div>
        <div className="text-sm font-bold text-muted">Not part of your role</div>
        <p className="max-w-sm text-xs text-faint">
          <b>{label}</b> belongs to the {allow.includes('field') ? 'Field Executive Officer' : 'Executive Manager'} console.
          Switch personas from the header to see it.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
