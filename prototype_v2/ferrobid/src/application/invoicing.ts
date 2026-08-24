/* ---------------------------------------------------------------------------
   Application layer — the Finance-desk invoice/receipt lifecycle: issue,
   reissue (supersede), and cancel. Moved verbatim from financeSlice.ts; no
   rule, threshold, or wording changed. See opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { uid, inr } from '../lib/format'
import { FINANCE_ROLES } from '../store/constants'
import type { Invoice, Role, User } from '../types'
import type { NotificationPlan } from './opsInspection'

/* --------------------------------- issueInvoice -------------------------------- */

export interface IssueInvoiceInput {
  kind: 'buyer_invoice' | 'commission_receipt'
  partyId: string
  catalogueId: string
  lotId?: string
  doId?: string
  taxable: number
  gst: number
  tcs: number
  note?: string
}

export interface IssueInvoiceContext {
  role: Role
  invoiceCount: number
  actorId: string | undefined
  party: User | undefined
  now: number
}

export interface IssueInvoicePlan {
  record: Invoice
  audit: { action: string; target: string; detail: string }
  notification: NotificationPlan & { userId: string }
}

export function planIssueInvoice(input: IssueInvoiceInput, ctx: IssueInvoiceContext): IssueInvoicePlan | null {
  if (!FINANCE_ROLES.includes(ctx.role)) return null
  const seq = 1001 + ctx.invoiceCount
  const record: Invoice = {
    id: uid('inv'),
    number: `FB/${input.kind === 'buyer_invoice' ? 'INV' : 'RCP'}/26/${seq}`,
    kind: input.kind, partyId: input.partyId, catalogueId: input.catalogueId, lotId: input.lotId, doId: input.doId,
    issuedAt: new Date(ctx.now).toISOString(),
    issuedBy: ctx.actorId ?? 'system',
    taxable: input.taxable, gst: input.gst, tcs: input.tcs, total: input.taxable + input.gst + input.tcs,
    status: 'issued', note: input.note,
  }
  return {
    record,
    audit: { action: 'invoice.issue', target: record.number, detail: `${input.kind === 'buyer_invoice' ? 'Buyer invoice' : 'Commission receipt'} for ${inr(record.total)} issued to ${ctx.party?.firm ?? input.partyId}` },
    notification: {
      userId: input.partyId, kind: 'system',
      title: input.kind === 'buyer_invoice' ? 'Invoice issued' : 'Commission receipt issued',
      body: `${record.number} — ${inr(record.total)}.`,
      href: input.kind === 'buyer_invoice' ? '/buyer/auction-status' : '/seller/settlement',
    },
  }
}

/* -------------------------------- reissueInvoice -------------------------------- */

export interface ReissueInvoiceContext {
  role: Role
  original: Invoice | undefined
  actorId: string | undefined
  now: number
}

export interface ReissueInvoicePlan {
  replacement: Invoice
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  // This notification has no `href` in the original — kept exactly as-is.
  notification: { userId: string; kind: 'system'; title: string; body: string }
}

export function planReissueInvoice(note: string, ctx: ReissueInvoiceContext): ReissueInvoicePlan | null {
  if (!FINANCE_ROLES.includes(ctx.role)) return null
  const original = ctx.original
  if (!original || original.status !== 'issued') return null
  const replacement: Invoice = {
    ...original,
    id: uid('inv'),
    number: `${original.number}-R`,
    issuedAt: new Date(ctx.now).toISOString(),
    issuedBy: ctx.actorId ?? 'system',
    status: 'issued',
    supersedesId: original.id,
    note,
  }
  return {
    // Superseded, not overwritten — the original stays on the record.
    replacement,
    audit: { action: 'invoice.reissue', target: replacement.number, detail: `Replaces ${original.number} — ${note}`, severity: 'warning' },
    notification: { userId: original.partyId, kind: 'system', title: 'Document reissued', body: `${replacement.number} replaces ${original.number}. ${note}` },
  }
}

/* --------------------------------- cancelInvoice -------------------------------- */

export interface CancelInvoiceContext {
  role: Role
  original: Invoice | undefined
}

export interface CancelInvoicePlan {
  audit: { action: string; target: string; detail: string; severity: 'warning' }
  notification: NotificationPlan & { userId: string }
}

export function planCancelInvoice(note: string, ctx: CancelInvoiceContext): CancelInvoicePlan | null {
  if (!FINANCE_ROLES.includes(ctx.role)) return null
  const original = ctx.original
  if (!original || original.status === 'cancelled') return null
  return {
    audit: { action: 'invoice.cancel', target: original.number, detail: `Cancelled — ${note}`, severity: 'warning' },
    // A tax document the customer is holding has stopped being valid.
    notification: { userId: original.partyId, kind: 'wallet', title: `Invoice ${original.number} cancelled`, body: `${note} A corrected document follows if one is due.`, href: '/buyer/auction-status' },
  }
}
