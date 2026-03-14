import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { login as loginApi } from "../services/api";

const Logo = () => (
  <svg width={44} height={48} viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 4 L88 24 L88 70 L50 96 L12 70 L12 24 Z" fill="var(--text-primary)"/>
    <path d="M32 20 L45 14 L52 12" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round"/>
    <path d="M28 28 L42 21" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M26 36 L38 30" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round"/>
    <path d="M50 22 C42 22 36 30 36 42 C36 52 41 58 44 62 C46 65 50 72 50 72 C50 72 54 65 56 62 C59 58 64 52 64 42 C64 30 58 22 50 22 Z" fill="var(--bg)"/>
    <ellipse cx="47" cy="46" rx="5" ry="7" fill="var(--text-primary)"/>
  </svg>
);

export default function Login() {
  const { login, theme, toggleTheme } = useAuth();
  const navigate  = useNavigate();
  const [form,    setForm]    = useState({ email: "", password: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { data } = await loginApi(form);
      login(data);
      navigate(data.role === "hacker" ? "/hacker" : "/org");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      background:     "var(--bg)",
      minHeight:      "100vh",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      fontFamily:     "'Space Mono', monospace",
    }}>
      {/* Theme toggle — top right */}
      <button
        onClick={toggleTheme}
        style={{
          position:      "fixed",
          top:           16,
          right:         16,
          background:    "var(--raised)",
          border:        "1px solid var(--border-hi)",
          borderRadius:  3,
          color:         "var(--text-muted)",
          cursor:        "pointer",
          width:         30,
          height:        30,
          fontSize:      13,
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
        }}
      >
        {theme === "dark" ? "☀" : "◑"}
      </button>

      <div style={{ width: "100%", maxWidth: 380, padding: "0 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Logo />
          </div>
          <div style={{
            fontFamily:    "'Syne', sans-serif",
            fontSize:      22,
            fontWeight:    800,
            color:         "var(--text-primary)",
            letterSpacing: "0.14em",
          }}>
            BUGFORGE AI
          </div>
          <div style={{ color: "var(--text-faint)", fontSize: 9, letterSpacing: "0.22em", marginTop: 4 }}>
            VULNERABILITY INTELLIGENCE PLATFORM
          </div>
        </div>

        {/* Card */}
        <div style={{
          background:   "var(--surface)",
          border:       "1px solid var(--border)",
          borderRadius: 6,
          padding:      "28px 24px",
        }}>
          <div style={{
            color:         "var(--text-primary)",
            fontSize:      10,
            fontWeight:    700,
            letterSpacing: "0.16em",
            marginBottom:  20,
            paddingBottom: 14,
            borderBottom:  "1px solid var(--border)",
          }}>
            AUTHENTICATE
          </div>

          {error && (
            <div style={{
              background:   "var(--raised)",
              border:       "1px solid var(--border-hi)",
              borderLeft:   "3px solid var(--text-muted)",
              color:        "var(--text-secondary)",
              fontSize:     11,
              padding:      "9px 12px",
              borderRadius: 3,
              marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <Field
              label="EMAIL"
              type="email"
              value={form.email}
              onChange={v => setForm(p => ({ ...p, email: v }))}
            />
            <Field
              label="PASSWORD"
              type="password"
              value={form.password}
              onChange={v => setForm(p => ({ ...p, password: v }))}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width:         "100%",
                background:    loading ? "var(--raised)" : "var(--accent)",
                color:         loading ? "var(--text-faint)" : "var(--bg)",
                border:        "none",
                borderRadius:  3,
                padding:       "11px",
                fontFamily:    "'Space Mono', monospace",
                fontSize:      10,
                fontWeight:    700,
                letterSpacing: "0.14em",
                cursor:        loading ? "not-allowed" : "pointer",
                marginTop:     6,
                transition:    "all 0.12s",
              }}
            >
              {loading ? "AUTHENTICATING..." : "ENTER PLATFORM"}
            </button>
          </form>

          <div style={{
            borderTop:  "1px solid var(--border)",
            marginTop:  20,
            paddingTop: 16,
            textAlign:  "center",
            color:      "var(--text-faint)",
            fontSize:   10,
          }}>
            NO ACCOUNT?{" "}
            <Link to="/register" style={{
              color:          "var(--text-primary)",
              textDecoration: "none",
              fontWeight:     700,
            }}>
              REGISTER →
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, color: "var(--text-faint)", fontSize: 9, letterSpacing: "0.16em" }}>
          SECURED · ENCRYPTED · DECENTRALIZED
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, type = "text", value, onChange }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ color: "var(--text-faint)", fontSize: 9, letterSpacing: "0.18em", marginBottom: 5, fontWeight: 700 }}>
      {label}
    </div>
    <input
      type={type}
      value={value}
      required
      onChange={e => onChange(e.target.value)}
      style={{
        width:        "100%",
        padding:      "9px 12px",
        background:   "var(--inp-bg)",
        border:       "1px solid var(--inp-border)",
        borderRadius: 3,
        color:        "var(--inp-text)",
        fontFamily:   "'Space Mono', monospace",
        fontSize:     12,
        outline:      "none",
        boxSizing:    "border-box",
        transition:   "border-color 0.12s",
      }}
      onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
      onBlur={e  => (e.target.style.borderColor = "var(--inp-border)")}
    />
  </div>
);