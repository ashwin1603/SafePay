import { CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { fraudAlerts } from '../data/mockData';
import { useState, useMemo } from 'react';
import { txnApi } from '../api/client';

const levelIcons = {
  'HIGH RISK': <AlertTriangle size={13} />,
  'BLOCKED': <XCircle size={13} />,
  'REVIEW': <Clock size={13} />,
};

export default function FraudAlerts({ transactions = [], onRefresh }) {
  const [handled, setHandled] = useState({});

  const alerts = useMemo(() => {
    // Only extract FLAGGED (needs review) or BLOCKED transactions from the database
    const dbAlerts = transactions.filter(t => t.status === 'FLAGGED' || t.status === 'BLOCKED');
    if (!dbAlerts.length) return fraudAlerts; // Fallback to mock alerts if no DB data exists yet

    return dbAlerts.map(t => {
      const isBlocked = t.status === 'BLOCKED';
      return {
        dbId: t.id,
        id: t.txn_id,
        level: isBlocked ? 'BLOCKED' : 'REVIEW',
        levelClass: isBlocked ? 'text-red-500' : 'text-yellow-400',
        bgClass: isBlocked ? 'bg-red-600/10 border-red-600/20' : 'bg-yellow-500/10 border-yellow-500/20',
        message: t.description || (isBlocked ? 'AI Anomaly Blocked — spending amount matches threat profile' : 'Operator review required — high anomaly score'),
        amount: `₹${t.amount.toFixed(2)}`,
        time: new Date(t.created_at).toLocaleString(),
      };
    });
  }, [transactions]);

  const handle = async (dbId, id, action) => {
    if (!dbId) {
      // Mock fallback action
      setHandled(prev => ({ ...prev, [id]: action === 'approve' ? 'approved' : 'blocked' }));
      return;
    }

    try {
      if (action === 'approve') {
        await txnApi.review(dbId, 'approve');
        setHandled(prev => ({ ...prev, [id]: 'approved' }));
      } else {
        await txnApi.review(dbId, 'reject');
        setHandled(prev => ({ ...prev, [id]: 'blocked' }));
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Failed to review transaction: ${err.message}`);
    }
  };

  return (
    <div className="card animate-fade-in" style={{ padding: '20px 22px' }}>
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
                  {!action && alert.level === 'REVIEW' ? (
                    <>
                      <button
                        className="btn-gold"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        onClick={() => handle(alert.dbId, alert.id, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ padding: '5px 12px', fontSize: 11, borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                        onClick={() => handle(alert.dbId, alert.id, 'reject')}
                      >
                        Block
                      </button>
                    </>
                  ) : action ? (
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: action === 'approved' ? '#22c55e' : '#f87171',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {action === 'approved' ? '✓ Approved' : '✗ Blocked'}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
