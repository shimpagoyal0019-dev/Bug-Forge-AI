import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <nav style={{
      background:   "var(--surface)",
      borderBottom: "1px solid var(--border)",
      padding:      "0 24px",
      height:       52,
      display:      "flex",
      alignItems:   "center",
      justifyContent: "space-between",
      position:     "sticky",
      top:          0,
      zIndex:       100,
    }}>
      {/* Left — brand */}
      <Link
        to={user.role === "hacker" ? "/hacker" : "/org"}
        style={{
          color:          "var(--text-primary)",
          textDecoration: "none",
          fontFamily:     "'Syne', sans-serif",
          fontWeight:     800,
          fontSize:       13,
          letterSpacing:  "0.12em",
        }}
      >
        BUGFORGE AI
      </Link>

      {/* Right — controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Role pill */}
        <span style={{
          padding:       "2px 8px",
          borderRadius:  2,
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: "0.15em",
          background:    "var(--accent-dim)",
          color:         "var(--text-muted)",
          border:        "1px solid var(--border-hi)",
        }}>
          {user.role?.toUpperCase()}
        </span>

        {/* Username */}
        <span style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.08em" }}>
          {user.username}
        </span>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          style={{
            background:    "var(--raised)",
            border:        "1px solid var(--border-hi)",
            borderRadius:  3,
            color:         "var(--text-muted)",
            cursor:        "pointer",
            display:       "flex",
            alignItems:    "center",
            justifyContent:"center",
            width:         28,
            height:        28,
            fontSize:      12,
          }}
        >
          {theme === "dark" ? "☀" : "◑"}
        </button>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate("/login"); }}
          style={{
            background:    "transparent",
            border:        "1px solid var(--border-hi)",
            borderRadius:  3,
            color:         "var(--text-muted)",
            padding:       "5px 11px",
            cursor:        "pointer",
            fontFamily:    "'Space Mono', monospace",
            fontSize:      9,
            fontWeight:    700,
            letterSpacing: "0.12em",
          }}
        >
          LOGOUT
        </button>
      </div>
    </nav>
  );
}