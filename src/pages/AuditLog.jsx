import { useEffect, useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { adminApi } from '../api/client';

const outcomeColor = {
  success: '#22c55e', failure: '#f87171', denied: '#fbbf24', locked: '#f97316',
  completed: '#22c55e', blocked: '#f87171', flagged: '#fbbf24',
};

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    try { setRows(await adminApi.audit()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScrollText size={20} color="#d4af37" /> Audit Log
          </h1>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Append-only record of security-relevant events</div>
        </div>
        <button onClick={load} className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: '#6b7280', textAlign: 'left' }}>
              {['Time', 'Actor', 'Role', 'Action', 'Target', 'Outcome', 'IP'].map(h => (
                <th key={h} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 20, color: '#6b7280' }}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} style={{ padding: 20, color: '#6b7280' }}>No events.</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td style={td}>{new Date(r.created_at).toLocaleString()}</td>
                <td style={td}>{r.actor}</td>
                <td style={td}>{r.actor_role || '—'}</td>
                <td style={{ ...td, color: '#d1d5db', fontWeight: 600 }}>{r.action}</td>
                <td style={td}>{r.target || '—'}</td>
                <td style={td}><span style={{ color: outcomeColor[r.outcome] || '#9ca3af', fontWeight: 600 }}>{r.outcome}</span></td>
                <td style={{ ...td, color: '#6b7280' }}>{r.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const td = { padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#9ca3af' };
