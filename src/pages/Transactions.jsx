import { useState, useMemo, useEffect } from 'react';
import { Search, Eye, Ban, Loader2 } from 'lucide-react';
import { transactions as mockTransactions } from '../data/mockData';
import { txnApi } from '../api/client';

const FILTERS = ['All', 'Completed', 'Processing', 'Flagged', 'Blocked'];

const riskColor = (score) => {
  if (score < 30) return '#22c55e';
  if (score < 60) return '#d4af37';
  if (score < 80) return '#f97316';
  return '#ef4444';
};

function StatusBadge({ status }) {
  const classMap = {
    completed: 'badge-completed',
    processing: 'badge-processing',
    flagged: 'badge-flagged',
    blocked: 'badge-blocked',
  };
  return <span className={`badge ${classMap[status] || 'badge-completed'}`}>{status}</span>;
}

export default function Transactions() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [transactions, setTransactions] = useState(mockTransactions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    txnApi.list({ limit: 100 })
      .then(data => {
        // Backend returns {id, txn_id, user_id, amount, ...}
        const mapped = data.map(t => ({
          ...t,
          amount: `$${t.amount.toFixed(2)}`,
          status: t.status.toLowerCase(),
          risk_score: Math.round(t.risk_score * 100),
          timestamp: new Date(t.created_at).toLocaleString(),
        }));
        setTransactions(mapped);
      })
      .catch(() => setTransactions(mockTransactions))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = transactions;
    if (filter !== 'All') list = list.filter(t => t.status === filter.toLowerCase());
    if (query) list = list.filter(t =>
      t.txn_id.toLowerCase().includes(query.toLowerCase()) ||
      t.user_id.toLowerCase().includes(query.toLowerCase())
    );
    return list;
  }, [query, filter]);

  const totalValue = filtered.reduce((sum, t) => sum + parseFloat(t.amount.replace(/[$,]/g, '')), 0);
  const avgRisk = filtered.length ? (filtered.reduce((s, t) => s + t.risk_score, 0) / filtered.length).toFixed(1) : 0;
  const successRate = filtered.length
    ? ((filtered.filter(t => t.status === 'completed').length / filtered.length) * 100).toFixed(1)
    : 0;

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Transactions</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Monitor and manage all payment flows</div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
          <Search size={14} color="#6b7280" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 36 }}
            placeholder="Search transaction ID or user ID…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: filter === f ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.08)',
                background: filter === f ? 'rgba(212,175,55,0.1)' : 'transparent',
                color: filter === f ? '#d4af37' : '#6b7280',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(11,11,11,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10, borderRadius: 12,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader2 size={24} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Loading transactions…</span>
            </div>
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>User ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Risk Score</th>
                <th>Timestamp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.txn_id} className="animate-fade-in">
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#d4af37' }}>{t.txn_id}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.user_id}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{t.amount}</span>
                  </td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 100 }}>
                      <div className="risk-bar" style={{ flex: 1 }}>
                        <div
                          className="risk-bar-fill"
                          style={{
                            width: `${t.risk_score}%`,
                            background: riskColor(t.risk_score),
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: riskColor(t.risk_score), minWidth: 28, textAlign: 'right' }}>
                        {t.risk_score}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{t.timestamp}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
                        <Eye size={11} style={{ marginRight: 4 }} />View
                      </button>
                      {t.status !== 'blocked' && (
                        <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>
                          <Ban size={11} style={{ marginRight: 4 }} />Block
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#4b5563', padding: 32 }}>
                    No transactions match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer stats */}
        <div style={{
          display: 'flex', gap: 0,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: '#0e0e0e',
        }}>
          {[
            { label: 'Displayed', value: filtered.length },
            { label: 'Total Value', value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
            { label: 'Avg Risk Score', value: `${avgRisk}` },
            { label: 'Success Rate', value: `${successRate}%` },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: '12px 18px',
                borderRight: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
