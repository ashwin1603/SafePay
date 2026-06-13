import React, { useState, useEffect } from 'react';
import { AlertCircle, FileText, CheckCircle, ShieldAlert } from 'lucide-react';
import { appealApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { P } from '../auth/permissions';

export default function Appeals() {
  const { can } = useAuth();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isOperator = can(P.APPEAL_REVIEW);

  useEffect(() => {
    fetchAppeals();
  }, []);

  const fetchAppeals = async () => {
    try {
      setLoading(true);
      // If operator, fetch all appeals. If user, they check transactions table, but we can also display a status center.
      // Let's fetch all appeals since they have appeal status.
      const data = isOperator ? await appealApi.list() : await appealApi.list();
      setAppeals(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch appeals queue');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (txnId, decision) => {
    setError('');
    setSuccess('');
    try {
      await appealApi.review(txnId, decision);
      setSuccess(`Appeal for transaction #${txnId} has been successfully ${decision}.`);
      fetchAppeals();
    } catch (err) {
      setError(err.message || 'Failed to submit review decision');
    }
  };

  const statusColor = (status) => {
    if (status === 'approved') return '#22c55e';
    if (status === 'rejected') return '#ef4444';
    return '#f59e0b';
  };

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Appeals Center</h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          {isOperator ? 'Review and process customer transaction appeals' : 'Track and manage your submitted payment appeals'}
        </div>
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

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Appeals Queue</h3>

        {loading ? (
          <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Loading appeals data...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Original Verdict</th>
                  <th>Risk Score</th>
                  <th>Amount</th>
                  <th>Appeal Reason</th>
                  <th>Sync Status</th>
                  {isOperator && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {appeals.map((appeal) => (
                  <tr key={appeal.transaction_id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', color: '#d4af37', fontSize: 12 }}>{appeal.txn_id}</span>
                    </td>
                    <td>
                      <span className={`badge ${appeal.status === 'blocked' ? 'badge-blocked' : 'badge-flagged'}`}>{appeal.status}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#fff' }}>{Math.round(appeal.risk_score * 100)}%</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#fff' }}>${appeal.amount.toFixed(2)}</span>
                    </td>
                    <td style={{ maxWidth: 300, whiteSpace: 'normal', color: '#9ca3af', fontSize: 11, lineHeight: 1.4 }}>
                      {appeal.appeal_reason}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: 'rgba(255,255,255,0.02)', color: statusColor(appeal.appeal_status),
                        border: `1px solid ${statusColor(appeal.appeal_status)}`
                      }}>
                        {appeal.appeal_status.toUpperCase()}
                      </span>
                    </td>
                    {isOperator && (
                      <td>
                        {appeal.appeal_status === 'pending' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button 
                              onClick={() => handleReview(appeal.transaction_id, 'approved')}
                              style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)'
                              }}
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleReview(appeal.transaction_id, 'rejected')}
                              style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)'
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#4b5563' }}>Reviewed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {appeals.length === 0 && (
                  <tr>
                    <td colSpan={isOperator ? 7 : 6} style={{ textAlign: 'center', color: '#4b5563', padding: 32 }}>
                      No active appeals in queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
