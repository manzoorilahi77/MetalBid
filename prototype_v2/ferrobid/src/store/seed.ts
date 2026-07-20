/* ---------------------------------------------------------------------------
   Seed loader — reads src/data/mock/*.json (the source of truth) and rebases
   every timestamp so the anchor instant maps to "now". Live catalogues are
   therefore genuinely live on every reload.
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
import autoBidsJson from '../data/mock/autoBids.json'
import inspectionSlotsJson from '../data/mock/inspectionSlots.json'
import bankAccountsJson from '../data/mock/bankAccounts.json'
import depositClaimsJson from '../data/mock/depositClaims.json'
import withdrawalRequestsJson from '../data/mock/withdrawalRequests.json'
import companyBankAccountsJson from '../data/mock/companyBankAccounts.json'
import type {
  Announcement, AppNotification, AuditEvent, AutoBidSetting, BankAccount, Bid,
  BuyerLotSelection, Catalogue, CompanyBankAccount, DemandDraft, DeliveryOrder, DepositClaim,
  Dispute, InspectionReport, InspectionSlot, Lot, TermsSet, User, Wallet, WithdrawalRequest,
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
  autoBids: AutoBidSetting[]
  inspectionSlots: InspectionSlot[]
  bankAccounts: BankAccount[]
  depositClaims: DepositClaim[]
  withdrawalRequests: WithdrawalRequest[]
  companyBankAccounts: CompanyBankAccount[]
}

export function loadSeed(): SeedData {
  return {
    catalogues: deepShift(cataloguesJson) as unknown as Catalogue[],
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
    autoBids: autoBidsJson as unknown as AutoBidSetting[],
    inspectionSlots: deepShift(inspectionSlotsJson) as unknown as InspectionSlot[],
    bankAccounts: deepShift(bankAccountsJson) as unknown as BankAccount[],
    depositClaims: deepShift(depositClaimsJson) as unknown as DepositClaim[],
    withdrawalRequests: deepShift(withdrawalRequestsJson) as unknown as WithdrawalRequest[],
    companyBankAccounts: companyBankAccountsJson as unknown as CompanyBankAccount[],
  }
}
