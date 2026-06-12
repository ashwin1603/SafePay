import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { P } from "./auth/permissions";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import ProcessPayment from "./pages/ProcessPayment";
import AdminUsers from "./pages/AdminUsers";
import AdminSystem from "./pages/AdminSystem";
import AuditLog from "./pages/AuditLog";
import NoAccess from "./pages/NoAccess";
import LoginPage from "./pages/LoginPage";
import ChatWidget from "./components/ChatWidget";

// Route-level guard: render the element only if the user holds `perm`.
function Guard({ perm, element }) {
  const { can } = useAuth();
  if (perm && !can(perm)) return <NoAccess />;
  return element;
}

function ProtectedLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <div style={{ color: '#6b7280', padding: 40 }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#0b0b0b" }}>
      <Topbar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: "auto", background: "#0b0b0b" }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Guard perm={P.TXN_READ_OWN} element={<Transactions />} />} />
            <Route path="/process" element={<Guard perm={P.PAYMENT_CREATE} element={<ProcessPayment />} />} />
            <Route path="/admin/system" element={<Guard perm={P.STATS_READ} element={<AdminSystem />} />} />
            <Route path="/admin/users" element={<Guard perm={P.USER_READ} element={<AdminUsers />} />} />
            <Route path="/admin/audit" element={<Guard perm={P.AUDIT_READ} element={<AuditLog />} />} />
            <Route path="*" element={<NoAccess />} />
          </Routes>
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}

function AppRoutes() {
  const { user, ready } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user && ready ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
