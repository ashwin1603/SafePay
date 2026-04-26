import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowRightLeft,
  CreditCard,
  ShieldCheck,
  Users,
  Server,
  Hexagon,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowRightLeft },
  { to: '/process', label: 'Process Payment', icon: CreditCard },
];

const adminItems = [
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/system', label: 'System', icon: Server },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside
      style={{
        width: 220,
        minHeight: '100vh',
        background: '#0e0e0e',
        borderRight: '1px solid rgba(212,175,55,0.1)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 12px',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px 28px 6px', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
        <div style={{
          width: 34, height: 34,
          background: 'linear-gradient(135deg, #d4af37, #8b6914)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Hexagon size={18} color="#0b0b0b" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#d4af37', letterSpacing: '-0.01em', lineHeight: 1.2 }}>SafePay</div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Flow</div>
        </div>
      </div>

      {/* Main Nav */}
      <div style={{ marginTop: 20 }}>
        <div className="section-title" style={{ paddingLeft: 10, marginBottom: 8, fontSize: 10 }}>Navigation</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Admin Nav */}
      <div style={{ marginTop: 24 }}>
        <div className="section-title" style={{ paddingLeft: 10, marginBottom: 8, fontSize: 10 }}>
          <ShieldCheck size={10} style={{ display: 'inline', marginRight: 5 }} />
          Admin
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {adminItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{
          background: 'rgba(212,175,55,0.06)',
          border: '1px solid rgba(212,175,55,0.15)',
          borderRadius: 8,
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#d4af37', marginBottom: 2 }}>AI Engine v2.4</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Isolation Forest Active</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <div className="pulse-gold" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>Model Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
