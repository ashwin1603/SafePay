import React, { useState, useEffect } from 'react';
import { AlertCircle, Play, ShieldAlert, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { simulationApi } from '../api/client';

export default function Simulation() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState('');
  const [count, setCount] = useState(20);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      const data = await simulationApi.scenarios();
      setScenarios(data);
      if (data.length > 0) setSelectedScenario(data[0].id);
    } catch (err) {
      setError(err.message || 'Failed to load simulation scenarios');
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setRunning(true);

    try {
      const res = await simulationApi.run(selectedScenario, count);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Simulation run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Attack Simulation Sandbox</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Trigger simulated synthetic attack patterns to validate risk model response rate thresholds</div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Scenario Selector & Form */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Configure Scenario</h3>
          
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: 12 }}>Loading simulation options...</div>
          ) : (
            <form onSubmit={handleRun} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Attack Pattern Scenario</label>
                <select 
                  className="input-field" 
                  value={selectedScenario} 
                  onChange={e => {
                    setSelectedScenario(e.target.value);
                    const sc = scenarios.find(s => s.id === e.target.value);
                    if (sc) setCount(sc.default_count);
                  }}
                >
                  {scenarios.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {selectedScenario && (
                <div style={{ fontSize: 11, color: '#6b7280', background: 'rgba(255,255,255,0.01)', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.03)', lineHeight: 1.4 }}>
                  {scenarios.find(s => s.id === selectedScenario)?.description}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Synthetic Transaction Count (1-100)</label>
                <input 
                  type="number"
                  className="input-field"
                  min="1"
                  max="100"
                  value={count}
                  onChange={e => setCount(parseInt(e.target.value) || 20)}
                />
              </div>

              <button type="submit" disabled={running} style={{
                marginTop: 10, padding: '10px 16px', borderRadius: 8, background: '#d4af37', color: '#0b0b0b',
                fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13
              }}>
                <Play size={14} fill="#0b0b0b" />
                {running ? 'Simulating Attack Vector...' : 'Trigger Attack Simulation'}
              </button>
            </form>
          )}
        </div>

        {/* Results Console */}
        <div className="card" style={{ padding: 20, minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Attack Simulation Output Log</h3>
          
          {!result && !running && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4b5563', gap: 8 }}>
              <Sparkles size={28} />
              <span style={{ fontSize: 12 }}>Ready. Select a scenario on the left to fire the simulation payload.</span>
            </div>
          )}

          {running && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: 12 }}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(212,175,55,0.1)', borderTopColor: '#d4af37', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>Deploying synthetic traffic scenario batch. Intercepting outcomes...</span>
            </div>
          )}

          {result && !running && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Scenario</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 4 }}>{result.scenario}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Fired</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 4 }}>{result.total}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Mitigated</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>{result.caught}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Mitigation Rate</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#d4af37', marginTop: 4 }}>{result.catch_rate}%</div>
                </div>
              </div>

              {/* Transactions list */}
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Generated Event Log</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {result.transactions.map((txn, idx) => (
                    <div key={idx} style={{
                      padding: '10px 12px', borderRadius: 6, background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.02)',
                      display: 'grid', gridTemplateColumns: '40px 80px 120px 1fr 40px', alignItems: 'center', fontSize: 11
                    }}>
                      <span style={{ color: '#4b5563', fontWeight: 600 }}>#{txn.index}</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>${txn.amount.toFixed(2)}</span>
                      <span style={{ color: txn.caught ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {txn.caught ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {txn.caught ? 'MITIGATED' : 'PASSED'}
                      </span>
                      <span style={{ color: '#9ca3af' }}>{txn.explanation}</span>
                      <span style={{ color: '#d4af37', fontWeight: 700, textAlign: 'right' }}>{Math.round(txn.risk_score * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
