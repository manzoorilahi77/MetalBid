/* ---------------------------------------------------------------------------
   Application layer — a seller submitting a new lot. Moved verbatim from
   sellerSlice.ts's createLot; no rule or wording changed. See
   opsInspection.ts for the pattern.
--------------------------------------------------------------------------- */
import { uid, num } from '../lib/format'
import type { Lot, User } from '../types'
import type { NotificationPlan } from './opsInspection'

export interface CreateLotContext {
  currentUser: User | null
  now: number
}

export interface CreateLotPlan {
  lot: Lot
  audit: { action: string; target: string; detail: string }
  opsNotification: NotificationPlan
  sellerNotification: NotificationPlan & { userId: string }
}

export type CreateLotResult =
  | { ok: true; plan: CreateLotPlan }
  | { ok: false; error: string }

export function planCreateLot(partial: Partial<Lot>, ctx: CreateLotContext): CreateLotResult {
  const me = ctx.currentUser
  /* The verification gate is only a gate if it stops something. A seller
     whose KYC has not been approved may not put material in front of
     buyers — the decision belongs to Operations, not to the seller. */
  if (!me) return { ok: false, error: 'Sign in as a seller to submit a lot' }
  if (me.role === 'seller' && !me.sellerVerified && me.kycStatus !== 'verified') {
    return {
      ok: false,
      error: me.kycStatus === 'pending'
        ? 'Your seller verification is still with our team. You can submit lots as soon as it is approved.'
        : me.kycStatus === 'rejected'
          ? 'Your seller verification was not approved. Resubmit your details, or appeal to the Operation Manager.'
          : 'Complete seller verification before submitting a lot.',
    }
  }

  const id = uid('lot')
  const lot: Lot = {
    id, lotNo: `UNL-${id.slice(-4).toUpperCase()}`, catalogueId: null as unknown as string,
    sellerId: me.id,
    metal: 'MS', category: 'scrap', grade: '', indicativeQty: 0, uom: 'MT',
    yard: '', description: '', startRate: 0, increment: 100, reserveRate: 0,
    preBidEmd: 10000, saleBasis: 'as-is-where-is', hazardous: false,
    photos: [{ id: `${id}-p0`, label: 'Overview', hue: 24 }],
    inspectionReportId: null, status: 'pending_inspection',
    currentRate: null, leadingBidderId: null, bidCount: 0,
    endsAt: new Date(ctx.now + 30 * 86400_000).toISOString(), extensions: 0, resultH1Rate: null,
    knownSeller: false, inspectionWaived: false, waivedBy: null, waivedReason: null, waivedAt: null,
    ...partial,
  }

  return {
    ok: true,
    plan: {
      lot,
      audit: { action: 'lot.create', target: lot.lotNo, detail: `${me.firm} submitted ${lot.grade || lot.metal} for inspection` },
      /* A submitted lot is work for Operations — it has to be taken into the
         pipeline and assembled into a catalogue before any inspector can
         ever see it, so it cannot be left to be noticed. */
      opsNotification: {
        kind: 'system', title: `New lot from ${me.firm}`,
        body: `${lot.grade || lot.metal} · ${num(lot.indicativeQty)} ${lot.uom} at ${lot.yard || 'a yard'} — take it into the pipeline and assign an inspection.`,
        href: '/exec',
      },
      sellerNotification: {
        userId: me.id, kind: 'system', title: `${lot.lotNo} submitted`,
        body: 'Operations will assemble it into a catalogue and book a yard inspection. It stays private until then.',
        href: '/seller/lots',
      },
    },
  }
}
