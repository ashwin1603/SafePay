import { useState } from "react";
import { Hexagon, Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage({ onLogin }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, "user");
      }
      onLogin?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("admin@safepay.io");
    setPassword("Admin@1234");
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0b0b0b",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, opacity: 0.03,
        backgroundImage: "linear-gradient(rgba(212,175,55,1) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,1) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        pointerEvents: "none",
      }} />

      <div className="animate-fade-in" style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg, #d4af37, #8b6914)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
            boxShadow: "0 0 32px rgba(212,175,55,0.3)",
          }}>
            <Hexagon size={28} color="#0b0b0b" strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#d4af37", letterSpacing: "-0.02em" }}>
            SafePay Flow
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
            AI-Powered Payment Intelligence
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "32px 30px" }}>
          {/* Tabs */}
          <div style={{
            display: "flex", background: "#0f0f0f", borderRadius: 8,
            padding: 3, marginBottom: 28,
          }}>
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                style={{
                  flex: 1, padding: "8px", borderRadius: 6,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: "none", transition: "all 0.2s",
                  background: mode === m ? "rgba(212,175,55,0.12)" : "transparent",
                  color: mode === m ? "#d4af37" : "#6b7280",
                  textTransform: "capitalize",
                }}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Email Address
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="input-field"
                  type={showPass ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  {showPass ? <EyeOff size={14} color="#6b7280" /> : <Eye size={14} color="#6b7280" />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 8, padding: "10px 12px",
              }}>
                <AlertCircle size={14} color="#f87171" />
                <span style={{ fontSize: 12, color: "#f87171" }}>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn-gold"
              disabled={loading}
              style={{ padding: "13px", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}
            >
              {loading ? (
                <div style={{ width: 14, height: 14, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#0b0b0b", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              ) : (
                <ShieldCheck size={14} />
              )}
              {loading ? "Authenticating…" : mode === "login" ? "Sign In Securely" : "Create Account"}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 8 }}>Demo credentials</div>
            <button
              onClick={fillDemo}
              style={{
                background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)",
                borderRadius: 7, padding: "7px 16px", cursor: "pointer",
                fontSize: 11, color: "#d4af37", fontFamily: "monospace",
                transition: "all 0.2s",
              }}
            >
              admin@safepay.io · Admin@1234
            </button>
          </div>
        </div>

        {/* Security note */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <ShieldCheck size={11} color="#374151" />
          JWT-secured · bcrypt hashed · AI fraud detection active
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
