import { useState, useEffect, useMemo } from 'react';
import StatCard from '../components/StatCard';
import FraudAlerts from '../components/FraudAlerts';
import { statsData as fallbackStats, txnVolumeData as fallbackVolume, fraudWeeklyData as fallbackWeekly } from '../data/mockData';
import { txnApi } from '../api/client';
import { Loader2 } from 'lucide-react';
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
              ? `₹${p.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
              : p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = () => {
    setLoading(true);
    txnApi.list({ limit: 100 })
      .then(data => {
        setTransactions(data);
      })
      .catch(err => {
        console.error("Dashboard API Error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // ── 1. Calculate statsData dynamically ──
  const stats = useMemo(() => {
    if (!transactions.length) return fallbackStats;

    const totalCount = transactions.length;
    const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
    const blockedCount = transactions.filter(t => t.status.toLowerCase() === 'blocked').length;
    const flaggedCount = transactions.filter(t => t.status.toLowerCase() === 'flagged').length;
    const completedCount = transactions.filter(t => t.status.toLowerCase() === 'completed').length;
    const successRate = totalCount ? ((completedCount / totalCount) * 100).toFixed(1) : '0';
    const avgRisk = totalCount
      ? (transactions.reduce((sum, t) => sum + t.risk_score, 0) / totalCount)
      : 0;

    return [
      {
        id: 1,
        label: 'Total Transactions',
        value: `₹${totalVolume.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        change: `from ${totalCount} txns`,
        trend: 'up',
        icon: 'IndianRupee',
        sub: 'total volume',
      },
      {
        id: 2,
        label: 'Success Rate',
        value: `${successRate}%`,
        change: `${completedCount} successful`,
        trend: 'up',
        icon: 'CheckCircle',
        sub: 'of all transactions',
      },
      {
        id: 3,
        label: 'Fraud Blocked',
        value: blockedCount.toString(),
        change: `${flaggedCount} flagged`,
        trend: 'down-good',
        icon: 'ShieldAlert',
        sub: 'AI neutralized',
      },
      {
        id: 4,
        label: 'Avg Risk Score',
        value: `${Math.round(avgRisk * 100)}/100`,
        change: 'AI anomaly check',
        trend: 'down-good',
        icon: 'Zap',
        sub: 'overall risk',
      },
    ];
  }, [transactions]);

  // ── 2. Calculate Transaction Volume chart data dynamically ──
  const volumeData = useMemo(() => {
    if (!transactions.length) return fallbackVolume;

    // Initialize 12 2-hour slots: '00:00', '02:00', ..., '22:00'
    const slots = Array.from({ length: 12 }, (_, i) => {
      const h = String(i * 2).padStart(2, '0');
      return { time: `${h}:00`, volume: 0 };
    });

    transactions.forEach(t => {
      const date = new Date(t.created_at);
      const hour = date.getHours();
      const slotIndex = Math.min(Math.floor(hour / 2), 11);
      slots[slotIndex].volume += t.amount;
    });

    return slots;
  }, [transactions]);

  // ── 3. Calculate AI Fraud Detection weekly data dynamically ──
  const weeklyData = useMemo(() => {
    if (!transactions.length) return fallbackWeekly;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dataMap = days.map(d => ({ day: d, blocked: 0, flagged: 0 }));

    transactions.forEach(t => {
      const date = new Date(t.created_at);
      const dayName = days[date.getDay()];
      const item = dataMap.find(d => d.day === dayName);
      if (item) {
        const st = t.status.toLowerCase();
        if (st === 'blocked') item.blocked += 1;
        else if (st === 'flagged') item.flagged += 1;
      }
    });

    return dataMap;
  }, [transactions]);

  return (
    <div style={{ padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(11,11,11,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, borderRadius: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 size={28} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Loading gateway analytics…</span>
          </div>
        </div>
      )}

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Dashboard</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          Real-time gateway analytics · <span style={{ color: '#d4af37' }}>Live Database Data</span>
        </div>
      </div>

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {stats.map(card => (
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
            <AreaChart data={volumeData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
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
            <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={10} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }}
                iconSize={8}
                iconType="circle"
              />
              <Bar dataKey="blocked" name="Blocked" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="flagged" name="Flagged" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fraud alerts */}
      <FraudAlerts transactions={transactions} onRefresh={fetchTransactions} />

      {/* Style for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
