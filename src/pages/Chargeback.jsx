import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { chargebackApi } from '../api/client';

export default function Chargeback() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const res = await chargebackApi.predictions();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to fetch chargeback scanner models');
    } finally {
      setLoading(false);
    }
  };

  const riskLevelColor = (level) => {
    if (level === 'critical') return '#ef4444';
    if (level === 'high') return '#f97316';
    if (level === 'medium') return '#f59e0b';
    return '#22c55e';
  };

  if (loading) {
    return <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '100px 0' }}>Analyzing historical transactions with chargeback predictor...</div>;
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

  const { total_scanned = 0, high_risk_count = 0, predictions = [] } = data || {};

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Chargeback Risk Scanner</h1>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Proactive pre-settlement prediction scanning via z-score and velocity models
          </div>
        </div>
        <button onClick={fetchPredictions} className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={12} /> Scan Transaction Pool
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Transactions Scanned</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 8 }}>{total_scanned}</div>
        </div>
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>High/Critical Risk Alerts</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: high_risk_count > 0 ? '#ef4444' : '#22c55e', marginTop: 8 }}>
            {high_risk_count} predicted disputes
          </div>
        </div>
      </div>

      {/* Predictions list */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Predicted Dispute Scans</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {predictions.map((p) => (
            <div key={p.transaction_id} style={{
              padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: 'monospace', color: '#d4af37', fontSize: 13, fontWeight: 700 }}>{p.txn_id}</span>
                  <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 12 }}>Amount: <b>${p.amount.toFixed(2)}</b></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Dispute Prob: <b>{(p.chargeback_probability * 100).toFixed(1)}%</b></span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.01)', color: riskLevelColor(p.risk_level),
                    border: `1px solid ${riskLevelColor(p.risk_level)}`
                  }}>
                    {p.risk_level.toUpperCase()} RISK
                  </span>
                </div>
              </div>

              {/* Factors grid */}
              <div style={{
                background: '#0e0e0e', padding: '10px 14px', borderRadius: 8,
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 11
              }}>
                <div>
                  <span style={{ color: '#6b7280' }}>Initial Risk:</span>
                  <span style={{ color: '#fff', marginLeft: 6 }}>{Math.round(p.risk_factors.risk_score_at_payment * 100)}%</span>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Amount Z-Score:</span>
                  <span style={{ color: '#fff', marginLeft: 6 }}>{p.risk_factors.amount_zscore.toFixed(2)}</span>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Velocity Factor:</span>
                  <span style={{ color: '#fff', marginLeft: 6 }}>{p.risk_factors.velocity_factor.toFixed(1)}x</span>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Hour Risk:</span>
                  <span style={{ color: '#fff', marginLeft: 6 }}>{p.risk_factors.time_of_day_risk.toFixed(2)}</span>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>First Transact:</span>
                  <span style={{ color: p.risk_factors.is_first_transaction ? '#f59e0b' : '#9ca3af', marginLeft: 6 }}>
                    {p.risk_factors.is_first_transaction ? 'YES' : 'NO'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Mean Ratio:</span>
                  <span style={{ color: '#fff', marginLeft: 6 }}>{p.risk_factors.amount_vs_user_mean.toFixed(2)}x</span>
                </div>
              </div>
            </div>
          ))}

          {predictions.length === 0 && (
            <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No disputed chargeback risks scanned.</div>
          )}
        </div>
      </div>
    </div>
  );
}
