import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, ShieldAlert, Cpu } from 'lucide-react';
import { analyticsApi } from '../api/client';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await analyticsApi.summary();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load analytics dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '100px 0' }}>Loading observability dashboard...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '28px' }}>
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      </div>
    );
  }

  const {
    risk_distribution = { buckets: [], total: 0 },
    rates = [],
    top_signals = [],
    drift = {},
    total_transactions = 0,
    avg_risk_score = 0,
    block_rate = 0,
    flag_rate = 0
  } = data || {};

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Fraud Observability Dashboard</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Real-time signal firing rates, model drift telemetry, and risk distribution metrics</div>
      </div>

      {/* Overview stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Total Scanned Transactions', value: total_transactions },
          { label: 'Avg Risk Score', value: `${(avg_risk_score * 100).toFixed(1)}%` },
          { label: 'Block Rate', value: `${block_rate}%` },
          { label: 'Flag Rate', value: `${flag_rate}%` },
        ].map((stat, idx) => (
          <div key={idx} className="card" style={{ padding: '18px 22px' }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 8 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
        
        {/* Risk Score Distribution */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Risk Score Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {risk_distribution.buckets.map((b, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: '#9ca3af', width: 60, fontFamily: 'monospace' }}>{b.range_label}</span>
                <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${b.percentage}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #d4af37, #f59e0b)',
                    borderRadius: 6
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', width: 40, textAlign: 'right' }}>{b.percentage}%</span>
                <span style={{ fontSize: 11, color: '#4b5563', width: 40, textAlign: 'right' }}>({b.count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model Drift Telemetry */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Cpu size={16} color="#d4af37" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Model Drift Telemetry</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>KS Statistic</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{drift.ks_statistic}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>P-Value</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{drift.p_value}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Drift Status</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: drift.is_drifting ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  color: drift.is_drifting ? '#ef4444' : '#22c55e',
                  border: drift.is_drifting ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(34, 197, 94, 0.2)'
                }}>
                  {drift.is_drifting ? 'DRIFTING' : 'STABLE'}
                </span>
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 20, padding: 12, borderRadius: 8,
            background: drift.is_drifting ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.01)',
            border: drift.is_drifting ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(255,255,255,0.04)',
            color: drift.is_drifting ? '#f87171' : '#9ca3af', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <AlertCircle size={15} />
            {drift.message}
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        
        {/* Top Firing Signals */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Top Firing High-Risk Signals</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {top_signals.map((sig, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{sig.signal_name}</span>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Fired {sig.fire_count} times</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#d4af37' }}>{sig.percentage}% of alerts</span>
              </div>
            ))}
            {top_signals.length === 0 && (
              <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No high-risk signal contributions processed.</div>
            )}
          </div>
        </div>

        {/* Action Rates Over Time */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Transaction Verdict Trend (Last 7 Days)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rates.map((rate, idx) => (
              <div key={idx} style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', fontFamily: 'monospace' }}>{rate.period}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                  <span style={{ color: '#fff' }}>Total: <b>{rate.total}</b></span>
                  <span style={{ color: '#22c55e' }}>Comp: <b>{rate.completed}</b></span>
                  <span style={{ color: '#f97316' }}>Flag: <b>{rate.flagged}</b></span>
                  <span style={{ color: '#ef4444' }}>Block: <b>{rate.blocked}</b></span>
                </div>
              </div>
            ))}
            {rates.length === 0 && (
              <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No transactional trends found.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
