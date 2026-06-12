// Mock data for SafePay Flow dashboard

export const statsData = [
  {
    id: 1,
    label: 'Total Transactions',
    value: '$445,280',
    change: '+12.5%',
    trend: 'up',
    icon: 'DollarSign',
    sub: 'vs last month',
  },
  {
    id: 2,
    label: 'Success Rate',
    value: '98.7%',
    change: '+0.3%',
    trend: 'up',
    icon: 'CheckCircle',
    sub: 'all transactions',
  },
  {
    id: 3,
    label: 'Fraud Blocked',
    value: '79',
    change: '-8.3%',
    trend: 'down-good',
    icon: 'ShieldAlert',
    sub: 'threats neutralized',
  },
  {
    id: 4,
    label: 'Avg Response Time',
    value: '142ms',
    change: '-15.2%',
    trend: 'down-good',
    icon: 'Zap',
    sub: 'P95 latency',
  },
];

export const txnVolumeData = [
  { time: '00:00', volume: 34200 },
  { time: '02:00', volume: 22100 },
  { time: '04:00', volume: 18900 },
  { time: '06:00', volume: 29400 },
  { time: '08:00', volume: 52300 },
  { time: '10:00', volume: 78600 },
  { time: '12:00', volume: 91200 },
  { time: '14:00', volume: 86400 },
  { time: '16:00', volume: 94700 },
  { time: '18:00', volume: 88100 },
  { time: '20:00', volume: 67300 },
  { time: '22:00', volume: 45600 },
  { time: '23:59', volume: 38900 },
];

export const fraudWeeklyData = [
  { day: 'Mon', blocked: 12, flagged: 8 },
  { day: 'Tue', blocked: 19, flagged: 14 },
  { day: 'Wed', blocked: 8, flagged: 6 },
  { day: 'Thu', blocked: 24, flagged: 17 },
  { day: 'Fri', blocked: 31, flagged: 22 },
  { day: 'Sat', blocked: 16, flagged: 11 },
  { day: 'Sun', blocked: 9, flagged: 7 },
];

export const fraudAlerts = [
  {
    id: 'TXN-9823',
    level: 'HIGH RISK',
    levelClass: 'text-red-400',
    bgClass: 'bg-red-500/10 border-red-500/20',
    message: 'Anomalous transaction pattern detected — velocity spike 340% above baseline',
    amount: '$12,450.00',
    time: '2 min ago',
  },
  {
    id: 'TXN-9804',
    level: 'BLOCKED',
    levelClass: 'text-red-500',
    bgClass: 'bg-red-600/10 border-red-600/20',
    message: 'IP mismatch — originating country differs from registered location (RU → US)',
    amount: '$5,200.00',
    time: '8 min ago',
  },
  {
    id: 'TXN-9791',
    level: 'REVIEW',
    levelClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500/10 border-yellow-500/20',
    message: '3 failed authentication attempts before success — possible credential stuffing',
    amount: '$880.00',
    time: '14 min ago',
  },
];

export const transactions = [
  { txn_id: 'TXN-10042', user_id: 'USR-4421', amount: '$3,200.00', status: 'completed', risk_score: 12, timestamp: '2026-04-10 19:42:01' },
  { txn_id: 'TXN-10041', user_id: 'USR-3318', amount: '$780.50', status: 'processing', risk_score: 28, timestamp: '2026-04-10 19:38:14' },
  { txn_id: 'TXN-10040', user_id: 'USR-8812', amount: '$12,450.00', status: 'flagged', risk_score: 82, timestamp: '2026-04-10 19:36:55' },
  { txn_id: 'TXN-10039', user_id: 'USR-5520', amount: '$220.00', status: 'completed', risk_score: 5, timestamp: '2026-04-10 19:31:22' },
  { txn_id: 'TXN-10038', user_id: 'USR-9901', amount: '$5,200.00', status: 'blocked', risk_score: 97, timestamp: '2026-04-10 19:28:44' },
  { txn_id: 'TXN-10037', user_id: 'USR-1127', amount: '$1,850.75', status: 'completed', risk_score: 18, timestamp: '2026-04-10 19:24:10' },
  { txn_id: 'TXN-10036', user_id: 'USR-6644', amount: '$670.00', status: 'processing', risk_score: 34, timestamp: '2026-04-10 19:19:33' },
  { txn_id: 'TXN-10035', user_id: 'USR-2299', amount: '$880.00', status: 'flagged', risk_score: 68, timestamp: '2026-04-10 19:14:05' },
  { txn_id: 'TXN-10034', user_id: 'USR-7733', amount: '$4,100.00', status: 'completed', risk_score: 9, timestamp: '2026-04-10 19:09:48' },
  { txn_id: 'TXN-10033', user_id: 'USR-3344', amount: '$290.00', status: 'completed', risk_score: 7, timestamp: '2026-04-10 19:02:17' },
  { txn_id: 'TXN-10032', user_id: 'USR-5511', amount: '$7,890.00', status: 'blocked', risk_score: 91, timestamp: '2026-04-10 18:55:30' },
  { txn_id: 'TXN-10031', user_id: 'USR-8820', amount: '$445.50', status: 'processing', risk_score: 41, timestamp: '2026-04-10 18:48:22' },
];

export const users = [
  { user_id: 'USR-4421', email: 'j.harrison@corp.io', status: 'active', transactions: 142, total_spent: '$284,320', risk_level: 'low' },
  { user_id: 'USR-3318', email: 'm.chen@trading.co', status: 'active', transactions: 98, total_spent: '$178,500', risk_level: 'low' },
  { user_id: 'USR-8812', email: 'a.volkov@anon.net', status: 'flagged', transactions: 23, total_spent: '$42,100', risk_level: 'high' },
  { user_id: 'USR-5520', email: 'r.patel@finco.in', status: 'active', transactions: 317, total_spent: '$521,800', risk_level: 'low' },
  { user_id: 'USR-9901', email: 'unknown@proxy.ru', status: 'blocked', transactions: 7, total_spent: '$18,200', risk_level: 'critical' },
  { user_id: 'USR-1127', email: 's.johnson@payments.us', status: 'active', transactions: 204, total_spent: '$396,700', risk_level: 'low' },
  { user_id: 'USR-6644', email: 'k.williams@bankx.com', status: 'active', transactions: 88, total_spent: '$134,900', risk_level: 'medium' },
  { user_id: 'USR-2299', email: 'd.kim@tradex.kr', status: 'flagged', transactions: 51, total_spent: '$89,200', risk_level: 'medium' },
];

export const systemMetrics = {
  cpu: 34,
  memory: 61,
  dbConnections: 47,
  requestsPerMin: 2840,
};

export const systemPerfData = [
  { time: '10:00', cpu: 22, memory: 48 },
  { time: '11:00', cpu: 29, memory: 52 },
  { time: '12:00', cpu: 45, memory: 58 },
  { time: '13:00', cpu: 38, memory: 55 },
  { time: '14:00', cpu: 51, memory: 63 },
  { time: '15:00', cpu: 34, memory: 61 },
  { time: '16:00', cpu: 28, memory: 59 },
  { time: '17:00', cpu: 42, memory: 64 },
  { time: '18:00', cpu: 55, memory: 69 },
  { time: '19:00', cpu: 34, memory: 61 },
];

export const userStats = {
  total: 1284,
  active: 1187,
  flagged: 74,
  newLast30d: 143,
};
