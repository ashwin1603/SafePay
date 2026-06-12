import { CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { fraudAlerts } from '../data/mockData';
import { useState } from 'react';

const levelIcons = {
  'HIGH RISK': <AlertTriangle size={13} />,
  'BLOCKED': <XCircle size={13} />,
  'REVIEW': <Clock size={13} />,
};

export default function FraudAlerts() {
  const [alerts, setAlerts] = useState(fraudAlerts);
  const [handled, setHandled] = useState({});

  const handle = (id, action) => {
    setHandled(prev => ({ ...prev, [id]: action }));
  };

  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Active Fraud Alerts</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Real-time AI anomaly detection</div>
        </div>
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          color: '#f87171',
          fontSize: 11, fontWeight: 700,
          padding: '3px 10px', borderRadius: 999,
        }}>
          {Object.keys(handled).length < alerts.length ? alerts.length - Object.keys(handled).length : 0} ACTIVE
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {alerts.map((alert) => {
          const action = handled[alert.id];
          return (
            <div
              key={alert.id}
              className="animate-slide-in"
              style={{
                background: action ? 'rgba(255,255,255,0.02)' : '#141414',
                border: `1px solid ${action ? 'rgba(255,255,255,0.06)' : alert.bgClass.includes('red') ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                borderRadius: 10,
                padding: '14px 16px',
                opacity: action ? 0.55 : 1,
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                      color: alert.levelClass.replace('text-', '').includes('red') ? '#f87171' : '#fbbf24',
                    }}>
                      {levelIcons[alert.level]}
                      {alert.level}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>·</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', fontFamily: 'monospace' }}>{alert.id}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#d4af37', marginLeft: 'auto' }}>{alert.amount}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{alert.message}</div>
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 5 }}>{alert.time}</div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: 'column' }}>
                  {!action ? (
                    <>
                      <button
                        className="btn-gold"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        onClick={() => handle(alert.id, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ padding: '5px 12px', fontSize: 11, borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                        onClick={() => handle(alert.id, 'blocked')}
                      >
                        Block
                      </button>
                    </>
                  ) : (
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: action === 'approved' ? '#22c55e' : '#f87171',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {action === 'approved' ? '✓ Approved' : '✗ Blocked'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
