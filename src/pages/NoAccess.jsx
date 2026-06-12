import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../auth/permissions';

export default function NoAccess() {
  const { user } = useAuth();
  return (
    <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: '60vh', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ShieldAlert size={26} color="#ef4444" />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Access denied</h1>
      <div style={{ fontSize: 13, color: '#9ca3af', maxWidth: 420 }}>
        Your role (<strong style={{ color: '#d4af37' }}>{ROLE_LABELS[user?.role] || 'User'}</strong>)
        does not have permission for this page. If you need access, ask an administrator to grant it.
      </div>
    </div>
  );
}
