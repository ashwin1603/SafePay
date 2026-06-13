import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, HelpCircle, RefreshCw, Send, AlertTriangle } from 'lucide-react';
import { consortiumApi } from '../api/client';

export default function Consortium() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Sync peer state
  const [peerId, setPeerId] = useState('');
  const [peerFilter, setPeerFilter] = useState('');
  const [peerSize, setPeerSize] = useState(8192);
  const [peerHashes, setPeerHashes] = useState(7);
  const [syncing, setSyncing] = useState(false);

  // Cross check state
  const [checkValue, setCheckValue] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await consortiumApi.status();
      setStatus(res);
    } catch (err) {
      setError(err.message || 'Failed to load consortium network configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSyncing(true);

    if (!peerId.trim() || !peerFilter.trim()) {
      setError('Peer ID and base64 Bloom filter payload are required');
      setSyncing(false);
      return;
    }

    try {
      await consortiumApi.sync(peerId.trim(), peerFilter.trim(), peerSize, peerHashes);
      setSuccess(`Successfully synchronized node with peer ${peerId}`);
      setPeerId('');
      setPeerFilter('');
      fetchStatus();
    } catch (err) {
      setError(err.message || 'Failed to sync with peer filter');
    } finally {
      setSyncing(false);
    }
  };

  const handleCheck = async (e) => {
    e.preventDefault();
    setError('');
    setCheckResult(null);
    setChecking(true);

    if (!checkValue.trim()) {
      setError('Please provide a signal to hash and inspect');
      setChecking(false);
      return;
    }

    try {
      // Backend expects a list of hashed signals
      // To simulate, we can compute the hash locally or check how backend checks it.
      // Actually, backend has check_signals endpoint which checks *hashed* signals.
      // If we don't have local hash, we can hash the string. But the backend router /consortium/check
      // takes the input directly from payload.hashed_signals.
      // Let's check how the backend hash_signal is implemented:
      // It hashes using HMAC sha256 with settings.CONSORTIUM_SECRET.
      // The backend /consortium/check checks raw check value?
      // Wait, in consortium_router.py:
      // @router.post("/check", response_model=SignalCheckResponse)
      // def check_signals(payload: SignalCheckRequest, principal=Depends(require_permission(CONSORTIUM_MANAGE))):
      //    matches = []
      //    for sig in payload.hashed_signals:
      //        is_match = consortium_svc.check_signal(sig) # Wait! check_signal takes raw_value and hashes it inside!
      //        # Let's verify:
      //        # def check_signal(raw_value: str) -> bool:
      //        #     hashed = hash_signal(raw_value)
      //        # Yes! check_signal hashes the raw value inside. So payload.hashed_signals should actually be the raw strings,
      //        # or they are hashed? Wait, the schema is:
      //        # class SignalCheckRequest(BaseModel):
      //        #     hashed_signals: List[str]
      //        # But inside router check_signals: consortium_svc.check_signal(sig) -> check_signal(sig) -> hashed = hash_signal(sig).
      //        # So we can pass raw string (like idempotency key) or actual token to inspect.
      
      const res = await consortiumApi.check([checkValue.trim()]);
      setCheckResult(res);
    } catch (err) {
      setError(err.message || 'Failed to inspect signals');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '100px 0' }}>Loading consortium status...</div>;
  }

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Privacy-Preserving Consortium Network</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Sync cryptographic Bloom filters and inspect peer signals securely without decrypting customer data</div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', fontSize: 13 }}>
          {success}
        </div>
      )}

      {/* Consortium Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Consortium Mode</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: status?.enabled ? '#22c55e' : '#f97316', marginTop: 8 }}>
            {status?.enabled ? 'ONLINE & ACTIVE' : 'LOCAL ONLY (DEMO)'}
          </div>
        </div>
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Local Filter Size / Items</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 8 }}>
            {status?.local_filter_size} bits / {status?.local_item_count} items
          </div>
        </div>
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Connected Peer Nodes</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 8 }}>
            {status?.peer_count} peers synced
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        
        {/* Sync Peer Section */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Sync Peer Bloom Filter</h3>
          <form onSubmit={handleSync} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Peer Node Identifier</label>
              <input 
                className="input-field" 
                placeholder="e.g. peer_bank_alpha" 
                value={peerId}
                onChange={e => setPeerId(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Filter Payload (Base64)</label>
              <textarea 
                className="input-field" 
                style={{ height: 80, resize: 'none', fontFamily: 'monospace' }}
                placeholder="Paste the Base64 representation of the Bloom filter..." 
                value={peerFilter}
                onChange={e => setPeerFilter(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Filter Size (bits)</label>
                <input 
                  type="number"
                  className="input-field" 
                  value={peerSize}
                  onChange={e => setPeerSize(parseInt(e.target.value) || 8192)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Hash Count</label>
                <input 
                  type="number"
                  className="input-field" 
                  value={peerHashes}
                  onChange={e => setPeerHashes(parseInt(e.target.value) || 7)}
                />
              </div>
            </div>

            <button type="submit" disabled={syncing} style={{
              marginTop: 10, padding: '10px 16px', borderRadius: 8, background: '#d4af37', color: '#0b0b0b',
              fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: 13
            }}>
              {syncing ? 'Synchronizing payload...' : 'Import & Merge Peer Filter'}
            </button>
          </form>
        </div>

        {/* Cross Check Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Secure Signal Inspector</h3>
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, lineHeight: 1.4 }}>
              Check if an idempotency key or identifier exists in the shared database of malicious signals across all institutions.
            </p>
            <form onSubmit={handleCheck} style={{ display: 'flex', gap: 8 }}>
              <input 
                className="input-field" 
                placeholder="e.g. TXN-ID-OR-KEY" 
                value={checkValue}
                onChange={e => setCheckValue(e.target.value)}
              />
              <button type="submit" disabled={checking} style={{
                padding: '10px 16px', borderRadius: 8, background: '#d4af37', color: '#0b0b0b',
                fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}>
                <Send size={14} /> Inspect
              </button>
            </form>

            {checkResult && (
              <div style={{ marginTop: 20, padding: 14, borderRadius: 8, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Check Verdict</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: checkResult.total_matches > 0 ? '#ef4444' : '#22c55e'
                  }}>
                    {checkResult.total_matches > 0 ? 'MALICIOUS SIGNAL MATCHED' : 'CLEAN / NOT FOUND'}
                  </span>
                </div>
                {checkResult.matches && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {checkResult.matches.map((m, idx) => (
                      <div key={idx} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', color: '#9ca3af' }}>
                        <span>Signal: <span style={{ fontFamily: 'monospace' }}>{m.signal}</span></span>
                        <span style={{ color: m.match ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{m.match ? 'BLACKLISTED' : 'OK'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Peer Node Directory */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Active Peer Node Sync Registry</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {status?.peers && status.peers.map((peer, idx) => (
                <div key={idx} style={{ fontSize: 12, padding: 10, borderRadius: 6, background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.03)', color: '#fff', fontFamily: 'monospace' }}>
                  {peer}
                </div>
              ))}
              {(!status?.peers || status.peers.length === 0) && (
                <div style={{ fontSize: 11, color: '#4b5563', textAlign: 'center', padding: '12px 0' }}>No connected peers registered.</div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
