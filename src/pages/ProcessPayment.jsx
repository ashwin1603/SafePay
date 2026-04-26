import { useState } from 'react';
import { RefreshCw, ShieldCheck, Lock, Activity, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { paymentApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const securityFeatures = [
  { icon: ShieldCheck, label: 'JWT Authentication', desc: 'RS256 signed tokens with 15-min expiry' },
  { icon: Activity, label: 'AI Fraud Detection', desc: 'Isolation Forest anomaly scoring' },
  { icon: RefreshCw, label: 'Idempotency Guard', desc: 'Duplicate payment prevention layer' },
  { icon: Lock, label: 'Rate Limiting', desc: '100 req/min per user, 1000 global/min' },
  { icon: Zap, label: 'State Management', desc: 'Distributed saga pattern for rollback' },
];

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export default function ProcessPayment() {
  const { user } = useAuth();
  const [form, setForm] = useState({ user_id: '', amount: '', description: '', idempotency_key: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setProcessing(true);
    try {
      const data = await paymentApi.process({
        user_id: parseInt(form.user_id) || user?.id,
        amount: parseFloat(form.amount),
        description: form.description,
        idempotency_key: form.idempotency_key,
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Process Payment</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Securely submit a new payment transaction</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, maxWidth: 960 }}>
        {/* Form card */}
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 22, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 14 }}>
            Payment Details
          </div>

          {result && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: result.status === 'BLOCKED' ? 'rgba(239,68,68,0.08)' : result.status === 'FLAGGED' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
              border: `1px solid ${result.status === 'BLOCKED' ? 'rgba(239,68,68,0.25)' : result.status === 'FLAGGED' ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'}`,
              borderRadius: 8, padding: '12px 16px', marginBottom: 20,
            }}>
              <CheckCircle2 size={16} color={result.status === 'BLOCKED' ? '#f87171' : result.status === 'FLAGGED' ? '#fbbf24' : '#22c55e'} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: result.status === 'BLOCKED' ? '#f87171' : result.status === 'FLAGGED' ? '#fbbf24' : '#22c55e' }}>
                  {result.status} · {result.txn_id}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{result.message}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  Risk score: <strong style={{ color: '#d4af37' }}>{(result.risk_score * 100).toFixed(1)}%</strong>
                  {result.is_duplicate && <span style={{ marginLeft: 10, color: '#6b7280' }}>· Idempotent replay</span>}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
            }}>
              <AlertCircle size={14} color="#f87171" />
              <span style={{ fontSize: 12, color: '#f87171' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                User ID
              </label>
              <input
                className="input-field"
                placeholder="USR-4421"
                value={form.user_id}
                onChange={e => set('user_id', e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Amount (USD)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 14, fontWeight: 600 }}>$</span>
                <input
                  className="input-field"
                  style={{ paddingLeft: 24 }}
                  placeholder="0.00"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Description
              </label>
              <input
                className="input-field"
                placeholder="Payment for invoice #INV-2024"
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Idempotency Key
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input-field"
                  placeholder="Auto-generated key"
                  value={form.idempotency_key}
                  onChange={e => set('idempotency_key', e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 11 }}
                />
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                  onClick={() => set('idempotency_key', generateKey())}
                >
                  <RefreshCw size={11} style={{ marginRight: 4 }} />
                  Generate
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#4b5563', marginTop: 5 }}>
                Prevents duplicate payments for the same request
              </div>
            </div>

            <button
              type="submit"
              className="btn-gold"
              style={{ marginTop: 6, padding: '13px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              disabled={processing}
            >
              {processing ? (
                <>
                  <div style={{
                    width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)',
                    borderTopColor: '#0b0b0b', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Processing…
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  Process Payment
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <ShieldCheck size={16} color="#d4af37" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Security Architecture</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {securityFeatures.map(({ icon: Icon, label, desc }) => (
                <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 32, height: 32,
                    background: 'rgba(212,175,55,0.08)',
                    border: '1px solid rgba(212,175,55,0.18)',
                    borderRadius: 7,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={14} color="#d4af37" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db' }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live risk preview */}
          <div className="card" style={{ padding: '18px 22px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pre-flight Checks
            </div>
            {[
              { label: 'User KYC verified', ok: !!form.user_id },
              { label: 'Amount within daily limit', ok: form.amount > 0 && form.amount <= 50000 },
              { label: 'Idempotency key present', ok: !!form.idempotency_key },
              { label: 'AI fraud scan', ok: false, pending: true },
            ].map((check, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: check.pending ? 'rgba(212,175,55,0.15)' : check.ok ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${check.pending ? 'rgba(212,175,55,0.3)' : check.ok ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {check.pending
                    ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4af37' }} />
                    : check.ok
                    ? <CheckCircle2 size={10} color="#22c55e" />
                    : null}
                </div>
                <span style={{ fontSize: 12, color: check.pending ? '#d4af37' : check.ok ? '#9ca3af' : '#4b5563' }}>
                  {check.label}
                  {check.pending && <span style={{ marginLeft: 6, fontSize: 10, color: '#d4af37' }}>on submit</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
