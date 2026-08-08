import React from 'react';
import { 
  ArrowLeft, ShieldAlert, TrendingUp, Briefcase, Settings, 
  MapPin, DollarSign, Headphones, Scale, Eye, 
  Package, ShoppingBag, Truck, SearchCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Roles = () => {
  const roles = [
    {
      title: "Super Admin",
      icon: <ShieldAlert size={24} />,
      color: "#ef4444",
      bg: "#fef2f2",
      purpose: "Complete ownership of the platform with unrestricted access to every module and operation.",
      responsibilities: ["Manage every module", "System configurations", "Audit logs", "Security", "Override approvals"]
    },
    {
      title: "CEO",
      icon: <TrendingUp size={24} />,
      color: "#3b82f6",
      bg: "#eff6ff",
      purpose: "Monitors business growth and financial performance.",
      responsibilities: ["Revenue dashboards", "Business KPIs", "Executive reports", "Profit analysis"]
    },
    {
      title: "Executive Officer",
      icon: <Briefcase size={24} />,
      color: "#8b5cf6",
      bg: "#f5f3ff",
      purpose: "Operational approval authority ensuring only valid auctions proceed.",
      responsibilities: ["Approve/reject auctions", "Monitor site officers", "Special approvals", "Assign work"]
    },
    {
      title: "Sub Admin (Operations)",
      icon: <Settings size={24} />,
      color: "#f59e0b",
      bg: "#fffbeb",
      purpose: "Operational backbone managing the complete auction lifecycle.",
      responsibilities: ["Create catalogs & lots", "Manage buyers/sellers", "Coordinate transport", "Generate reports"]
    },
    {
      title: "Site Officer",
      icon: <MapPin size={24} />,
      color: "#ea580c",
      bg: "#ffedd5",
      purpose: "Works completely in the field. Conducts physical inspections.",
      responsibilities: ["Inspect scrap/assets", "Upload photos/videos", "Submit inspection report", "Recommend approvals"]
    },
    {
      title: "Finance Officer",
      icon: <DollarSign size={24} />,
      color: "#10b981",
      bg: "#ecfdf5",
      purpose: "Manages all transactions and settlements.",
      responsibilities: ["EMD & Refunds", "Invoices & GST", "Commission calculation", "Seller settlements"]
    },
    {
      title: "Customer Support",
      icon: <Headphones size={24} />,
      color: "#06b6d4",
      bg: "#ecfeff",
      purpose: "Assists users with queries and issues.",
      responsibilities: ["Buyer/Seller support", "Ticket management", "Registration help", "Complaint management"]
    },
    {
      title: "Compliance / Legal Officer",
      icon: <Scale size={24} />,
      color: "#64748b",
      bg: "#f8fafc",
      purpose: "Ensures legal compliance and handles agreements.",
      responsibilities: ["KYC verification", "Legal documents", "Audit documents", "Blacklist vendors"]
    },
    {
      title: "Investor / Board Member",
      icon: <Eye size={24} />,
      color: "#f43f5e",
      bg: "#fff1f2",
      purpose: "Read-only access to monitor performance.",
      responsibilities: ["View revenue", "Auction statistics", "Company KPIs", "Growth charts"]
    },
    {
      title: "Seller",
      icon: <Package size={24} />,
      color: "#16a34a",
      bg: "#dcfce7",
      purpose: "Owns the material being auctioned.",
      responsibilities: ["Submit auction requests", "View sold lots", "View payments", "Upload documents"]
    },
    {
      title: "Buyer",
      icon: <ShoppingBag size={24} />,
      color: "#0284c7",
      bg: "#e0f2fe",
      purpose: "Participates in auctions to purchase lots.",
      responsibilities: ["Complete KYC", "Pay EMD", "Bid in real-time", "Track payments"]
    },
    {
      title: "Transporter",
      icon: <Truck size={24} />,
      color: "#9333ea",
      bg: "#f3e8ff",
      purpose: "Handles logistics and material delivery.",
      responsibilities: ["Receive delivery requests", "Update transport status", "Upload POD", "Confirm delivery"]
    },
    {
      title: "Inspection Agency",
      icon: <SearchCheck size={24} />,
      color: "#d946ef",
      bg: "#fdf4ff",
      purpose: "Third-party inspection company.",
      responsibilities: ["Upload inspection report", "Verify assets", "Add quality reports"]
    }
  ];

  return (
    <div className="container" style={{ padding: '60px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', marginBottom: '32px' }}>
        <ArrowLeft size={16} /> Back to Home
      </Link>
      
      <div style={{ marginBottom: '48px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--dark)', marginBottom: '12px' }}>User Ecosystem Blueprint</h1>
        <p style={{ fontSize: '16px', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>Explore the complete hierarchy and responsibilities of every role within the National Auction Platform.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        {roles.map((role, idx) => (
          <div key={idx} style={{ background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', transition: 'transform 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: role.bg, color: role.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {role.icon}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--dark)' }}>{role.title}</h3>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--dark)', fontWeight: 600, marginBottom: '16px', lineHeight: 1.5 }}>
              {role.purpose}
            </p>
            
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '12px' }}>Key Responsibilities</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {role.responsibilities.map((resp, rIdx) => (
                  <li key={rIdx} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{resp}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Roles;
