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
import SubConsole from './pages/sub/Console';

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

          {/* super admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/team" element={<Team />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/config" element={<Config />} />
          <Route path="/admin/audit" element={<Audit />} />

          {/* sub-admin */}
          <Route path="/sub" element={<SubConsole />} />
          <Route path="/sub/audit" element={<Audit subAdminView />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
