import { useState } from 'react';
import { Cpu, HardDrive, Database, Activity, RefreshCw, Sliders, Archive, CheckCircle2 } from 'lucide-react';
import { systemMetrics, systemPerfData } from '../data/mockData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1a1a1a', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#d4af37' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>{p.name}: {p.value}%</div>
        ))}
      </div>
    );
  }
  return null;
};

const metricCards = [
  { label: 'CPU Usage', value: `${systemMetrics.cpu}%`, icon: Cpu, color: '#d4af37', bar: systemMetrics.cpu },
  { label: 'Memory Usage', value: `${systemMetrics.memory}%`, icon: HardDrive, color: '#60a5fa', bar: systemMetrics.memory },
  { label: 'DB Connections', value: `${systemMetrics.dbConnections}`, icon: Database, color: '#22c55e', bar: (systemMetrics.dbConnections / 100) * 100 },
  { label: 'Requests/min', value: systemMetrics.requestsPerMin.toLocaleString(), icon: Activity, color: '#a78bfa', bar: 57 },
];

const controls = [
  { icon: RefreshCw, label: 'Retrain Model', desc: 'Re-train Isolation Forest with latest transaction data', color: '#d4af37' },
  { icon: Sliders, label: 'Rate Limit Config', desc: 'Adjust per-user and global API rate thresholds', color: '#60a5fa' },
  { icon: Database, label: 'Optimize DB', desc: 'Run VACUUM, ANALYZE and update index statistics', color: '#22c55e' },
  { icon: Archive, label: 'Archive Records', desc: 'Move transactions older than 90 days to cold storage', color: '#a78bfa' },
];

export default function AdminSystem() {
  const [fired, setFired] = useState({});

  const fire = (label) => {
    setFired(prev => ({ ...prev, [label]: 'running' }));
    setTimeout(() => {
      setFired(prev => ({ ...prev, [label]: 'done' }));
      setTimeout(() => setFired(prev => { const n = { ...prev }; delete n[label]; return n; }), 2500);
    }, 2000);
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>System Administration</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Infrastructure health and model controls</div>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {metricCards.map(({ label, value, icon: Icon, color, bar }) => (
          <div key={label} className="card animate-fade-in" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${color}18`,
                border: `1px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={15} color={color} strokeWidth={1.8} />
              </div>
              <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{value}</div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${bar}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
                borderRadius: 99, transition: 'width 0.8s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Performance chart */}
      <div className="card" style={{ padding: '22px' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>System Performance</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>CPU vs Memory utilization (last 10 hours)</div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={systemPerfData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} iconType="circle" iconSize={8} />
            <Line type="monotone" dataKey="cpu" name="CPU" stroke="#d4af37" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="memory" name="Memory" stroke="#60a5fa" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Controls */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          System Controls
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {controls.map(({ icon: Icon, label, desc, color }) => {
            const state = fired[label];
            return (
              <div key={label} className="card animate-fade-in" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: `${color}12`,
                  border: `1px solid ${color}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={18} color={color} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{desc}</div>
                </div>
                <button
                  className={state ? 'btn-ghost' : 'btn-ghost'}
                  style={{
                    padding: '7px 16px', fontSize: 12, flexShrink: 0,
                    ...(state === 'done' ? { borderColor: 'rgba(34,197,94,0.3)', color: '#22c55e' } : {}),
                    ...(state === 'running' ? { borderColor: `${color}40`, color } : {}),
                  }}
                  onClick={() => !state && fire(label)}
                >
                  {state === 'running' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{
                        width: 11, height: 11, border: `2px solid ${color}40`,
                        borderTopColor: color, borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                      }} />
                      Running…
                    </span>
                  ) : state === 'done' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={12} />
                      Complete
                    </span>
                  ) : 'Execute'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
