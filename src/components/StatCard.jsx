import { TrendingUp, TrendingDown, DollarSign, CheckCircle, ShieldAlert, Zap } from 'lucide-react';

const iconMap = {
  DollarSign,
  CheckCircle,
  ShieldAlert,
  Zap,
};

export default function StatCard({ label, value, change, trend, icon, sub }) {
  const Icon = iconMap[icon] || DollarSign;
  const isPositive = trend === 'up';
  const isNeutral = trend === 'down-good'; // down is good (fraud, response time)

  const changeColor = isNeutral
    ? '#22c55e'
    : isPositive
    ? '#22c55e'
    : '#ef4444';

  return (
    <div className="card animate-fade-in" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            {label}
          </div>
          <div className="metric-value">{value}</div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 12,
              fontWeight: 600,
              color: changeColor,
              background: `${changeColor}18`,
              padding: '2px 8px',
              borderRadius: 999,
            }}>
              {isNeutral
                ? <TrendingDown size={11} />
                : isPositive
                ? <TrendingUp size={11} />
                : <TrendingDown size={11} />}
              {change}
            </span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>{sub}</span>
          </div>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={20} color="#d4af37" strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}
