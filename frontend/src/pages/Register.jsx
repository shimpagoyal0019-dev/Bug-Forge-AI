import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { register as registerApi } from "../services/api";

export default function Register() {
  const { login, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email:    "",
    password: "",
    role:     "hacker",
  });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { data } = await registerApi(form);
      login(data);
      navigate(data.role === "hacker" ? "/hacker" : "/org");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
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
      padding:        "24px 0",
    }}>
      {/* Theme toggle */}
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

      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
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
            CREATE ACCOUNT
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
            REGISTER
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
            <Field label="USERNAME"  value={form.username} onChange={v => f("username", v)} />
            <Field label="EMAIL"     type="email"    value={form.email}    onChange={v => f("email", v)} />
            <Field label="PASSWORD"  type="password" value={form.password} onChange={v => f("password", v)} />

            {/* Role selector */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "var(--text-faint)", fontSize: 9, letterSpacing: "0.18em", marginBottom: 8, fontWeight: 700 }}>
                ROLE
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { v: "hacker",       label: "HACKER",       sub: "Submit vulnerability reports" },
                  { v: "organization", label: "ORGANIZATION",  sub: "Review & pay bounties" },
                ].map(r => (
                  <div
                    key={r.v}
                    onClick={() => f("role", r.v)}
                    style={{
                      border:       `1px solid ${form.role === r.v ? "var(--border-focus)" : "var(--border)"}`,
                      padding:      "10px 12px",
                      borderRadius: 3,
                      cursor:       "pointer",
                      background:   form.role === r.v ? "var(--accent-dim)" : "transparent",
                      transition:   "all 0.12s",
                    }}
                  >
                    <div style={{
                      color:         form.role === r.v ? "var(--text-primary)" : "var(--text-faint)",
                      fontSize:      10,
                      fontWeight:    700,
                      letterSpacing: "0.1em",
                    }}>
                      {r.label}
                    </div>
                    <div style={{ color: "var(--text-faint)", fontSize: 9, marginTop: 2 }}>
                      {r.sub}
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
                transition:    "all 0.12s",
              }}
            >
              {loading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
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
            HAVE AN ACCOUNT?{" "}
            <Link to="/login" style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: 700 }}>
              LOGIN →
            </Link>
          </div>
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