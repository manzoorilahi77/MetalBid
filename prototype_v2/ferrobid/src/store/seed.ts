/* ---------------------------------------------------------------------------
   Seed loader — reads src/data/mock/*.json (the source of truth) and rebases
   every timestamp so the anchor instant maps to "now". Live catalogues are
   therefore genuinely live on every reload.

   In the browser this returns EMPTY collections: the database is the only
   source of data, so a page with no server behind it shows nothing rather than
   fixtures pretending to be live. The full local seed still loads for the Node
   scripts (dump-store.ts, verify-persistence.ts) — they are what produce the
   database's contents in the first place — and can be forced in the browser
   with VITE_LOCAL_SEED=1 for offline UI work.
--------------------------------------------------------------------------- */
import anchorJson from '../data/mock/anchor.json'
import cataloguesJson from '../data/mock/catalogues.json'
import lotsJson from '../data/mock/lots.json'
import usersJson from '../data/mock/users.json'
import bidsJson from '../data/mock/bids.json'
import walletsJson from '../data/mock/wallets.json'
import inspectionReportsJson from '../data/mock/inspectionReports.json'
import notificationsJson from '../data/mock/notifications.json'
import termsSetsJson from '../data/mock/termsSets.json'
import deliveryOrdersJson from '../data/mock/deliveryOrders.json'
import demandDraftsJson from '../data/mock/demandDrafts.json'
import announcementsJson from '../data/mock/announcements.json'
import disputesJson from '../data/mock/disputes.json'
import auditEventsJson from '../data/mock/auditEvents.json'
import selectionsJson from '../data/mock/selections.json'
import watchlistJson from '../data/mock/watchlist.json'
import autoBidsJson from '../data/mock/autoBids.json'
import inspectionSlotsJson from '../data/mock/inspectionSlots.json'
import bankAccountsJson from '../data/mock/bankAccounts.json'
import depositClaimsJson from '../data/mock/depositClaims.json'
import withdrawalRequestsJson from '../data/mock/withdrawalRequests.json'
import companyBankAccountsJson from '../data/mock/companyBankAccounts.json'
import { defaultEmdDeadline } from '../lib/emd'
import type {
  Announcement, AppNotification, AuditEvent, AutoBidSetting, BankAccount, Bid,
  BuyerLotSelection, Catalogue, CompanyBankAccount, DemandDraft, DeliveryOrder, DepositClaim,
  Dispute, InspectionReport, InspectionSlot, Lot, TermsSet, User, Wallet, WatchlistEntry, WithdrawalRequest,
} from '../types'

const delta = Date.now() - Date.parse((anchorJson as { anchor: string }).anchor)
const shift = (iso: string): string => new Date(Date.parse(iso) + delta).toISOString()

const deepShift = <T>(value: T): T => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return shift(value) as unknown as T
  }
  if (Array.isArray(value)) return value.map(deepShift) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = deepShift(v)
    return out as T
  }
  return value
}

/* Vite defines import.meta.env; Node (tsx running the dump/verify scripts)
   does not — which is exactly the split we want. The optional chain mirrors
   api/client.ts, which runs under both for the same reason. */
export const SEEDED_LOCALLY: boolean =
  typeof import.meta.env === 'undefined' || import.meta.env?.VITE_LOCAL_SEED === '1'

export interface SeedData {
  catalogues: Catalogue[]
  lots: Lot[]
  users: User[]
  bids: Bid[]
  wallets: Wallet[]
  inspectionReports: InspectionReport[]
  notifications: AppNotification[]
  termsSets: TermsSet[]
  deliveryOrders: DeliveryOrder[]
  demandDrafts: DemandDraft[]
  announcements: Announcement[]
  disputes: Dispute[]
  auditEvents: AuditEvent[]
  selections: BuyerLotSelection[]
  watchlist: WatchlistEntry[]
  autoBids: AutoBidSetting[]
  inspectionSlots: InspectionSlot[]
  bankAccounts: BankAccount[]
  depositClaims: DepositClaim[]
  withdrawalRequests: WithdrawalRequest[]
  companyBankAccounts: CompanyBankAccount[]
}

export function loadSeed(): SeedData {
  if (!SEEDED_LOCALLY) {
    return {
      catalogues: [], lots: [], users: [], bids: [], wallets: [],
      inspectionReports: [], notifications: [], termsSets: [], deliveryOrders: [],
      demandDrafts: [], announcements: [], disputes: [], auditEvents: [],
      selections: [], watchlist: [], autoBids: [], inspectionSlots: [],
      bankAccounts: [], depositClaims: [], withdrawalRequests: [], companyBankAccounts: [],
    }
  }
  return {
    // `emdDeadline` was added after the first mock runs — backfill it from
    // startsAt so an older/hand-edited catalogues.json still loads.
    catalogues: (deepShift(cataloguesJson) as unknown as Catalogue[]).map((c) => ({
      ...c,
      emdDeadline: c.emdDeadline ?? defaultEmdDeadline(c.startsAt),
    })),
    lots: deepShift(lotsJson) as unknown as Lot[],
    users: deepShift(usersJson) as unknown as User[],
    bids: deepShift(bidsJson) as unknown as Bid[],
    wallets: deepShift(walletsJson) as unknown as Wallet[],
    inspectionReports: deepShift(inspectionReportsJson) as unknown as InspectionReport[],
    notifications: deepShift(notificationsJson) as unknown as AppNotification[],
    termsSets: termsSetsJson as unknown as TermsSet[],
    deliveryOrders: deepShift(deliveryOrdersJson) as unknown as DeliveryOrder[],
    demandDrafts: deepShift(demandDraftsJson) as unknown as DemandDraft[],
    announcements: deepShift(announcementsJson) as unknown as Announcement[],
    disputes: deepShift(disputesJson) as unknown as Dispute[],
    auditEvents: deepShift(auditEventsJson) as unknown as AuditEvent[],
    selections: selectionsJson as unknown as BuyerLotSelection[],
    watchlist: watchlistJson as unknown as WatchlistEntry[],
    autoBids: autoBidsJson as unknown as AutoBidSetting[],
    inspectionSlots: deepShift(inspectionSlotsJson) as unknown as InspectionSlot[],
    bankAccounts: deepShift(bankAccountsJson) as unknown as BankAccount[],
    depositClaims: deepShift(depositClaimsJson) as unknown as DepositClaim[],
    withdrawalRequests: deepShift(withdrawalRequestsJson) as unknown as WithdrawalRequest[],
    companyBankAccounts: companyBankAccountsJson as unknown as CompanyBankAccount[],
  }
}
