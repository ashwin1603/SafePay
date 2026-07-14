import { useState, useEffect } from 'react';
import { RefreshCw, ShieldCheck, Lock, Activity, CreditCard, CheckCircle2, AlertCircle, ExternalLink, Loader2, Banknote, Smartphone } from 'lucide-react';
import { cashfreeApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

// ── Cashfree JS SDK loader ────────────────────────────────────────────────────
// The SDK is loaded dynamically from the Cashfree CDN (sandbox version).
const CF_SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';

function useCashfreeSDK() {
  const [ready, setReady] = useState(!!window.Cashfree);

  useEffect(() => {
    if (window.Cashfree) { setReady(true); return; }
    const script = document.createElement('script');
    script.src = CF_SDK_URL;
    script.async = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
    return () => {};
  }, []);

  return ready;
}

// ── Static data ───────────────────────────────────────────────────────────────
const securityFeatures = [
  { icon: ShieldCheck, label: 'JWT Authentication', desc: 'Short-lived HS256 access tokens (15 min) + refresh' },
  { icon: Activity,   label: 'AI Fraud Detection',  desc: 'IsolationForest anomaly scoring after every payment' },
  { icon: RefreshCw,  label: 'Idempotency Guard',   desc: 'Exactly-once processing — safe to retry' },
  { icon: Lock,       label: 'Rate Limiting',        desc: 'Per-client sliding-window request limiter' },
  { icon: CreditCard, label: 'Cashfree Sandbox',     desc: 'Payments processed via Cashfree sandbox — no real money' },
];

// Cashfree sandbox test card data (from docs)
const TEST_CARDS = [
  { label: 'Visa Debit (Retail)',      number: '4706131211212123', expiry: '03/2028', cvv: '123' },
  { label: 'Visa Credit (Retail)',     number: '4576238912771450', expiry: '03/2028', cvv: '123' },
  { label: 'Mastercard Debit',         number: '5409162669381034', expiry: '03/2028', cvv: '123' },
  { label: 'Mastercard Credit',        number: '5105105105105100', expiry: '03/2028', cvv: '123' },
];

const STATUS_COLOR = {
  COMPLETED: '#22c55e',
  FLAGGED:   '#f59e0b',
  BLOCKED:   '#ef4444',
  DECLINED:  '#ef4444',
  PAID:      '#22c55e',
  ACTIVE:    '#60a5fa',
  EXPIRED:   '#6b7280',
};

// ── Step indicator ─────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Enter Details', 'Cashfree Checkout', 'Result'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: i < current ? '#22c55e' : i === current ? '#d4af37' : 'rgba(255,255,255,0.08)',
              border: `2px solid ${i < current ? '#22c55e' : i === current ? '#d4af37' : 'rgba(255,255,255,0.12)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              color: i <= current ? '#000' : '#4b5563',
              transition: 'all 0.3s',
            }}>
              {i < current ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize: 11, fontWeight: i === current ? 600 : 400,
              color: i === current ? '#d4af37' : i < current ? '#22c55e' : '#4b5563',
              whiteSpace: 'nowrap',
            }}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: 1, margin: '0 12px',
              background: i < current ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.06)',
              transition: 'background 0.3s',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProcessPayment() {
  const { user } = useAuth();
  const sdkReady = useCashfreeSDK();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    amount: '',
    description: '',
    customer_name: user?.email?.split('@')[0] || 'SafePay User',
    customer_phone: '9999999999',
  });
  const [result, setResult] = useState(null);   // final verification result
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [cfOrder, setCfOrder] = useState(null);  // { order_id, payment_session_id }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Check for Cashfree return redirect ───────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    const isCfReturn = params.get('cashfree') === 'return';
    if (isCfReturn && orderId) {
      // Clear params from URL without a reload
      window.history.replaceState({}, '', window.location.pathname);
      verifyOrder(orderId);
    }
  }, []);

  // ── Step 1: create order on our backend ──────────────────────────────────────
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!sdkReady) { setError('Cashfree SDK is still loading — please wait a moment.'); return; }
    setError(''); setLoading(true);
    try {
      const data = await cashfreeApi.createOrder({
        amount: parseFloat(form.amount),
        description: form.description,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: user?.email || 'test@example.com',
        return_url: `${window.location.origin}/process?cashfree=return`,
      });
      setCfOrder(data);
      setStep(1);
      launchCashfreeCheckout(data);
    } catch (err) {
      setError(err.message || 'Failed to create Cashfree order.');
    } finally {
      setLoading(false);
    }
  };

  // ── Launch Cashfree hosted checkout UI ───────────────────────────────────────
  const launchCashfreeCheckout = (orderData) => {
    const cashfree = window.Cashfree({ mode: 'sandbox' });
    cashfree.checkout({
      paymentSessionId: orderData.payment_session_id,
      redirectTarget: '_self',   // redirect in the same tab
    });
  };

  // ── Step 2: verify with our backend after redirect ───────────────────────────
  const verifyOrder = async (orderId) => {
    setStep(2);
    setLoading(true);
    setError('');
    try {
      const data = await cashfreeApi.verifyOrder({ order_id: orderId });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(0); setResult(null); setError(''); setCfOrder(null);
    setForm({ amount: '', description: '', customer_name: user?.email?.split('@')[0] || 'SafePay User', customer_phone: '9999999999' });
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Process Payment</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          Powered by Cashfree sandbox ·{' '}
          <strong style={{ color: '#9ca3af' }}>{user?.email}</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, maxWidth: 960, alignItems: 'start' }}>
        {/* Left panel — form / result */}
        <div className="card" style={{ padding: '28px' }}>
          <Steps current={step} />

          {/* ── Step 0: Payment form ── */}
          {step === 0 && (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 22, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 14 }}>
                Payment details
              </div>
              <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label style={lbl}>
                  Amount (INR)
                  <input
                    type="number" step="0.01" min="1" required
                    value={form.amount} onChange={e => set('amount', e.target.value)}
                    placeholder="500.00" style={inp}
                  />
                </label>

                <label style={lbl}>
                  Description
                  <input
                    type="text" maxLength={500}
                    value={form.description} onChange={e => set('description', e.target.value)}
                    placeholder="Invoice #1234" style={inp}
                  />
                </label>

                <label style={lbl}>
                  Your name
                  <input
                    type="text" required
                    value={form.customer_name} onChange={e => set('customer_name', e.target.value)}
                    style={inp}
                  />
                </label>

                <label style={lbl}>
                  Phone number
                  <input
                    type="tel" required pattern="[6-9]\d{9}"
                    value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)}
                    placeholder="9999999999" style={inp}
                  />
                </label>

                <button type="submit" disabled={loading || !sdkReady} style={btnPrimary}>
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      Creating order…
                    </span>
                  ) : !sdkReady ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      Loading SDK…
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Banknote size={15} /> Pay with Cashfree
                    </span>
                  )}
                </button>

                {error && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#ef4444', fontSize: 13 }}>
                    <AlertCircle size={15} /> {error}
                  </div>
                )}
              </form>
            </>
          )}

          {/* ── Step 1: Redirect in progress ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '32px 0', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(212,175,55,0.1)',
                border: '1px solid rgba(212,175,55,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Loader2 size={28} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Redirecting to Cashfree…</div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                  You will be redirected to the Cashfree secure checkout page.<br />
                  Complete the payment there and you'll be brought back automatically.
                </div>
              </div>
              {cfOrder && (
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#4b5563', background: 'rgba(255,255,255,0.03)', padding: '8px 14px', borderRadius: 8 }}>
                  Order ID: {cfOrder.order_id}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Loading verification ── */}
          {step === 2 && loading && !result && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0', textAlign: 'center' }}>
              <Loader2 size={32} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 14, color: '#9ca3af' }}>Verifying payment with Cashfree…</div>
            </div>
          )}

          {/* ── Step 2: Result ── */}
          {step === 2 && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Status banner */}
              <div style={{
                padding: '20px 22px', borderRadius: 12,
                background: `${STATUS_COLOR[result.safepay_status] || STATUS_COLOR[result.order_status] || '#6b7280'}15`,
                border: `1px solid ${STATUS_COLOR[result.safepay_status] || STATUS_COLOR[result.order_status] || '#6b7280'}30`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <CheckCircle2 size={20} color={STATUS_COLOR[result.safepay_status] || '#9ca3af'} />
                  <strong style={{ fontSize: 16, color: STATUS_COLOR[result.safepay_status] || '#fff' }}>
                    {result.safepay_status || result.order_status}
                  </strong>
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>{result.message}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {result.txn_id && (
                    <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
                      SafePay TXN: <span style={{ color: '#d4af37' }}>{result.txn_id}</span>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
                    Cashfree Order: <span style={{ color: '#9ca3af' }}>{result.order_id}</span>
                  </div>
                  {result.risk_score !== null && result.risk_score !== undefined && (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      AI Risk Score:{' '}
                      <span style={{ color: result.risk_score > 0.8 ? '#ef4444' : result.risk_score > 0.5 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                        {(result.risk_score * 100).toFixed(0)} / 100
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#ef4444', fontSize: 13 }}>
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <button onClick={reset} style={btnGhost}>Make another payment</button>
            </div>
          )}

          {step === 2 && !loading && !result && error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#ef4444', fontSize: 13 }}>
                <AlertCircle size={15} /> {error}
              </div>
              <button onClick={reset} style={btnGhost}>Try again</button>
            </div>
          )}
        </div>

        {/* Right panel — sandbox info + test cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Security features */}
          <div className="card" style={{ padding: '22px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 12 }}>
              Security in this flow
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {securityFeatures.map(f => (
                <div key={f.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <f.icon size={17} color="#d4af37" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: '#e5e7eb', fontWeight: 600 }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Test card reference */}
          <div className="card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Sandbox Test Cards</div>
              <a
                href="https://www.cashfree.com/docs/payments/online/resources/sandbox-environment"
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#d4af37', textDecoration: 'none' }}
              >
                Docs <ExternalLink size={10} />
              </a>
            </div>

            {/* Common details */}
            <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Common for all test cards</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {[['Expiry', '03/2028'], ['CVV', '123'], ['Name', 'Test'], ['OTP', '111000']].map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>{k}: </span>
                    <span style={{ color: '#e5e7eb', fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Test cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TEST_CARDS.map(card => (
                <div key={card.number} style={{
                  background: '#141414', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#e5e7eb', letterSpacing: '0.08em' }}>
                    {card.number.replace(/(\d{4})/g, '$1 ').trim()}
                  </div>
                </div>
              ))}
            </div>

            {/* UPI section */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Test UPI VPAs
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { vpa: 'testsuccess@gocash', label: 'Success' },
                  { vpa: 'testfailure@gocash', label: 'Fail' },
                ].map(u => (
                  <div key={u.vpa} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#e5e7eb' }}>{u.vpa}</div>
                    <span style={{ fontSize: 11, color: u.label === 'Success' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{u.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Inline styles ──────────────────────────────────────────────────────────────
const lbl = { fontSize: 12, color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: 6 };
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '12px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #d4af37, #b8972e)', color: '#000', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.2s' };
const btnGhost   = { padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, fontSize: 12, cursor: 'pointer' };
