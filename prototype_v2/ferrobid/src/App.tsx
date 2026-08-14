import { lazy, Suspense } from 'react'
import { HashRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Chrome, { Page, SubNav } from './layout/Chrome'
import ScrollToTop from './layout/ScrollToTop'
import type { Role } from './types'
import { ToastHost } from './components/ui'
import { BidroomGateProvider } from './components/BidroomGate'
import { useTick } from './lib/useTick'
import { subNavFrom, useStore, visiblePages } from './store/store'

/* public + shared */
import Home from './pages/Home'
import Login from './pages/Login'
import Browse from './pages/Browse'
import AuctionDetail from './pages/AuctionDetail'
import BiddingRoom from './pages/BiddingRoom'
import Noticeboard from './pages/Noticeboard'
import Help from './pages/Help'
import Legal from './pages/Legal'
import Disputes from './pages/Disputes'
import NotificationPrefs from './pages/NotificationPrefs'
import Profile from './pages/Profile'

/* guest 2 — redesigned public site (code-split from the authenticated app;
   Phase 9). Each page loads on demand behind the Guest2Layout Suspense. */
const Guest2Home = lazy(() => import('./pages/guest2/Home'))
const Guest2SolutionsBuyers = lazy(() => import('./pages/guest2/SolutionsBuyers'))
const Guest2SolutionsSellers = lazy(() => import('./pages/guest2/SolutionsSellers'))
const Guest2HowItWorks = lazy(() => import('./pages/guest2/HowItWorks'))
const Guest2Contact = lazy(() => import('./pages/guest2/Contact'))
const Guest2ExitIntent = lazy(() => import('./pages/guest2/ExitIntentWhatsApp'))

/* Master switch for the exit-intent WhatsApp invite. Off for now — the modal
   and all its logic stay intact; flip this to `true` to bring it back. */
const SHOW_WHATSAPP_MODAL = false

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
import AuctionSetup from './pages/exec/AuctionSetup'
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
  return subNavFrom(pages, role)
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
function SharedWorkspaceLayout({ owner }: { owner: Role }) {
  const role = useStore((s) => s.role)
  const pages = useStore((s) => s.pageRegistry)
  const { pathname } = useLocation()
  const theirs = visiblePages(pages, role).some((p) => p.to === pathname)
  return (
    <>
      <SubNav items={useSubNavItems(theirs ? role : owner)} />
      <Outlet />
    </>
  )
}

function FinanceLayout() {
  return (
    <>
      <SubNav items={useSubNavItems('finance_admin')} />
      {/* Other roles can read the books — that is the point of the Sub Admin and
          CEO views — but only Finance can move money. Saying so once here beats
          each page discovering it button by button. */}
      <ReadOnlyBanner />
      <Outlet />
    </>
  )
}

function CeoLayout() {
  return (
    <>
      <SubNav items={useSubNavItems('ceo')} />
      <Outlet />
    </>
  )
}

function SubAdminLayout() {
  return (
    <>
      <SubNav items={useSubNavItems('sub_admin')} />
      <Outlet />
    </>
  )
}

function BuyerLayout() {
  return (
    <>
      <SubNav items={useSubNavItems('buyer')} />
      <Outlet />
    </>
  )
}

function SellerLayout() {
  return (
    <>
      <SubNav items={useSubNavItems('seller')} />
      <Outlet />
    </>
  )
}

/** Guest 2 public site — shared chrome like every other role. A lean top nav
 *  (no sub-nav) drives the few marketing pages; this layout is the Suspense
 *  boundary for the lazy pages and the single mount point for the exit-intent
 *  WhatsApp community invite (so it can fire from any Guest 2 page, once). */
function Guest2Layout() {
  return (
    <Suspense fallback={<Page className="py-24 text-center text-ink-faint">Loading…</Page>}>
      <Outlet />
      {SHOW_WHATSAPP_MODAL && <Guest2ExitIntent />}
    </Suspense>
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
    <HashRouter>
      <Engine />
      {/* Must sit inside the router — it reads useLocation(). Without it nothing
          resets the offset on navigation and a link clicked from a page footer
          lands you at the bottom of the next page. */}
      <ScrollToTop />
      <ToastHost />
      {/* Owns the one gate into any bidding room, so every trigger in every
          page runs the same pending-EMD → terms → navigate sequence. */}
      <BidroomGateProvider>
      <Routes>
        <Route element={<Chrome />}>
          <Route index element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/bidding/:catalogueId" element={<BiddingRoom />} />
          <Route path="/help" element={<Help />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/disputes" element={<Disputes />} />
          <Route path="/settings/notifications" element={<NotificationPrefs />} />
          <Route path="/profile" element={<Profile />} />

          {/* shared pages that keep the active role's sub-nav (Browse, Noticeboard) */}
          <Route element={<SharedLayout />}>
            <Route path="/browse" element={<Browse />} />
            <Route path="/noticeboard" element={<Noticeboard />} />
          </Route>

          <Route element={<CatalogueDetailLayout />}>
            <Route path="/catalogue/:id" element={<AuctionDetail />} />
          </Route>

          {/* Guest 2 public site — shared chrome, lean top nav (Phase 3/6) */}
          <Route element={<Guest2Layout />}>
            <Route path="/g2" element={<Guest2Home />} />
            <Route path="/g2/solutions/buyers" element={<Guest2SolutionsBuyers />} />
            <Route path="/g2/solutions/sellers" element={<Guest2SolutionsSellers />} />
            <Route path="/g2/how-it-works" element={<Guest2HowItWorks />} />
            <Route path="/g2/contact" element={<Guest2Contact />} />
          </Route>

          <Route element={<BuyerLayout />}>
            <Route path="/buyer" element={<BuyerDashboard />} />
            <Route path="/buyermarketplace" element={<BuyerMarketplace />} />
            <Route path="/buyer/emd-shortlisted-catalogue" element={<Shortlist />} />
            <Route path="/buyer/shortlist" element={<Shortlist />} />
            <Route path="/buyer/shortlist/:catalogueId" element={<ShortlistCatalogue />} />
            <Route path="/buyer/bid-now" element={<BidNowAuctions />} />
            <Route path="/buyer/bid-now/:catalogueId" element={<BidNowLots />} />
            <Route path="/buyer/bids" element={<BuyerBids />} />
            <Route path="/buyer/auction-status" element={<AuctionStatus />} />
            <Route path="/buyer/wallet" element={<Wallet />} />
            <Route path="/buyer/kyc" element={<BecomeSeller />} />
          </Route>

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

          <Route path="/field" element={<FieldQueue />} />
          <Route path="/field/catalogue/:catalogueId" element={<FieldCatalogueDetail />} />
          <Route path="/field/lot/:lotId" element={<FieldLotDetail />} />
          <Route path="/field/inspect/:lotId" element={<InspectLot />} />

          <Route element={<SharedWorkspaceLayout owner="exec_manager" />}>
            <Route path="/exec" element={<Pipeline />} />
            <Route path="/exec/approvals" element={<LotApproval />} />
            <Route path="/exec/catalogue-builder" element={<CatalogueBuilder />} />
            <Route path="/exec/auction-setup" element={<AuctionSetup />} />
            <Route path="/exec/settlement" element={<Settlement />} />
            <Route path="/exec/logistics" element={<Logistics />} />
            <Route path="/exec/handover" element={<Handover />} />
          </Route>

          <Route element={<SharedWorkspaceLayout owner="auction_manager" />}>
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

          {/* Finance — money in → held → out → records, in that order */}
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

          {/* CEO — are we making money · are we growing · is anything at risk ·
              what needs me. Only the approvals screen has buttons. */}
          <Route element={<CeoLayout />}>
            <Route path="/ceo" element={<CeoProfitLoss />} />
            <Route path="/ceo/growth" element={<CeoGrowth />} />
            <Route path="/ceo/auctions" element={<CeoAuctionPerformance />} />
            <Route path="/ceo/risk" element={<CeoRisk />} />
            <Route path="/ceo/issues" element={<CeoIssues />} />
            <Route path="/ceo/approvals" element={<CeoApprovals />} />
            <Route path="/ceo/delegate" element={<CeoDelegate />} />
            <Route path="/ceo/reports" element={<CeoReports />} />
          </Route>

          {/* Sub Admin — head of operations, in the order of the roles they
              oversee: their own desk, the pre-auction pipeline, the sale, what
              they watch rather than execute, then accounts and admin. The
              pipeline and floor screens are not repeated here — this role works
              the Operation Manager's and the Auction Manager's own routes. */}
          <Route element={<SubAdminLayout />}>
            <Route path="/sub" element={<OpsConsole />} />
            <Route path="/sub/queue" element={<WorkQueue />} />
            <Route path="/sub/approvals" element={<SubApprovals />} />
            <Route path="/sub/bid-monitor" element={<BidMonitor />} />
            <Route path="/sub/payments" element={<PaymentActivity />} />
            <Route path="/sub/content" element={<ContentManagement />} />
            <Route path="/sub/reports" element={<SubReports />} />
            <Route path="/sub/activity" element={<MyActivity />} />
          </Route>

          {/* Three screens the Operation Manager works alongside the Sub Admin:
              seller verification, the field-executive board and the support
              desk. Each is one screen, not a copy per role — an Ops Manager who
              opens one keeps their own tab strip. */}
          <Route element={<SharedWorkspaceLayout owner="sub_admin" />}>
            <Route path="/sub/seller-verification" element={<SellerVerification />} />
            <Route path="/sub/field-executives" element={<FieldExecutives />} />
            <Route path="/sub/disputes" element={<SubDisputes />} />
          </Route>

          {/* Super Admin — our support role. Structure first (a role must exist
              before anyone can hold it), then people, then settings, then the
              exceptions only we can clear, then the record and the undo.
              `User accounts` is shared with the Sub Admin, so this group uses
              the shared layout: a Sub Admin who opens it keeps their own tabs. */}
          <Route element={<SharedWorkspaceLayout owner="super_admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/roles" element={<Roles />} />
            <Route path="/admin/pages" element={<PageManager />} />
            <Route path="/admin/sub-admins" element={<SubAdmins />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/finance" element={<Finance />} />
            <Route path="/admin/master-data" element={<MasterData />} />
            <Route path="/admin/content" element={<ContentPublishing />} />
            <Route path="/admin/blacklist" element={<Blacklist />} />
            <Route path="/admin/control-tower" element={<ControlTower />} />
            <Route path="/admin/change-history" element={<ChangeHistory />} />
            <Route path="/admin/audit" element={<Audit />} />
            {/* the old route, kept so bookmarks and older links still land */}
            <Route path="/admin/team" element={<Roles />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </BidroomGateProvider>
    </HashRouter>
  )
}
