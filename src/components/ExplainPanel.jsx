import React from 'react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';

export default function ExplainPanel({ explanation, onClose }) {
  if (!explanation) return null;

  const { decision, risk_score, summary, signals = [] } = explanation;

  const decisionColor = () => {
    if (decision === 'BLOCKED') return '#ef4444';
    if (decision === 'FLAGGED') return '#f97316';
    return '#22c55e';
  };

  const getImpactBadgeStyle = (impact) => {
    if (impact === 'high') {
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' };
    }
    if (impact === 'medium') {
      return { background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.3)' };
    }
    return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' };
  };

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: '420px',
      background: '#0d0d0d', borderLeft: '1px solid rgba(212,175,55,0.15)',
      boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease'
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Glass-Box Fraud Decision</h3>
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Explainable AI Audit Log & Signals</p>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: '#6b7280',
          cursor: 'pointer', fontSize: 20, padding: 4
        }}>×</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Summary Card */}
        <div style={{
          padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Risk Score</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: decisionColor() }}>
              {Math.round(risk_score * 100)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
            {decision === 'BLOCKED' && <ShieldAlert size={16} color="#ef4444" />}
            {decision === 'FLAGGED' && <AlertTriangle size={16} color="#f97316" />}
            {decision === 'COMPLETED' && <CheckCircle size={16} color="#22c55e" />}
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>DECISION: {decision}</span>
          </div>

          <p style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5 }}>
            {summary}
          </p>
        </div>

        {/* Signal Breakdowns */}
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Signal Contributions
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {signals.map((sig, idx) => (
              <div key={idx} style={{
                padding: '12px 14px', borderRadius: 8, background: '#121212',
                border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{sig.signal_name}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    textTransform: 'uppercase', ...getImpactBadgeStyle(sig.impact)
                  }}>
                    {sig.impact} impact
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>
                  {sig.description}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 6, marginTop: 4 }}>
                  <span>Raw Value: <b style={{ color: '#d1d5db' }}>{sig.raw_value.toFixed(2)}</b></span>
                  <span>Contribution: <b style={{ color: '#d1d5db' }}>{(sig.weight * 100).toFixed(1)}%</b></span>
                </div>
              </div>
            ))}
            {signals.length === 0 && (
              <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', padding: '20px 0' }}>
                No active signals contributed to this score.
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
