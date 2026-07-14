import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, AlertCircle, Trash2, Eye, Play, Sparkles } from 'lucide-react';
import { fraudRulesApi } from '../api/client';

export default function FraudRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState('flag');
  const [conditions, setConditions] = useState([
    { field: 'amount', operator: '>', value: 500.0, combinator: 'and' }
  ]);

  // Backtest result state
  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestingId, setBacktestingId] = useState(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const data = await fraudRulesApi.list();
      setRules(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCondition = () => {
    setConditions([...conditions, { field: 'amount', operator: '>', value: 100.0, combinator: 'and' }]);
  };

  const handleRemoveCondition = (index) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleConditionChange = (index, key, val) => {
    const updated = [...conditions];
    updated[index][key] = key === 'value' ? parseFloat(val) || 0 : val;
    setConditions(updated);
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Rule name is required');
      return;
    }

    try {
      const payload = {
        name,
        description,
        action,
        conditions
      };
      await fraudRulesApi.create(payload);
      setSuccess('Rule created successfully!');
      setName('');
      setDescription('');
      setAction('flag');
      setConditions([{ field: 'amount', operator: '>', value: 500.0, combinator: 'and' }]);
      fetchRules();
    } catch (err) {
      setError(err.message || 'Failed to create rule');
    }
  };

  const handleToggleRule = async (id) => {
    try {
      await fraudRulesApi.toggle(id);
      fetchRules();
    } catch (err) {
      setError(err.message || 'Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await fraudRulesApi.delete(id);
      setSuccess('Rule deleted.');
      fetchRules();
    } catch (err) {
      setError(err.message || 'Failed to delete rule');
    }
  };

  const handleBacktest = async (id) => {
    try {
      setBacktestingId(id);
      setBacktestResult(null);
      const res = await fraudRulesApi.backtest(id);
      setBacktestResult(res);
    } catch (err) {
      setError(err.message || 'Failed to run backtest');
    } finally {
      setBacktestingId(null);
    }
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Fraud Rules Studio</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Author and test custom risk policy logic in real-time</div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} />
          {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
        
        {/* Rules List & Testing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Rules List */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Existing Active & Inactive Rules</h3>
            
            {loading ? (
              <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: 24 }}>Loading rules...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {rules.map((rule) => (
                  <div key={rule.id} style={{
                    padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 12
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{rule.name}</span>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{rule.description}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={`badge ${rule.action === 'block' ? 'badge-blocked' : 'badge-flagged'}`}>{rule.action}</span>
                        <button 
                          onClick={() => handleToggleRule(rule.id)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            background: rule.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                            color: rule.is_active ? '#4ade80' : '#9ca3af',
                            border: rule.is_active ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)'
                          }}
                        >
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>

                    {/* Condition details */}
                    <div style={{ background: '#0e0e0e', padding: '10px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Conditions:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                        {Array.isArray(rule.conditions) ? rule.conditions.map((cond, idx) => (
                          <div key={idx} style={{
                            fontSize: 11, color: '#d4af37', background: 'rgba(212,175,55,0.05)',
                            border: '1px solid rgba(212,175,55,0.15)', padding: '3px 8px', borderRadius: 4, fontFamily: 'monospace'
                          }}>
                            {idx > 0 && <span style={{ color: '#6b7280', marginRight: 4 }}>{cond.combinator}</span>}
                            {cond.field} {cond.operator} {cond.value}
                          </div>
                        )) : <span style={{ fontSize: 11, color: '#6b7280' }}>No conditions configured</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 10, marginTop: 4 }}>
                      <button 
                        onClick={() => handleBacktest(rule.id)}
                        disabled={backtestingId === rule.id}
                        className="btn-ghost" 
                        style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Play size={11} /> {backtestingId === rule.id ? 'Running Backtest...' : 'Run Backtest'}
                      </button>
                      <button 
                        onClick={() => handleDeleteRule(rule.id)}
                        className="btn-ghost" 
                        style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </div>
                ))}

                {rules.length === 0 && (
                  <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: 20 }}>No custom rules found. Use the creator panel to author one.</div>
                )}
              </div>
            )}
          </div>

          {/* Backtest Results Display */}
          {backtestResult && (
            <div className="card" style={{ padding: 20, animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Sparkles size={16} color="#d4af37" />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Backtest Simulation Summary</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 12, borderRadius: 6, background: '#0e0e0e' }}>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Transactions Scanned</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 4 }}>{backtestResult.total_tested}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 6, background: '#0e0e0e' }}>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Would Flag</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#f97316', marginTop: 4 }}>{backtestResult.would_flag}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 6, background: '#0e0e0e' }}>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Would Block</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>{backtestResult.would_block}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 6, background: '#0e0e0e' }}>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>False Positives (Est)</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#f87171', marginTop: 4 }}>{backtestResult.false_positive_estimate}</div>
                </div>
              </div>

              {backtestResult.sample_matches && backtestResult.sample_matches.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Sample Matches</h4>
                  <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {backtestResult.sample_matches.map((m, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: 8, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 4 }}>
                        <span style={{ fontFamily: 'monospace', color: '#d4af37' }}>{m.txn_id}</span>
                        <span style={{ color: '#fff' }}>${m.amount.toFixed(2)}</span>
                        <span style={{ color: m.status === 'blocked' ? '#ef4444' : '#f97316' }}>Original: {m.status}</span>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Rule would: {m.would_be}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Creator Panel */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Rule Authoring</h3>
          <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Rule Name</label>
              <input 
                className="input-field" 
                placeholder="e.g. Excessive Velocity Guard" 
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Description</label>
              <textarea 
                className="input-field" 
                style={{ height: 60, resize: 'none' }}
                placeholder="Brief description of the policy logic..." 
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Action</label>
              <select 
                className="input-field" 
                value={action}
                onChange={e => setAction(e.target.value)}
              >
                <option value="flag">FLAG (Send to Review Queue)</option>
                <option value="block">BLOCK (Instant Deny)</option>
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Condition Block</span>
                <button type="button" onClick={handleAddCondition} style={{ display: 'flex', alignItems: 'center', gap: 3, border: 'none', background: 'transparent', color: '#d4af37', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={10} /> Add condition
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {conditions.map((cond, idx) => (
                  <div key={idx} style={{ padding: 10, borderRadius: 6, background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {idx > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase' }}>Combinator</span>
                        <select 
                          style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#fff' }}
                          value={cond.combinator}
                          onChange={e => handleConditionChange(idx, 'combinator', e.target.value)}
                        >
                          <option value="and">AND</option>
                          <option value="or">OR</option>
                        </select>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 6 }}>
                      <select 
                        style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 6px', fontSize: 11, color: '#fff' }}
                        value={cond.field}
                        onChange={e => handleConditionChange(idx, 'field', e.target.value)}
                      >
                        <option value="amount">amount</option>
                        <option value="risk_score">risk_score</option>
                        <option value="velocity_1h">velocity_1h</option>
                        <option value="velocity_24h">velocity_24h</option>
                        <option value="amount_zscore">amount_zscore</option>
                        <option value="hour_of_day">hour_of_day</option>
                      </select>
                      <select 
                        style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 6px', fontSize: 11, color: '#fff' }}
                        value={cond.operator}
                        onChange={e => handleConditionChange(idx, 'operator', e.target.value)}
                      >
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                        <option value="==">==</option>
                        <option value="!=">!=</option>
                      </select>
                      <input 
                        type="number"
                        step="any"
                        style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 6px', fontSize: 11, color: '#fff', width: '100%' }}
                        value={cond.value}
                        onChange={e => handleConditionChange(idx, 'value', e.target.value)}
                      />
                    </div>
                    {conditions.length > 1 && (
                      <button type="button" onClick={() => handleRemoveCondition(idx)} style={{ color: '#ef4444', background: 'transparent', border: 'none', fontSize: 10, cursor: 'pointer', alignSelf: 'flex-end', padding: 2 }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" style={{
              marginTop: 10, padding: '10px 16px', borderRadius: 8, background: '#d4af37', color: '#0b0b0b',
              fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: 13
            }}>
              Deploy Custom Rule
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
