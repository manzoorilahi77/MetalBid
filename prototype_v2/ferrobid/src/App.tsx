import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Chrome, { Page, SubNav } from './layout/Chrome'
import ScrollToTop from './layout/ScrollToTop'
import type { Role } from './types'
import { ToastHost } from './components/ui'
import { BidroomGateProvider } from './components/BidroomGate'
import { GuestGateProvider, GuestRouteGuard } from './components/GuestGate'
import {
  RequireAuth, RequireRole,
  ADMIN_ROLES, AUCTION_CONTROL_ROLES, CEO_ROLES, EXEC_ROLES, FINANCE_ROLES, FIELD_ROLES,
} from './components/RequireRole'
import { useBuyerData } from './api/useBuyerData'
import { useSellerData } from './api/useSellerData'
import { useFieldData } from './api/useFieldData'
import { useExecData } from './api/useExecData'
import { useAuctionData } from './api/useAuctionData'
import { useFinanceData } from './api/useFinanceData'
import { useSubAdminData, useSuperAdminData, useCeoData } from './api/useAdminData'
import { useTick } from './lib/useTick'
import { subNavFrom, useStore, visiblePages } from './store/store'

/* public + shared */
import Login from './pages/Login'
import Browse from './pages/Browse'
import AuctionDetail from './pages/AuctionDetail'
import BiddingRoom from './pages/BiddingRoom'
import Noticeboard from './pages/Noticeboard'
import Help from './pages/Help'
import Legal from './pages/Legal'
import CmsOverview from './pages/cms/Overview'
import CmsSections from './pages/cms/Sections'
import CmsBlocks from './pages/cms/Blocks'
import Disputes from './pages/Disputes'
import NotificationPrefs from './pages/NotificationPrefs'
import Profile from './pages/Profile'

/* buyer */
import BuyerDashboard from './pages/buyer/Dashboard'
import BuyerMarketplace from './pages/buyer/Marketplace'
import Shortlist from './pages/buyer/Shortlist'
import ShortlistCatalogue from './pages/buyer/ShortlistCatalogue'
import BidNowAuctions from './pages/buyer/BidNowAuctions'
import BidNowLots from './pages/buyer/BidNowLots'
import BuyerBids from './pages/buyer/Bids'
import AuctionStatus from './pages/buyer/AuctionStatus'
import Wallet from './pages/buyer/Wallet'
import BecomeSeller from './pages/buyer/BecomeSeller'

/* seller */
import SellerWorkspace from './pages/seller/Workspace'
import CreateLot from './pages/seller/CreateLot'
import MyLots from './pages/seller/MyLots'
import LiveMonitor from './pages/seller/LiveMonitor'
import SellerReports from './pages/seller/Reports'
import SellerSettlement from './pages/seller/Settlement'

/* field executive */
import FieldQueue from './pages/field/Queue'
import FieldCatalogueDetail from './pages/field/CatalogueDetail'
import FieldLotDetail from './pages/field/LotDetail'
import InspectLot from './pages/field/InspectLot'

/* executive manager */
import Pipeline from './pages/exec/Pipeline'
import LotApproval from './pages/exec/LotApproval'
import CatalogueBuilder from './pages/exec/CatalogueBuilder'
import Settlement from './pages/exec/Settlement'
import Logistics from './pages/exec/Logistics'
import Handover from './pages/exec/Handover'

/* auction manager */
import AuctionDashboard from './pages/auction/Dashboard'
import AuctionSchedule from './pages/auction/Schedule'
import EmdEligibility from './pages/auction/EmdEligibility'
import LiveAuctions from './pages/auction/LiveAuctions'
import BiddingRooms from './pages/auction/BiddingRooms'
import BiddingRoomOperator from './pages/auction/BiddingRoomOperator'
import AuctionBidMonitor from './pages/auction/BidMonitor'
import AuctionAnnouncements from './pages/auction/Announcements'
import AuctionResults from './pages/auction/Results'
import AuctionHistory from './pages/auction/History'
import AuctionReports from './pages/auction/Reports'

/* finance administrator */
import { ReadOnlyBanner } from './pages/finance/shared'
import FinanceDashboard from './pages/finance/Dashboard'
import ProfitLoss from './pages/finance/ProfitLoss'
import FinanceDeposits from './pages/finance/Deposits'
import FinancePayments from './pages/finance/Payments'
import FinanceCommission from './pages/finance/Commission'
import EmdLedger from './pages/finance/EmdLedger'
import FinanceBankAccounts from './pages/finance/BankAccounts'
import FinanceWithdrawals from './pages/finance/Withdrawals'
import FinanceRefunds from './pages/finance/Refunds'
import FinanceInvoices from './pages/finance/Invoices'
import FinanceReconciliation from './pages/finance/Reconciliation'
import FinanceReports from './pages/finance/Reports'

/* CEO / MD */
import CeoDashboard from './pages/ceo/Dashboard'
import CeoProfitLoss from './pages/ceo/ProfitLoss'
import CeoGrowth from './pages/ceo/Growth'
import CeoAuctionPerformance from './pages/ceo/AuctionPerformance'
import CeoRisk from './pages/ceo/Risk'
import CeoIssues from './pages/ceo/Issues'
import CeoApprovals from './pages/ceo/Approvals'
import CeoDelegate from './pages/ceo/Delegate'
import CeoReports from './pages/ceo/Reports'

/* sub-admin — head of operations. Only the screens no other role owns live
   here; the pipeline, the auction floor and the accounts screen are the other
   roles' own routes, worked by this one as well. */
import OpsConsole from './pages/sub/OpsConsole'
import WorkQueue from './pages/sub/WorkQueue'
import SubApprovals from './pages/sub/Approvals'
import SellerVerification from './pages/sub/SellerVerification'
import FieldExecutives from './pages/sub/FieldExecutives'
import BidMonitor from './pages/sub/BidMonitor'
import PaymentActivity from './pages/sub/PaymentActivity'
import SubDisputes from './pages/sub/Disputes'
import ContentManagement from './pages/sub/Content'
import SubReports from './pages/sub/Reports'
import MyActivity from './pages/sub/MyActivity'

/* super admin — structure → people → settings → exceptions → the record */
import AdminDashboard from './pages/admin/Dashboard'
import Roles from './pages/admin/Roles'
import PageManager from './pages/admin/PageManager'
import SubAdmins from './pages/admin/SubAdmins'
import Users from './pages/admin/Users'
import Finance from './pages/admin/Finance'
import MasterData from './pages/admin/MasterData'
import ContentPublishing from './pages/admin/Content'
import Blacklist from './pages/admin/Blacklist'
import ControlTower from './pages/admin/ControlTower'
import ChangeHistory from './pages/admin/ChangeHistory'
import Audit from './pages/admin/Audit'

/* contextual module nav per area — tabs under the header, never a sidebar */
/** Derives a role's sub-nav tabs from the same page registry the top nav
 *  renders, so the two surfaces can't drift out of sync — and so a tab renamed,
 *  reordered or hidden in the Super Admin's Page manager moves both at once. */
function useSubNavItems(role: Role) {
  const pages = useStore((s) => s.pageRegistry)
  /* For a role with categories this strip is scoped to the one we are inside,
     so the top bar picks the category and this picks the page within it. */
  const { pathname } = useLocation()
  return subNavFrom(pages, role, pathname)
}

/** Browse and Noticeboard are shared pages that live outside every role's own
 *  route group, so the contextual sub-nav used to disappear the moment a
 *  signed-in user stepped into them. Whenever the active role links to the
 *  current page from its top nav, re-render that role's sub-nav here so the
 *  tab strip stays put across all of its top-level destinations. */
function SharedLayout() {
  const role = useStore((s) => s.role)
  const pages = useStore((s) => s.pageRegistry)
  const { pathname } = useLocation()
  const items = useSubNavItems(role)
  const fromTopNav = visiblePages(pages, role).some((p) => p.inTop && p.to === pathname)
  return (
    <>
      {items.length > 0 && fromTopNav && <SubNav items={items} />}
      <Outlet />
    </>
  )
}

/** Catalogue detail is reached from every role's own area (dashboard rails,
 *  browse grids, notifications) but — like Browse/Noticeboard — lives outside
 *  every role's route group, so the contextual sub-nav used to disappear the
 *  moment a signed-in user drilled into a catalogue. Unlike SharedLayout, this
 *  isn't itself a role's top-nav destination, so it shows the active role's
 *  sub-nav unconditionally rather than gating on a top-nav pathname match. */
function CatalogueDetailLayout() {
  const role = useStore((s) => s.role)
  const items = useSubNavItems(role)
  return (
    <>
      {items.length > 0 && <SubNav items={items} />}
      <Outlet />
    </>
  )
}

/** A workspace several roles hold between them.
 *
 *  The lot pipeline, lot approval, the catalogue builder, the auction schedule,
 *  EMD eligibility, the live floor and the accounts screen are each **one**
 *  screen worked by more than one role — the Operation Manager and the Sub
 *  Admin share the pipeline, the Auction Manager and the Sub Admin share the
 *  floor, the Sub Admin and the Super Admin share accounts — rather than a copy
 *  per role, so whoever acts is simply named in the audit entry.
 *
 *  Which means the tab strip cannot belong to the route. When the viewer's own
 *  menu links to where they are, they keep their own strip; only a visitor with
 *  no claim on the page falls back to the role that owns it. */
/** Shown when a role's API fetch failed. The store starts empty and only the
 *  server fills it, so a failed fetch means blank screens — say why, rather than
 *  letting an empty database read as a quiet marketplace. */
function OfflineNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4">
      <div className="card p-3 text-xs text-ink-muted border-warning/40 bg-warning-soft/10">
        Server not connected — nothing to show. {message}
      </div>
    </div>
  )
}

function WorkspaceChrome({ owner, notice }: { owner: Role; notice?: string | null }) {
  const role = useStore((s) => s.role)
  const pages = useStore((s) => s.pageRegistry)
  const { pathname } = useLocation()
  const theirs = visiblePages(pages, role).some((p) => p.to === pathname)
  return (
    <>
      <SubNav items={useSubNavItems(theirs ? role : owner)} />
      {notice && <OfflineNotice message={notice} />}
      <Outlet />
    </>
  )
}

/* Each workspace role has its own layout rather than sharing one, because a
   hook cannot be called conditionally: one shared layout could not fetch a
   different role's data depending on which owner it was rendered for. They all
   render the same WorkspaceChrome, so the nav behaviour is still shared. */
function ExecLayout() {
  const { error } = useExecData()
  return <WorkspaceChrome owner="exec_manager" notice={error} />
}

/* Auction Manager. */
function AuctionLayout() {
  const { error } = useAuctionData()
  return <WorkspaceChrome owner="auction_manager" notice={error} />
}

/* Sub Admin's cross-role workspace, and Super Admin. */
function SubAdminWorkspaceLayout() {
  const { error } = useSubAdminData()
  return <WorkspaceChrome owner="sub_admin" notice={error} />
}

function SuperAdminLayout() {
  const { error } = useSuperAdminData()
  return <WorkspaceChrome owner="super_admin" notice={error} />
}

/* Field executive. Its four routes had no layout of their own; this adds one so
   the queue fetch happens once rather than per page. */
function FieldLayout() {
  const { error } = useFieldData()
  return (
    <>
      {error && <OfflineNotice message={error} />}
      <Outlet />
    </>
  )
}

function FinanceLayout() {
  const { error } = useFinanceData()
  return (
    <>
      <SubNav items={useSubNavItems('finance_admin')} />
      {error && <OfflineNotice message={error} />}
      {/* Other roles can read the books — that is the point of the Sub Admin and
          CEO views — but only Finance can move money. Saying so once here beats
          each page discovering it button by button. */}
      <ReadOnlyBanner />
      <Outlet />
    </>
  )
}

function CeoLayout() {
  const { error } = useCeoData()
  return (
    <>
      <SubNav items={useSubNavItems('ceo')} />
      {error && <OfflineNotice message={error} />}
      <Outlet />
    </>
  )
}

function SubAdminLayout() {
  const { error } = useSubAdminData()
  /* WorkspaceChrome, not a hardcoded 'sub_admin' strip: these three screens are
     worked by more than one role, and the comment on the route block promises
     "an Ops Manager who opens one keeps their own tab strip". Naming the role
     directly broke that promise — it handed every visitor the Sub Admin's
     tabs. */
  return <WorkspaceChrome owner="sub_admin" notice={error} />
}

/* Financial config is an admin screen the Finance Administrator may READ — the
   rates they have to charge, the accounts they pay into — which is why it is
   on their menu. It cannot live in the Sub Admin block: that block's fetch is
   /api/sub, which the server refuses them (verified: 403). Everything this page
   renders — financeConfig, companyBankAccounts, withdrawalWindow, ceoApprovals
   — is already in /api/finance, and every role allowed on this route may call
   it, so one fetch serves all four. Write access is a separate question,
   answered inside the page by SUB_ADMIN_ROLES. */
function FinanceConfigLayout() {
  const { error } = useFinanceData()
  return <WorkspaceChrome owner="sub_admin" notice={error} />
}

/** The buyer's area — and the guest tour that runs through the front of it.
 *
 *  A visitor who came in through "Browse as Guest" is on `/buyermarketplace`,
 *  which is a buyer route, but they must not be handed the buyer's tab strip:
 *  every tab on it would be a dead end for somebody with no account. They get
 *  their own strip instead (see NAV_BY_ROLE.guest_buyer) — the same tabs, with
 *  the ones that need an account locked behind the subscription prompt. */
function BuyerLayout() {
  const role = useStore((s) => s.role)
  /* Loads the signed-in buyer's wallet, shortlists, bids and orders from the API
     into the store. Mounted on the layout so every buyer route is covered by one
     fetch, and refetched when the signed-in buyer changes. */
  const { error } = useBuyerData()
  return (
    <>
      <SubNav items={useSubNavItems(role === 'guest_buyer' ? 'guest_buyer' : 'buyer')} />
      {error && <OfflineNotice message={error} />}
      <Outlet />
    </>
  )
}

function SellerLayout() {
  /* Loads this seller's lots, bids, inspection reports and settlements from the
     API into the store. Mounted on the layout so one fetch covers every seller
     route, and refetches when the signed-in seller changes. */
  const { error } = useSellerData()
  return (
    <>
      <SubNav items={useSubNavItems('seller')} />
      {error && <OfflineNotice message={error} />}
      <Outlet />
    </>
  )
}

function NotFound() {
  return (
    <Page className="text-center py-24">
      <div className="font-display text-7xl font-bold text-ember">404</div>
      <p className="text-ink-muted mt-2">That page doesn't exist. Try the <a className="text-steel font-semibold" href="#/browse">auction browser</a>.</p>
    </Page>
  )
}

function Engine() {
  useTick()
  return null
}

export default function App() {
  // subscribing here keeps the theme class in sync on toggle
  useStore((s) => s.theme)
  return (
    /* `useTransitions={false}` is load-bearing, not a tuning knob. React Router 7
       wraps every location update in `startTransition`, so a handler that does
       `logout(); nav(...)` splits into two renders: the store update commits at
       sync priority with the OLD location still in place, and the route guard —
       now seeing a signed-out viewer on a staff-only path — fires its own
       `/login?from=…` redirect before the sign-out's navigation ever lands. Sync
       location updates put both in one render, so the guard never sees the
       in-between state. Safe here because no route in this app is lazy, so
       nothing suspends on navigation. */
    <HashRouter useTransitions={false}>
      <Engine />
      {/* Must sit inside the router — it reads useLocation(). Without it nothing
          resets the offset on navigation and a link clicked from a page footer
          lands you at the bottom of the next page. */}
      <ScrollToTop />
      <ToastHost />
      {/* Owns "Browse as Guest": the read-only tour of the buyer's marketplace,
          and the one subscription prompt every locked surface funnels into. */}
      <GuestGateProvider>
      {/* Backstop behind the locked tabs — a hand-typed URL lands here too. */}
      <GuestRouteGuard />
      {/* Owns the one gate into any bidding room, so every trigger in every
          page runs the same pending-EMD → terms → navigate sequence. */}
      <BidroomGateProvider>
      <Routes>
        <Route element={<Chrome />}>
          {/* `/` never reaches this router — Guest1Gate rewrites it to `/home`
              and hands it to the public site, which is the real homepage. This
              redirect is a backstop for the case where that ever fails, so the
              app opens somewhere useful rather than on a 404. The manager's own
              second homepage (pages/Home.tsx) is no longer routed: nobody could
              reach it, and it was already being edited by mistake. It stays on
              disk only until its two store-backed features — the testimonials
              submit/moderate flow and the live announcements feed — are moved
              onto the real homepage, which is where they were always meant to
              be seen. */}
          <Route index element={<Navigate to="/browse" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/bidding/:catalogueId" element={<BiddingRoom />} />
          <Route path="/help" element={<Help />} />
          <Route path="/legal" element={<Legal />} />

          {/* Deep links into the two legal/help pages above, selecting a tab.
              Same components, not copies.

              Pricing, About, Contact, Blog, Knowledge and Grievance were also
              declared here, each rendering CmsPage. They were unreachable: the
              footer and every other link point at the public site's own
              versions under #/home/*, so the CMS was publishing into pages no
              visitor could open. Those guest1 pages now read the same section
              registry (see their useCmsPage calls), which is where the content
              was always meant to land. */}
          <Route path="/legal/privacy" element={<Legal tab="privacy" />} />
          <Route path="/legal/terms" element={<Legal tab="terms" />} />
          <Route path="/help/faqs" element={<Help focus="faqs" />} />

          {/* Pages every account holds, and no visitor does. These sat outside
              every layout and so outside every check: signed out, they rendered
              a profile with nobody in it. */}
          <Route element={<RequireAuth />}>
            <Route path="/disputes" element={<Disputes />} />
            <Route path="/settings/notifications" element={<NotificationPrefs />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* shared pages that keep the active role's sub-nav (Browse, Noticeboard) */}
          <Route element={<SharedLayout />}>
            <Route path="/browse" element={<Browse />} />
            <Route path="/noticeboard" element={<Noticeboard />} />
          </Route>

          <Route element={<CatalogueDetailLayout />}>
            <Route path="/catalogue/:id" element={<AuctionDetail />} />
          </Route>

          {/* `guest_buyer` is admitted because the guest tour runs through the
              front of this block; which pages of it they may see is
              GuestRouteGuard's job, above. */}
          <Route element={<RequireRole allow={['buyer', 'guest_buyer']} />}>
            <Route element={<BuyerLayout />}>
              <Route path="/buyer" element={<BuyerDashboard />} />
              <Route path="/buyermarketplace" element={<BuyerMarketplace />} />
              {/* One screen, one path. Every deep link in the app already used
                  `/buyer/shortlist`; only the menu used the long spelling, and
                  `activeMatch` existed purely to paper over the split. The old
                  path redirects rather than 404s so anything bookmarked still
                  lands. */}
              <Route path="/buyer/shortlist" element={<Shortlist />} />
              <Route path="/buyer/emd-shortlisted-catalogue" element={<Navigate to="/buyer/shortlist" replace />} />
              <Route path="/buyer/shortlist/:catalogueId" element={<ShortlistCatalogue />} />
              <Route path="/buyer/bid-now" element={<BidNowAuctions />} />
              <Route path="/buyer/bid-now/:catalogueId" element={<BidNowLots />} />
              <Route path="/buyer/bids" element={<BuyerBids />} />
              <Route path="/buyer/auction-status" element={<AuctionStatus />} />
              <Route path="/buyer/wallet" element={<Wallet />} />
              <Route path="/buyer/kyc" element={<BecomeSeller />} />
            </Route>
          </Route>

          <Route element={<RequireRole allow={['seller']} />}>
            <Route element={<SellerLayout />}>
              <Route path="/seller" element={<SellerWorkspace />} />
              {/* Same KYC wizard as /buyer/kyc — a seller who registered directly
                  still has to be verified, and had no route to it before. */}
              <Route path="/seller/verification" element={<BecomeSeller />} />
              <Route path="/seller/create-lot" element={<CreateLot />} />
              <Route path="/seller/lots" element={<MyLots />} />
              <Route path="/seller/monitor" element={<LiveMonitor />} />
              <Route path="/seller/reports" element={<SellerReports />} />
              <Route path="/seller/settlement" element={<SellerSettlement />} />
            </Route>
          </Route>

          <Route element={<RequireRole allow={FIELD_ROLES} />}>
            <Route element={<FieldLayout />}>
              <Route path="/field" element={<FieldQueue />} />
              <Route path="/field/catalogue/:catalogueId" element={<FieldCatalogueDetail />} />
              <Route path="/field/lot/:lotId" element={<FieldLotDetail />} />
              <Route path="/field/inspect/:lotId" element={<InspectLot />} />
            </Route>
          </Route>

          <Route element={<RequireRole allow={EXEC_ROLES} />}>
            <Route element={<ExecLayout />}>
              <Route path="/exec" element={<Pipeline />} />
              <Route path="/exec/approvals" element={<LotApproval />} />
              <Route path="/exec/catalogue-builder" element={<CatalogueBuilder />} />
              <Route path="/exec/settlement" element={<Settlement />} />
              <Route path="/exec/logistics" element={<Logistics />} />
              <Route path="/exec/handover" element={<Handover />} />
            </Route>
          </Route>

          <Route element={<RequireRole allow={AUCTION_CONTROL_ROLES} />}>
            <Route element={<AuctionLayout />}>
              <Route path="/auction" element={<AuctionDashboard />} />
              <Route path="/auction/schedule" element={<AuctionSchedule />} />
              <Route path="/auction/emd-eligibility" element={<EmdEligibility />} />
              <Route path="/auction/live" element={<LiveAuctions />} />
              <Route path="/auction/rooms" element={<BiddingRooms />} />
              <Route path="/auction/rooms/:catalogueId" element={<BiddingRoomOperator />} />
              <Route path="/auction/bid-monitor" element={<AuctionBidMonitor />} />
              <Route path="/auction/announcements" element={<AuctionAnnouncements />} />
              <Route path="/auction/results" element={<AuctionResults />} />
              <Route path="/auction/history" element={<AuctionHistory />} />
              <Route path="/auction/reports" element={<AuctionReports />} />
            </Route>
          </Route>

          {/* Finance — money in → held → out → records, in that order */}
          <Route element={<RequireRole allow={FINANCE_ROLES} />}>
            <Route element={<FinanceLayout />}>
              <Route path="/finance" element={<FinanceDashboard />} />
              <Route path="/finance/pnl" element={<ProfitLoss />} />
              <Route path="/finance/deposits" element={<FinanceDeposits />} />
              <Route path="/finance/payments" element={<FinancePayments />} />
              <Route path="/finance/commission" element={<FinanceCommission />} />
              <Route path="/finance/emd" element={<EmdLedger />} />
              <Route path="/finance/bank-accounts" element={<FinanceBankAccounts />} />
              <Route path="/finance/withdrawals" element={<FinanceWithdrawals />} />
              <Route path="/finance/refunds" element={<FinanceRefunds />} />
              <Route path="/finance/invoices" element={<FinanceInvoices />} />
              <Route path="/finance/reconciliation" element={<FinanceReconciliation />} />
              <Route path="/finance/reports" element={<FinanceReports />} />
            </Route>
          </Route>

          {/* CEO — are we making money · are we growing · is anything at risk ·
              what needs me. The dashboard is the summary layer over the other
              seven screens; only the approvals screen has buttons. */}
          <Route element={<RequireRole allow={CEO_ROLES} />}>
            <Route element={<CeoLayout />}>
              <Route path="/ceo" element={<CeoDashboard />} />
              <Route path="/ceo/pnl" element={<CeoProfitLoss />} />
              <Route path="/ceo/growth" element={<CeoGrowth />} />
              <Route path="/ceo/auctions" element={<CeoAuctionPerformance />} />
              <Route path="/ceo/risk" element={<CeoRisk />} />
              <Route path="/ceo/issues" element={<CeoIssues />} />
              <Route path="/ceo/approvals" element={<CeoApprovals />} />
              <Route path="/ceo/delegate" element={<CeoDelegate />} />
              <Route path="/ceo/reports" element={<CeoReports />} />
            </Route>
          </Route>

          {/* Sub Admin — head of operations, in the order of the roles they
              oversee: their own desk, the pre-auction pipeline, the sale, what
              they watch rather than execute, then accounts and admin. The
              pipeline and floor screens are not repeated here — this role works
              the Operation Manager's and the Auction Manager's own routes. */}
          <Route element={<RequireRole allow={ADMIN_ROLES} />}>
            <Route element={<SubAdminWorkspaceLayout />}>
              <Route path="/sub" element={<OpsConsole />} />
              <Route path="/sub/queue" element={<WorkQueue />} />
              <Route path="/sub/approvals" element={<SubApprovals />} />
              <Route path="/sub/bid-monitor" element={<BidMonitor />} />
              <Route path="/sub/payments" element={<PaymentActivity />} />
              <Route path="/sub/content" element={<ContentManagement />} />

              {/* ------------------------------ CMS ------------------------------
                  One category, the same screens on both admin menus. The Sub
                  Admin's copy is the real one — the company's CMS — and the Super
                  Admin's is a mirror we hold for recovery. Nothing here routes to
                  the Super Admin for approval.

                  Thirteen nav entries, three components: the page editor is
                  generic and the page key comes from the URL, so adding a page is
                  a row in the section registry rather than a file. */}
              <Route path="/cms" element={<CmsOverview />} />
              <Route path="/cms/sections" element={<CmsSections />} />
              <Route path="/cms/page/:pageKey" element={<CmsBlocks />} />
              <Route path="/sub/reports" element={<SubReports />} />
              <Route path="/sub/activity" element={<MyActivity />} />

              {/* -------------------------- Settings & configuration --------------------------
                  Company business configuration — rates, reference data, tab
                  labels, who is barred, and the undo behind all of it. The Sub
                  Admin runs these day to day; Super Admin's copy is the same
                  mirror-for-recovery pattern the CMS already uses above, so
                  both nav entries point at the same route. `User accounts` was
                  always meant to work this way (see the old comment this
                  replaced) — it just sat under the Super-Admin-only layout,
                  where a Sub Admin's fetch 403'd and the page silently rode on
                  whatever the store already had cached from `/sub`. */}
              <Route path="/admin/users" element={<Users />} />
              <Route path="/admin/master-data" element={<MasterData />} />
              <Route path="/admin/pages" element={<PageManager />} />
              <Route path="/admin/blacklist" element={<Blacklist />} />
              <Route path="/admin/change-history" element={<ChangeHistory />} />
            </Route>
          </Route>

          {/* Three screens the Operation Manager works alongside the Sub Admin:
              seller verification, the field-executive board and the support
              desk. Each is one screen, not a copy per role — an Ops Manager who
              opens one keeps their own tab strip. */}
          {/* Financial config — read by Finance, written by the admins. Its own
              block because it is the one /admin/* screen a non-admin may open,
              and it needs a fetch the Sub Admin block cannot give it. */}
          <Route element={<RequireRole allow={FINANCE_ROLES} />}>
            <Route element={<FinanceConfigLayout />}>
              <Route path="/admin/finance" element={<Finance />} />
            </Route>
          </Route>

          {/* ADMIN_ROLES, not EXEC_ROLES: these three screens are served by
              /api/sub, which the server grants to the two admin roles only
              (verified — an Operation Manager gets 403). Admitting them here
              would open a page that could never load. Giving Ops a real way in
              means widening the server first; see the note in nav.ts. */}
          <Route element={<RequireRole allow={ADMIN_ROLES} />}>
            <Route element={<SubAdminLayout />}>
              <Route path="/sub/seller-verification" element={<SellerVerification />} />
              <Route path="/sub/field-executives" element={<FieldExecutives />} />
              <Route path="/sub/disputes" element={<SubDisputes />} />
            </Route>
          </Route>

          {/* Super Admin — our developer break-glass role, kept for recovery
              and structural work the company never touches: defining what
              roles exist, provisioning other admin accounts, the emergency
              override, and the untouchable audit trail. Everything the
              company runs day to day — CMS, Financial config, Master data,
              Page manager, Blacklist, Change history, User accounts — lives
              on the Sub Admin's own routes above; a Super Admin reaches the
              same screens through the identical nav entries in their menu. */}
          <Route element={<RequireRole allow={['super_admin']} />}>
            <Route element={<SuperAdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/roles" element={<Roles />} />
              <Route path="/admin/sub-admins" element={<SubAdmins />} />
              <Route path="/admin/content" element={<ContentPublishing />} />
              <Route path="/admin/control-tower" element={<ControlTower />} />
              <Route path="/admin/audit" element={<Audit />} />
              {/* the old route, kept so bookmarks and older links still land */}
              <Route path="/admin/team" element={<Roles />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </BidroomGateProvider>
      </GuestGateProvider>
    </HashRouter>
  )
}
