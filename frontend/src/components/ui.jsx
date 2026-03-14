/* BugForge AI — Shared UI primitives v2 — bigger readable fonts */

export const T = {
  bg:"var(--bg)",surface:"var(--surface)",raised:"var(--raised)",
  overlay:"var(--overlay)",border:"var(--border)",borderHi:"var(--border-hi)",
  white:"var(--text-primary)",dim:"var(--text-secondary)",muted:"var(--text-muted)",
  faint:"var(--text-faint)",accent:"var(--accent)",
};

export const riskColor = (r) => ({
  CRITICAL:"var(--risk-critical)",HIGH:"var(--risk-high)",
  MEDIUM:"var(--risk-medium)",LOW:"var(--risk-low)",
})[r] || "var(--text-muted)";

export const statusColor = (s) => ({
  pending:"var(--status-pending)",testing:"var(--status-testing)",
  negotiating:"var(--status-negotiating)",locked:"var(--status-locked)",
  released:"var(--status-released)",disputed:"var(--status-disputed)",
})[s] || "var(--text-muted)";

export const Pill = ({ label, color = "var(--text-muted)" }) => (
  <span style={{
    padding:"3px 10px",borderRadius:3,fontSize:11,fontWeight:700,
    letterSpacing:"0.08em",whiteSpace:"nowrap",
    background:`color-mix(in srgb, ${color} 12%, transparent)`,
    color,border:`1px solid color-mix(in srgb, ${color} 22%, transparent)`,
  }}>{label?.toUpperCase()}</span>
);

export const Label = ({ children }) => (
  <div style={{
    color:"var(--text-muted)",fontSize:11,letterSpacing:"0.12em",
    marginBottom:7,fontWeight:700,textTransform:"uppercase",
  }}>{children}</div>
);

export const Divider = ({ margin = "16px 0" }) => (
  <div style={{ height:1, background:"var(--border)", margin }} />
);

export const Btn = ({ children, onClick, variant="primary", disabled, type="button", style={} }) => {
  const v = {
    primary:{ background:"var(--accent)", color:"var(--bg)", border:"1px solid transparent" },
    ghost:  { background:"transparent", color:"var(--text-secondary)", border:"1px solid var(--border-hi)" },
    danger: { background:"transparent", color:"var(--risk-high)", border:"1px solid var(--border-hi)" },
    dim:    { background:"var(--raised)", color:"var(--text-muted)", border:"1px solid var(--border)" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      borderRadius:4,fontWeight:700,padding:"10px 20px",fontSize:12,
      cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.35:1,
      fontFamily:"'Space Mono', monospace",letterSpacing:"0.08em",
      transition:"all 0.12s",...v[variant],...style,
    }}>{children}</button>
  );
};

export const inp = {
  width:"100%",background:"var(--inp-bg)",border:"1px solid var(--inp-border)",
  borderRadius:4,color:"var(--inp-text)",fontFamily:"'Space Mono', monospace",
  fontSize:13,padding:"10px 14px",outline:"none",display:"block",
};
export const onFocus = (e) => (e.target.style.borderColor = "var(--border-focus)");
export const onBlur  = (e) => (e.target.style.borderColor = "var(--inp-border)");

export const Card = ({ children, style={}, accent=false }) => (
  <div style={{
    background:"var(--surface)",border:"1px solid var(--border)",
    borderLeft:accent?"3px solid var(--accent)":"1px solid var(--border)",
    borderRadius:6,padding:24,...style,
  }}>{children}</div>
);

export const MetricTile = ({ label, value, color="var(--text-primary)" }) => (
  <div style={{
    background:"var(--raised)",borderRadius:4,padding:"12px 14px",
    border:"1px solid var(--border)",
  }}>
    <div style={{ color:"var(--text-faint)",fontSize:10,letterSpacing:"0.16em",marginBottom:6,fontWeight:700 }}>
      {label}
    </div>
    <div style={{ color,fontSize:18,fontWeight:700,fontFamily:"'Space Mono', monospace",lineHeight:1 }}>
      {value}
    </div>
  </div>
);

export const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div style={{
      position:"fixed",top:20,right:20,zIndex:9999,
      background:"var(--surface)",border:"1px solid var(--border-hi)",
      borderLeft:`3px solid ${toast.type==="err"?"var(--toast-err-left)":"var(--toast-ok-left)"}`,
      color:toast.type==="err"?"var(--text-secondary)":"var(--text-primary)",
      padding:"14px 20px",borderRadius:4,fontSize:13,fontWeight:700,
      letterSpacing:"0.04em",maxWidth:360,boxShadow:"0 4px 32px rgba(0,0,0,0.5)",
      fontFamily:"'Space Mono', monospace",
    }}>{toast.text}</div>
  );
};

export const SectionHead = ({ children, sub }) => (
  <div style={{ marginBottom:16 }}>
    <div style={{
      color:"var(--text-primary)",fontSize:13,fontWeight:700,
      letterSpacing:"0.1em",marginBottom:sub?5:0,textTransform:"uppercase",
    }}>{children}</div>
    {sub && <div style={{ color:"var(--text-muted)",fontSize:12,lineHeight:1.7 }}>{sub}</div>}
  </div>
);

export const StatBadge = ({ value, label }) => (
  <div style={{ textAlign:"center" }}>
    <div style={{ fontSize:22,fontWeight:700,color:"var(--text-primary)",fontFamily:"'Space Mono', monospace",lineHeight:1 }}>
      {value}
    </div>
    <div style={{ fontSize:10,color:"var(--text-faint)",letterSpacing:"0.12em",marginTop:4,textTransform:"uppercase" }}>
      {label}
    </div>
  </div>
);