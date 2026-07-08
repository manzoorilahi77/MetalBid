import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/shell';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Browse from './pages/Browse';
import LotDetail from './pages/LotDetail';
import BiddingRoom from './pages/BiddingRoom';
import Noticeboard from './pages/Noticeboard';
import BuyerDashboard from './pages/buyer/Dashboard';
import WalletPage from './pages/buyer/Wallet';
import MyBids from './pages/buyer/MyBids';
import Fulfilment from './pages/buyer/Fulfilment';
import BecomeSeller from './pages/buyer/BecomeSeller';
import SellerWorkspace from './pages/seller/Workspace';
import CreateLot from './pages/seller/CreateLot';
import SellerLots from './pages/seller/Lots';
import Monitor from './pages/seller/Monitor';
import Results from './pages/seller/Results';
import Pipeline from './pages/exec/Pipeline';
import Entities from './pages/exec/Entities';
import LotVerification from './pages/exec/LotVerification';
import AuctionSetup from './pages/exec/AuctionSetup';
import Settlement from './pages/exec/Settlement';
import Logistics from './pages/exec/Logistics';
import Handover from './pages/exec/Handover';
import AdminDashboard from './pages/admin/Dashboard';
import Team from './pages/admin/Team';
import UsersPage from './pages/admin/UsersPage';
import Config from './pages/admin/Config';
import Audit from './pages/admin/Audit';
import ControlTower from './pages/admin/ControlTower';
import Blacklist from './pages/admin/Blacklist';
import Financial from './pages/admin/Financial';
import MasterData from './pages/admin/MasterData';
import SubConsole from './pages/sub/Console';
import BidMonitor from './pages/sub/BidMonitor';
import Approvals from './pages/shared/Approvals';
import { ModuleGate } from './components/gate';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/login" element={<Login />} />

        <Route element={<AppShell />}>
          {/* shared / guest */}
          <Route path="/browse" element={<Browse />} />
          <Route path="/lot/:id" element={<LotDetail />} />
          <Route path="/bid/:auctionId" element={<BiddingRoom />} />
          <Route path="/noticeboard" element={<Noticeboard />} />

          {/* buyer */}
          <Route path="/buyer" element={<BuyerDashboard />} />
          <Route path="/buyer/wallet" element={<WalletPage />} />
          <Route path="/buyer/bids" element={<MyBids />} />
          <Route path="/buyer/fulfilment" element={<Fulfilment />} />
          <Route path="/buyer/become-seller" element={<BecomeSeller />} />

          {/* seller */}
          <Route path="/seller" element={<SellerWorkspace />} />
          <Route path="/seller/create" element={<CreateLot />} />
          <Route path="/seller/lots" element={<SellerLots />} />
          <Route path="/seller/monitor" element={<Monitor />} />
          <Route path="/seller/results" element={<Results />} />

          {/* executive admin */}
          <Route path="/exec" element={<Pipeline />} />
          <Route path="/exec/entities" element={<Entities />} />
          <Route path="/exec/lots" element={<LotVerification />} />
          <Route path="/exec/auctions" element={<AuctionSetup />} />
          <Route path="/exec/settlement" element={<Settlement />} />
          <Route path="/exec/logistics" element={<Logistics />} />
          <Route path="/exec/handover" element={<Handover />} />
          <Route path="/exec/approvals" element={<Approvals />} />

          {/* super admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/team" element={<Team />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/approvals" element={<Approvals />} />
          <Route path="/admin/control" element={<ControlTower />} />
          <Route path="/admin/blacklist" element={<Blacklist />} />
          <Route path="/admin/config" element={<Config />} />
          <Route path="/admin/financial" element={<Financial />} />
          <Route path="/admin/masterdata" element={<MasterData />} />
          <Route path="/admin/audit" element={<Audit />} />

          {/* sub-admin — own console + inherited Exec modules, permission-gated */}
          <Route path="/sub" element={<SubConsole />} />
          <Route path="/sub/approvals" element={<Approvals />} />
          <Route path="/sub/monitor" element={<BidMonitor />} />
          <Route path="/sub/audit" element={<Audit subAdminView />} />
          <Route path="/sub/pipeline" element={<ModuleGate module="pipeline" label="Pipeline Board"><Pipeline /></ModuleGate>} />
          <Route path="/sub/entities" element={<ModuleGate module="entities" label="Entity Verification"><Entities /></ModuleGate>} />
          <Route path="/sub/lots" element={<ModuleGate module="lots" label="Lot Verification"><LotVerification /></ModuleGate>} />
          <Route path="/sub/auctions" element={<ModuleGate module="auctions" label="Auction Setup"><AuctionSetup /></ModuleGate>} />
          <Route path="/sub/settlement" element={<ModuleGate module="settlement" label="Settlement"><Settlement /></ModuleGate>} />
          <Route path="/sub/logistics" element={<ModuleGate module="logistics" label="Logistics"><Logistics /></ModuleGate>} />
          <Route path="/sub/handover" element={<ModuleGate module="handover" label="Handover"><Handover /></ModuleGate>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
