import { useState } from 'react';
import { Users, UserCheck, AlertTriangle, UserPlus, ShieldAlert } from 'lucide-react';
import { users, userStats } from '../data/mockData';

const riskColors = {
  low: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)' },
  medium: { color: '#d4af37', bg: 'rgba(212,175,55,0.1)', border: 'rgba(212,175,55,0.25)' },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
};

const statusColors = {
  active: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)' },
  flagged: { color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  blocked: { color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
};

function RiskBadge({ level }) {
  const c = riskColors[level] || riskColors.low;
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700,
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      padding: '2px 9px', borderRadius: 999, letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {level}
    </span>
  );
}

function StatusBadge({ status }) {
  const c = statusColors[status] || statusColors.active;
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700,
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      padding: '2px 9px', borderRadius: 999, letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
}

const userStatCards = [
  { label: 'Total Users', value: userStats.total.toLocaleString(), icon: Users, color: '#d4af37' },
  { label: 'Active', value: userStats.active.toLocaleString(), icon: UserCheck, color: '#22c55e' },
  { label: 'Flagged', value: userStats.flagged.toLocaleString(), icon: AlertTriangle, color: '#f97316' },
  { label: 'New (30d)', value: userStats.newLast30d.toLocaleString(), icon: UserPlus, color: '#60a5fa' },
];

export default function AdminUsers() {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>User Management</h1>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Monitor and manage platform users</div>
        </div>
        <button className="btn-gold" onClick={() => setShowAdd(!showAdd)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserPlus size={14} />
          Add User
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {userStatCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card animate-fade-in" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: `${color}15`,
              border: `1px solid ${color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon size={19} color={color} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Add user banner */}
      {showAdd && (
        <div className="card animate-fade-in" style={{ padding: '20px 22px', border: '1px solid rgba(212,175,55,0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#d4af37', marginBottom: 14 }}>Add New User</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>User ID</label>
              <input className="input-field" placeholder="USR-xxxx" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Email</label>
              <input className="input-field" placeholder="user@example.com" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Status</label>
              <select className="input-field" style={{ cursor: 'pointer' }}>
                <option value="active">Active</option>
                <option value="flagged">Flagged</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <button className="btn-gold">Create</button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Email</th>
                <th>Status</th>
                <th>Transactions</th>
                <th>Total Spent</th>
                <th>Risk Level</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id}>
                  <td><span style={{ fontFamily: 'monospace', color: '#d4af37', fontSize: 12 }}>{u.user_id}</span></td>
                  <td><span style={{ color: '#9ca3af' }}>{u.email}</span></td>
                  <td><StatusBadge status={u.status} /></td>
                  <td><span style={{ fontWeight: 600 }}>{u.transactions}</span></td>
                  <td><span style={{ fontWeight: 600, color: '#fff' }}>{u.total_spent}</span></td>
                  <td><RiskBadge level={u.risk_level} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>View</button>
                      {u.status !== 'blocked' && (
                        <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>Block</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
