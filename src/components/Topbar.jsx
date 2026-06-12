import { NavLink } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { P, ROLE_LABELS } from '../auth/permissions';

const tabs = [
  { to: '/', label: 'Dashboard', perm: null },
  { to: '/transactions', label: 'Transactions', perm: P.TXN_READ_OWN },
  { to: '/process', label: 'Process Payment', perm: P.PAYMENT_CREATE },
  { to: '/admin/system', label: 'Operations', perm: P.STATS_READ },
  { to: '/admin/users', label: 'Admin', perm: P.USER_READ },
];

const roleBadge = { user: '#9ca3af', operator: '#60a5fa', admin: '#d4af37' };

export default function Topbar() {
  const { user, logout, can } = useAuth();
  const visibleTabs = tabs.filter((t) => !t.perm || can(t.perm));
  const badgeColor = roleBadge[user?.role] || '#9ca3af';

  return (
    <header style={{ height: 58, background: '#0e0e0e', borderBottom: '1px solid rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 32, position: 'sticky', top: 0, zIndex: 50, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #d4af37, #8b6914)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#0b0b0b' }}>S</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#d4af37', letterSpacing: '-0.02em' }}>
          SafePay<span style={{ color: '#6b7280', fontWeight: 400 }}> Gateway</span>
        </span>
      </div>

      <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
        {visibleTabs.map(({ to, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({
              padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              textDecoration: 'none',
              background: isActive ? 'rgba(212,175,55,0.12)' : 'transparent',
              color: isActive ? '#d4af37' : '#6b7280',
              borderBottom: isActive ? '2px solid #d4af37' : '2px solid transparent',
            })}>
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '5px 12px', borderRadius: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #d4af37, #8b6914)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={12} color="#0b0b0b" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email || 'Guest'}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: badgeColor, background: `${badgeColor}22`, padding: '1px 6px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {ROLE_LABELS[user?.role] || 'User'}
          </span>
        </div>
        <button onClick={logout} title="Sign out"
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LogOut size={14} color="#6b7280" />
        </button>
      </div>
    </header>
  );
}
