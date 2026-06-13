import { useState } from 'react';
import { RefreshCw, ShieldCheck, Lock, Activity, Zap, CheckCircle2, AlertCircle, CreditCard, ShieldAlert, Sparkles } from 'lucide-react';
import { paymentApi, paymentStepupApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ExplainPanel from '../components/ExplainPanel';

const securityFeatures = [
  { icon: ShieldCheck, label: 'JWT Authentication', desc: 'Short-lived HS256 access tokens (15 min) + refresh' },
  { icon: Activity, label: 'AI Fraud Detection', desc: 'IsolationForest anomaly scoring on every payment' },
  { icon: RefreshCw, label: 'Idempotency Guard', desc: 'Exactly-once processing via idempotency keys' },
  { icon: Lock, label: 'Rate Limiting', desc: 'Per-client sliding-window limiter' },
  { icon: CreditCard, label: 'Tokenized Cards', desc: 'Raw card data never reaches our servers' },
];

// Simulated card tokens for demo (mirror Stripe-style tokens).
const CARD_OPTIONS = [
  { value: 'tok_visa', label: 'Test Visa (approve)' },
  { value: 'tok_decline', label: 'Test card (decline)' },
];

function generateKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'key-' + Math.random().toString(36).slice(2) + Date.now();
}

export default function ProcessPayment() {
  const { user } = useAuth();
  const [form, setForm] = useState({ amount: '', description: '', card_token: 'tok_visa', idempotency_key: generateKey() });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  // Step-up verification state
  const [stepupRequired, setStepupRequired] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Explanation state
  const [selectedExplanation, setSelectedExplanation] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setResult(null); setProcessing(true);
    setStepupRequired(false);
    try {
      const data = await paymentApi.process({
        amount: parseFloat(form.amount),
        description: form.description,
        card_token: form.card_token,
        idempotency_key: form.idempotency_key,
      });

      if (data.status === 'STEPUP_REQUIRED') {
        setStepupRequired(true);
        setChallengeId(data.challenge_id);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleVerifyStepup = async (e) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      const data = await paymentStepupApi.verify(challengeId, smsCode);
      setResult(data);
      setStepupRequired(false);
      setSmsCode('');
    } catch (err) {
      setError(err.message || 'Incorrect verification code');
    } finally {
      setVerifying(false);
    }
  };

  const statusColor = { COMPLETED: '#22c55e', FLAGGED: '#f59e0b', BLOCKED: '#ef4444', DECLINED: '#ef4444' };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Process Payment</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          Charging the signed-in account: <strong style={{ color: '#9ca3af' }}>{user?.email}</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, maxWidth: 960 }}>
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 22, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 14 }}>
            Payment details
          </div>
          
          {!stepupRequired ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ fontSize: 12, color: '#9ca3af' }}>Amount (USD)
                <input type="number" step="0.01" min="0.01" required value={form.amount}
                  onChange={e => set('amount', e.target.value)} placeholder="100.00"
                  style={inp} />
              </label>
              <label style={{ fontSize: 12, color: '#9ca3af' }}>Description
                <input type="text" maxLength={500} value={form.description}
                  onChange={e => set('description', e.target.value)} placeholder="Invoice #1234"
                  style={inp} />
              </label>
              <label style={{ fontSize: 12, color: '#9ca3af' }}>Card (tokenized client-side)
                <select value={form.card_token} onChange={e => set('card_token', e.target.value)} style={inp}>
                  {CARD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, color: '#9ca3af' }}>Idempotency key
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" readOnly value={form.idempotency_key} style={{ ...inp, flex: 1 }} />
                  <button type="button" onClick={() => set('idempotency_key', generateKey())}
                    style={{ ...btnGhost }}>New</button>
                </div>
              </label>
              <button type="submit" disabled={processing} style={btnPrimary}>
                {processing ? 'Processing…' : 'Submit payment'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyStepup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 14, borderRadius: 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={16} />
                <span>Medium risk anomaly detected. Risk-Adaptive Step-Up 2FA challenge triggered.</span>
              </div>
              <label style={{ fontSize: 12, color: '#9ca3af' }}>Verification Code (Sent to your dev environment terminal)
                <input type="text" maxLength={6} required value={smsCode}
                  onChange={e => setSmsCode(e.target.value)} placeholder="000000"
                  style={inp} />
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={verifying} style={{ ...btnPrimary, flex: 1 }}>
                  {verifying ? 'Verifying...' : 'Verify & Authenticate'}
                </button>
                <button type="button" onClick={() => setStepupRequired(false)} style={{ ...btnGhost, padding: '0 16px' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {error && (
            <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', color: '#ef4444', fontSize: 13 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {result && (
            <div style={{ marginTop: 18, padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircle2 size={16} color={statusColor[result.status] || '#9ca3af'} />
                <strong style={{ color: statusColor[result.status] || '#fff' }}>{result.status}</strong>
                {result.is_duplicate && <span style={{ fontSize: 11, color: '#6b7280' }}>(duplicate)</span>}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{result.message}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                {result.txn_id} · risk {result.risk_score?.toFixed?.(2)} {result.provider_ref ? `· ${result.provider_ref}` : ''}
              </div>
              {result.fraud_explanation && (
                <button 
                  onClick={() => setSelectedExplanation(result.fraud_explanation)}
                  style={{
                    marginTop: 12, width: '100%', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: 'rgba(212,175,55,0.05)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 6,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <Sparkles size={12} /> View Glass-Box Scoring Explanation
                </button>
              )}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 22, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 14 }}>
            Security in this flow
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {securityFeatures.map((f) => (
              <div key={f.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <f.icon size={18} color="#6366f1" style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Side explanation drawer */}
      {selectedExplanation && (
        <ExplainPanel explanation={selectedExplanation} onClose={() => setSelectedExplanation(null)} />
      )}
    </div>
  );
}

const inp = { width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, outline: 'none' };
const btnPrimary = { padding: '11px 16px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnGhost = { padding: '0 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, cursor: 'pointer' };
