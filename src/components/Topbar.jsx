import { NavLink } from 'react-router-dom';
import { Activity, User, ChevronDown, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const tabs = [
  { to: '/', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/process', label: 'Process Payment' },
  { to: '/admin/users', label: 'Admin' },
];

export default function Topbar() {
  const { user, logout } = useAuth();
  return (
    <header style={{
      height: 58,
      background: '#0e0e0e',
      borderBottom: '1px solid rgba(212,175,55,0.1)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 32,
      position: 'sticky',
      top: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>
      {/* Logo (mobile/top) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28,
          background: 'linear-gradient(135deg, #d4af37, #8b6914)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#0b0b0b' }}>S</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#d4af37', letterSpacing: '-0.02em' }}>
          SafePay<span style={{ color: '#6b7280', fontWeight: 400 }}> Flow</span>
        </span>
      </div>

      {/* Nav tabs */}
      <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
        {tabs.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              background: isActive ? 'rgba(212,175,55,0.12)' : 'transparent',
              color: isActive ? '#d4af37' : '#6b7280',
              borderBottom: isActive ? '2px solid #d4af37' : '2px solid transparent',
              transition: 'all 0.2s',
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        {/* System status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.2)',
          padding: '5px 12px', borderRadius: 999,
        }}>
          <div className="pulse-gold" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', letterSpacing: '0.04em' }}>System Active</span>
        </div>

        {/* Notification */}
        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={16} color="#6b7280" />
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 14, height: 14, borderRadius: '50%',
            background: '#d4af37',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: '#0b0b0b' }}>3</span>
          </div>
        </div>

        {/* Admin user */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '5px 12px', borderRadius: 8,
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'linear-gradient(135deg, #d4af37, #8b6914)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={12} color="#0b0b0b" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email || 'Admin User'}
          </span>
          {user?.role === 'admin' && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#d4af37', background: 'rgba(212,175,55,0.15)', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.06em' }}>
              ADMIN
            </span>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out"
          style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 7, padding: '6px 8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={14} color="#6b7280" />
        </button>
      </div>
    </header>
  );
}
