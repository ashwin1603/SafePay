import StatCard from '../components/StatCard';
import FraudAlerts from '../components/FraudAlerts';
import { statsData, txnVolumeData, fraudWeeklyData } from '../data/mockData';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#1a1a1a',
        border: '1px solid rgba(212,175,55,0.25)',
        borderRadius: 8, padding: '10px 14px',
        fontSize: 12, color: '#d1d5db',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#d4af37' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' && p.name === 'volume'
              ? `$${p.value.toLocaleString()}`
              : p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  return (
    <div style={{ padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Dashboard</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          Real-time overview · <span style={{ color: '#d4af37' }}>April 10, 2026</span>
        </div>
      </div>

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {statsData.map(card => (
          <StatCard key={card.id} {...card} />
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        {/* Line chart */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Transaction Volume</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>24-hour rolling window</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={txnVolumeData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="volume"
                name="volume"
                stroke="#d4af37"
                strokeWidth={2}
                fill="url(#goldGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#d4af37', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>AI Fraud Detection</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Weekly blocked vs flagged</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={fraudWeeklyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={10} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }}
                iconSize={8}
                iconType="circle"
              />
              <Bar dataKey="blocked" fill="#ef4444" name="blocked" radius={[3, 3, 0, 0]} opacity={0.85} />
              <Bar dataKey="flagged" fill="#d4af37" name="flagged" radius={[3, 3, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fraud alerts */}
      <FraudAlerts />
    </div>
  );
}
