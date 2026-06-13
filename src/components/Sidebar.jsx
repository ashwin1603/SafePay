import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ArrowRightLeft, CreditCard, ShieldCheck,
  Users, Server, ScrollText, Hexagon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { P, ROLE_LABELS } from '../auth/permissions';

// Each item declares the permission required to see it.
const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: null },
  { to: '/transactions', label: 'Transactions', icon: ArrowRightLeft, perm: P.TXN_READ_OWN },
  { to: '/process', label: 'Process Payment', icon: CreditCard, perm: P.PAYMENT_CREATE },
  { to: '/appeals', label: 'Appeals', icon: ShieldCheck, perm: P.APPEAL_SUBMIT },
];

const opsItems = [
  { to: '/admin/system', label: 'Operations', icon: Server, perm: P.STATS_READ },
  { to: '/admin/analytics', label: 'Fraud Analytics', icon: ScrollText, perm: P.ANALYTICS_VIEW },
  { to: '/admin/rules', label: 'Fraud Rules', icon: ShieldCheck, perm: P.FRAUD_RULES_MANAGE },
  { to: '/admin/simulation', label: 'Simulation Sandbox', icon: Server, perm: P.SIMULATION_RUN },
  { to: '/admin/chargebacks', label: 'Chargeback Risk', icon: ScrollText, perm: P.CHARGEBACK_VIEW },
];

const adminItems = [
  { to: '/admin/users', label: 'Users & IAM', icon: Users, perm: P.USER_READ },
  { to: '/admin/consortium', label: 'Consortium Network', icon: ShieldCheck, perm: P.CONSORTIUM_MANAGE },
  { to: '/admin/audit', label: 'Audit Log', icon: ScrollText, perm: P.AUDIT_READ },
];

function Section({ title, items, can }) {
  const visible = items.filter((i) => !i.perm || can(i.perm));
  if (visible.length === 0) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <div className="section-title" style={{ paddingLeft: 10, marginBottom: 8, fontSize: 10 }}>
        {title}
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visible.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function Sidebar() {
  const { user, can } = useAuth();
  const roleLabel = ROLE_LABELS[user?.role] || 'User';

  return (
    <aside style={{ width: 220, minHeight: '100vh', background: '#0e0e0e',
      borderRight: '1px solid rgba(212,175,55,0.1)', display: 'flex',
      flexDirection: 'column', padding: '24px 12px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px 24px 6px', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
        <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #d4af37, #8b6914)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Hexagon size={18} color="#0b0b0b" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#d4af37', lineHeight: 1.2 }}>SafePay</div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Gateway</div>
        </div>
      </div>

      {/* Role chip — shows the principal's actual role */}
      <div style={{ marginTop: 16, padding: '8px 10px', borderRadius: 8, background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={13} color="#d4af37" />
        <span style={{ fontSize: 11, color: '#9ca3af' }}>Signed in as</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#d4af37', marginLeft: 'auto' }}>{roleLabel}</span>
      </div>

      <Section title="Navigation" items={navItems} can={can} />
      <Section title="Operations" items={opsItems} can={can} />
      <Section title="Administration" items={adminItems} can={can} />

      <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#d4af37', marginBottom: 2 }}>Fraud Engine</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <div className="pulse-gold" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>IsolationForest online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
