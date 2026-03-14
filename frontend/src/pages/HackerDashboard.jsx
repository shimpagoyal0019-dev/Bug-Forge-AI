import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  submitReport, getMyReports, getReport,
  sendMessage, proposeBounty, acceptProposal,
  createOnChain, getOrganizations,
} from "../services/api";
import { createReportOnChain, raiseDisputeOnChain } from "../services/web3";
import { io } from "socket.io-client";
import {
  riskColor, statusColor,
  Pill, Label, Divider, Btn, inp, onFocus, onBlur,
  Card, MetricTile, Toast, SectionHead, StatBadge,
} from "../components/ui";

const EMPTY = {
  title:"Login bypass via SQL injection",
  description:"The login endpoint concatenates user input directly into SQL query with no parameterization. An attacker can bypass authentication by entering ' OR '1'='1 as email.",
  vulnerabilityType:"sqli",
  exploitability:"medium",
  impact:"high",
  affectedSystem:"/api/login",
  affectedUsers:5000,
  organizationName:"",
  hackerWallet:"0xe1d25576155AF0ACC663132eC76C84fa00c8Efd5",
  exploitCode:`exports.isVulnerable = true;
exports.endpoint = "/api/login";
exports.vulnerableQuery = function(email, password) {
  return \`SELECT * FROM users WHERE email = '\${email}' AND password = '\${password}'\`;
};
exports.bypass = function() {
  const injectedEmail = "' OR '1'='1";
  const query = exports.vulnerableQuery(injectedEmail, "anything");
  return query.includes("OR '1'='1");
};
console.log("Simulation ready");
console.log("Auth bypass possible:", exports.bypass());`,
};
const CVSS = {
  easy:{ critical:9.8,high:8.5,medium:7.0,low:5.5 },
  medium:{ critical:8.8,high:7.5,medium:6.0,low:4.5 },
  hard:{ critical:7.5,high:6.5,medium:5.0,low:3.5 },
};
const NEGOTIATION_STATUSES = ["testing","negotiating","locked"];
const NAV = ["MY REPORTS","SUBMIT NEW","ORGANISATIONS"];

export default function HackerDashboard() {
  const { user } = useAuth();
  const [nav,setNav]               = useState("MY REPORTS");
  const [reports,setReports]       = useState([]);
  const [selected,setSelected]     = useState(null);
  const [detail,setDetail]         = useState(null);
  const [form,setForm]             = useState(EMPTY);
  const [loading,setLoading]       = useState(false);
  const [scoring,setScoring]       = useState(null);
  const [chatMsg,setChatMsg]       = useState("");
  const [propAmount,setPropAmount] = useState("");
  const [propMsg,setPropMsg]       = useState("");
  const [toast,setToast]           = useState(null);
  const [orgs,setOrgs]             = useState([]);
  const [orgsLoading,setOrgsLoading] = useState(false);
  const [orgSearch,setOrgSearch]   = useState("");
  const [expandOrg,setExpandOrg]   = useState(null);
  const socketRef = useRef(null);
  const chatEnd   = useRef(null);

  const f = (k,v) => setForm(p => ({...p,[k]:v}));
  const toast_show = (text,type="ok") => { setToast({text,type}); setTimeout(()=>setToast(null),3500); };

  useEffect(()=>{ fetchReports(); },[]);
  useEffect(()=>{ chatEnd.current?.scrollIntoView({behavior:"smooth"}); },[detail?.messages]);
  useEffect(()=>{ if(nav==="ORGANISATIONS" && orgs.length===0) fetchOrgs(); },[nav]);

  useEffect(()=>{
    if(!selected) return;
    const id = setInterval(()=>{ fetchDetailFn(selected); fetchReports(); },5000);
    return ()=>clearInterval(id);
  },[selected]);

  useEffect(()=>{
    if(!detail?._id) return;
    const s = io(process.env.REACT_APP_BACKEND_URL||"http://localhost:5000");
    socketRef.current = s;
    s.emit("join_report",detail._id);
    s.on("new_message", m=>setDetail(d=>d?{...d,messages:[...(d.messages||[]),m]}:d));
    s.on("new_proposal",p=>setDetail(d=>d?{...d,bountyProposals:[...(d.bountyProposals||[]),p]}:d));
    s.on("bounty_agreed",({agreedBounty})=>{
      toast_show(`✓ Bounty agreed: $${agreedBounty?.toLocaleString()}`);
      setDetail(d=>d?{...d,agreedBounty,status:"negotiating"}:d);
    });
    s.on("sandbox_complete",({status})=>{
      toast_show(status==="passed"?"✓ Sandbox passed — moving to negotiation":"✗ Sandbox failed",status==="passed"?"ok":"err");
      fetchDetailFn(detail._id); fetchReports();
    });
    s.on("escrow_locked",   ()=>{ toast_show("ETH locked in escrow"); fetchDetailFn(detail._id); fetchReports(); });
    s.on("exploit_revealed",()=>{ toast_show("Payment released ✓");   fetchDetailFn(detail._id); fetchReports(); });
    return ()=>{ s.emit("leave_report",detail._id); s.disconnect(); };
  },[detail?._id]);

  const fetchReports  = async()=>{ try{ const{data}=await getMyReports(); setReports(data); }catch{} };
  const fetchDetailFn = async(id)=>{ try{ const{data}=await getReport(id); setDetail(data); }catch{} };
  const fetchOrgs     = async()=>{
    setOrgsLoading(true);
    try{ const{data}=await getOrganizations(); setOrgs(data); }catch{}
    setOrgsLoading(false);
  };

  const openReport = async(r)=>{ setNav("MY REPORTS"); setSelected(r._id); await fetchDetailFn(r._id); };

  const handleSubmit = async(e)=>{
    e.preventDefault(); setLoading(true);
    try{
      const{data}=await submitReport(form);
      setScoring(data.scoring); setNav("MY REPORTS"); setForm(EMPTY);
      await fetchReports(); toast_show("Report submitted — ML scored ✓");
    }catch(err){ toast_show(err.response?.data?.message||"Submit failed","err"); }
    finally{ setLoading(false); }
  };

  const handleSend = async()=>{
    if(!chatMsg.trim()||!detail) return;
    try{ await sendMessage(detail._id,{message:chatMsg}); setChatMsg(""); await fetchDetailFn(detail._id); }catch{}
  };

  const handlePropose = async()=>{
    if(!propAmount||!detail) return;
    try{
      await proposeBounty(detail._id,{amount:Number(propAmount),message:propMsg});
      setPropAmount(""); setPropMsg("");
      toast_show(`Counter $${Number(propAmount).toLocaleString()} sent`);
      await fetchDetailFn(detail._id);
    }catch(err){ toast_show(err.response?.data?.message||"Failed","err"); }
  };

  const handleAccept = async(propId)=>{
    try{
      const{data}=await acceptProposal(detail._id,propId.toString());
      setDetail(data.report||data); fetchReports();
      toast_show(`✓ Agreed: $${(data.agreedBounty||data.report?.agreedBounty)?.toLocaleString()}`);
    }catch(err){ toast_show(err.response?.data?.message||"Failed","err"); }
  };

  const handleCreateOnChain = async()=>{
    if(!detail) return;
    try{
      toast_show("Opening MetaMask...");
      const{contractReportId,txHash}=await createReportOnChain(detail.minBounty,detail._id);
      await createOnChain(detail._id,{contractReportId,txHash});
      setDetail(d=>d?{...d,contractReportId}:d);
      toast_show(`✓ Registered on-chain — Contract ID #${contractReportId}`);
      await fetchDetailFn(detail._id);
    }catch(err){ toast_show(err.message||"On-chain registration failed","err"); }
  };

  const handleRaiseDispute = async()=>{
    if(!detail?.contractReportId){ toast_show("No on-chain ID","err"); return; }
    try{
      toast_show("Opening MetaMask...");
      await raiseDisputeOnChain(detail.contractReportId);
      toast_show("✓ Dispute raised"); await fetchDetailFn(detail._id);
    }catch(err){ toast_show(err.message||"Dispute failed","err"); }
  };

  const previewCvss = CVSS[form.exploitability]?.[form.impact]||6.0;
  const previewSev  = previewCvss>=9?"CRITICAL":previewCvss>=7?"HIGH":previewCvss>=4?"MEDIUM":"LOW";
  const latestOrgProp = detail?.bountyProposals?.slice().reverse().find(p=>p.proposedBy==="organization"&&p.status==="pending");
  const showNegotiation = detail && NEGOTIATION_STATUSES.includes(detail.status);
  const filteredOrgs = orgs.filter(o=>o.username.toLowerCase().includes(orgSearch.toLowerCase())||o.email.toLowerCase().includes(orgSearch.toLowerCase()));

  const body = { color:"var(--text-secondary)",fontSize:13,lineHeight:1.7 };
  const faint = { color:"var(--text-faint)",fontSize:11,letterSpacing:"0.12em",fontWeight:700,textTransform:"uppercase" };

  return (
    <div style={{background:"var(--bg)",minHeight:"100vh",fontFamily:"'Space Mono', monospace"}}>
      <Toast toast={toast} />
      <div style={{maxWidth:1360,margin:"0 auto",padding:"24px 20px",display:"grid",gridTemplateColumns:"280px 1fr",gap:20,alignItems:"start"}}>

        {/* ══ SIDEBAR ══ */}
        <div style={{position:"sticky",top:80}}>
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:"'Syne', sans-serif",fontSize:16,fontWeight:800,color:"var(--text-primary)",letterSpacing:"0.06em"}}>HACKER PORTAL</div>
            <div style={{...faint,marginTop:4}}>{user?.username}</div>
          </div>

          {/* Nav */}
          <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:20}}>
            {NAV.map(n=>(
              <button key={n} onClick={()=>{setNav(n);if(n!=="MY REPORTS"){setSelected(null);setDetail(null);}}}
                style={{
                  textAlign:"left",background:nav===n?"var(--raised)":"transparent",
                  color:nav===n?"var(--text-primary)":"var(--text-muted)",
                  border:`1px solid ${nav===n?"var(--border-hi)":"transparent"}`,
                  borderLeft:`3px solid ${nav===n?"var(--accent)":"transparent"}`,
                  borderRadius:4,padding:"11px 16px",cursor:"pointer",
                  fontFamily:"'Space Mono', monospace",fontSize:12,fontWeight:700,
                  letterSpacing:"0.08em",transition:"all 0.12s",
                }}>
                {n}
                {n==="MY REPORTS"&&reports.length>0&&<span style={{marginLeft:8,fontSize:11,color:"var(--text-faint)"}}>({reports.length})</span>}
              </button>
            ))}
          </div>

          {/* Scoring result */}
          {scoring&&nav==="MY REPORTS"&&(
            <Card accent style={{marginBottom:16}}>
              <div style={{...faint,marginBottom:12}}>ML Scoring Result</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {l:"CVSS", v:scoring.cvssScore?.toFixed(1),                         c:"var(--text-primary)"},
                  {l:"RISK", v:scoring.riskLabel,                                     c:riskColor(scoring.riskLabel)},
                  {l:"FLOOR",v:`$${scoring.minBounty?.toLocaleString()}`,              c:"var(--text-primary)"},
                  {l:"CEIL", v:`$${scoring.confidenceBand?.high?.toLocaleString()}`,   c:"var(--text-secondary)"},
                ].map(i=><MetricTile key={i.l} label={i.l} value={i.v} color={i.c}/>)}
              </div>
              {scoring.aiUsed===false&&<div style={{color:"var(--text-faint)",fontSize:11,marginTop:10}}>⚠ Fallback scoring</div>}
            </Card>
          )}

          {/* Report list */}
          {nav==="MY REPORTS"&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {reports.length===0&&(
                <div style={{color:"var(--text-faint)",fontSize:12,textAlign:"center",padding:28,border:"1px dashed var(--border)",borderRadius:6,lineHeight:2.2}}>
                  No reports yet.<br/><span style={{fontSize:11}}>Submit your first vulnerability.</span>
                </div>
              )}
              {reports.map(r=>(
                <div key={r._id} onClick={()=>openReport(r)} style={{
                  background:selected===r._id?"var(--raised)":"var(--surface)",
                  border:`1px solid ${selected===r._id?"var(--border-hi)":"var(--border)"}`,
                  borderLeft:`3px solid ${selected===r._id?"var(--accent)":"transparent"}`,
                  borderRadius:4,padding:"13px 14px",cursor:"pointer",transition:"all 0.12s",
                }}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:8,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.title}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <Pill label={r.status} color={statusColor(r.status)}/>
                    <span style={{color:"var(--text-muted)",fontSize:11}}>${r.minBounty?.toLocaleString()}</span>
                  </div>
                  <div style={{color:"var(--text-faint)",fontSize:11}}>CVSS {r.cvssScore?.toFixed(1)} · {r.vulnerabilityType?.toUpperCase()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══ MAIN ══ */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* ── ORGANISATIONS ── */}
          {nav==="ORGANISATIONS"&&(
            <>
              <Card>
                <SectionHead sub="All organisations registered on BugForge AI. See their report activity and submit directly.">
                  Organisation Directory
                </SectionHead>
                <input value={orgSearch} onChange={e=>setOrgSearch(e.target.value)}
                  placeholder="Search organisations..." style={{...inp,marginTop:4}} onFocus={onFocus} onBlur={onBlur}/>
              </Card>

              {orgsLoading&&<div style={{color:"var(--text-faint)",fontSize:13,textAlign:"center",padding:48}}>Loading organisations...</div>}

              {!orgsLoading&&filteredOrgs.length===0&&(
                <div style={{color:"var(--text-faint)",fontSize:13,textAlign:"center",padding:48,border:"1px dashed var(--border)",borderRadius:6}}>
                  {orgSearch?`No organisations matching "${orgSearch}"`:"No organisations registered yet."}
                </div>
              )}

              {filteredOrgs.map(org=>(
                <div key={org._id||org.username} style={{border:"1px solid var(--border)",borderRadius:6,overflow:"hidden",background:"var(--surface)"}}>
                  {/* Header row */}
                  <div onClick={()=>setExpandOrg(expandOrg===org._id?null:org._id)}
                    style={{padding:"18px 24px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:"var(--text-primary)",marginBottom:5}}>{org.username}</div>
                      <div style={{fontSize:12,color:"var(--text-muted)"}}>{org.email}</div>
                    </div>
                    <div style={{display:"flex",gap:28,alignItems:"center"}}>
                      <StatBadge value={org.reportCount||0}   label="Reports"/>
                      <StatBadge value={org.uniqueHackers||0} label="Hackers"/>
                      <StatBadge value={org.totalBountyPaid>0?`$${(org.totalBountyPaid/1000).toFixed(0)}k`:"$0"} label="Paid"/>
                      <div style={{color:"var(--text-faint)",fontSize:18,transition:"transform 0.2s",transform:expandOrg===org._id?"rotate(180deg)":"rotate(0)"}}>▾</div>
                    </div>
                  </div>

                  {/* Expanded */}
                  {expandOrg===org._id&&(
                    <div style={{borderTop:"1px solid var(--border)",padding:"20px 24px",background:"var(--raised)"}}>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
                        <MetricTile label="Total Reports"  value={org.reportCount||0}/>
                        <MetricTile label="Unique Hackers" value={org.uniqueHackers||0}/>
                        <MetricTile label="Bounty Paid"    value={org.totalBountyPaid>0?`$${org.totalBountyPaid.toLocaleString()}`:"$0"}/>
                      </div>

                      {org.recentReports?.length>0?(
                        <>
                          <div style={{...faint,marginBottom:12}}>Recent Reports Received</div>
                          <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {org.recentReports.map((r,i)=>(
                              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"var(--surface)",borderRadius:4,border:"1px solid var(--border)"}}>
                                <div>
                                  <div style={{fontSize:13,color:"var(--text-primary)",fontWeight:700,marginBottom:4}}>{r.title||r.vulnerabilityType?.toUpperCase()}</div>
                                  <div style={{fontSize:11,color:"var(--text-faint)"}}>CVSS {r.cvssScore?.toFixed(1)} · {r.riskLabel}</div>
                                </div>
                                <div style={{display:"flex",gap:8}}>
                                  <Pill label={r.vulnerabilityType}/>
                                  <Pill label={r.status} color={statusColor(r.status)}/>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ):(
                        <div style={{fontSize:12,color:"var(--text-faint)",textAlign:"center",padding:"20px 0"}}>
                          No reports submitted to this organisation yet. Be the first!
                        </div>
                      )}

                      <div style={{marginTop:18,paddingTop:18,borderTop:"1px solid var(--border)"}}>
                        <Btn onClick={()=>{setNav("SUBMIT NEW");setForm(p=>({...p,organizationName:org.username}));}} variant="ghost">
                          + Submit Report to {org.username}
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* ── SUBMIT FORM ── */}
          {nav==="SUBMIT NEW"&&(
            <Card>
              <SectionHead sub="CVSS, severity and bounty floor are calculated automatically by ML">Submit Vulnerability Report</SectionHead>
              <Divider/>
              <form onSubmit={handleSubmit}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                  <div>
                    <Label>Title</Label>
                    <input style={inp} placeholder="e.g. Login bypass via SQL injection"
                      value={form.title} onChange={e=>f("title",e.target.value)} required onFocus={onFocus} onBlur={onBlur}/>
                  </div>
                  <div>
                    <Label>Organisation Name</Label>
                    <input style={inp} placeholder="Target organisation"
                      value={form.organizationName} onChange={e=>f("organizationName",e.target.value)} required onFocus={onFocus} onBlur={onBlur}/>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                  <div>
                    <Label>Vulnerability Type</Label>
                    <select style={inp} value={form.vulnerabilityType} onChange={e=>f("vulnerabilityType",e.target.value)}>
                      <option value="sqli">SQL Injection</option>
                      <option value="xss">XSS</option>
                      <option value="rce">RCE — Remote Code Execution</option>
                      <option value="ssrf">SSRF</option>
                      <option value="idor">IDOR</option>
                      <option value="csrf">CSRF</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label>Affected System</Label>
                    <input style={inp} placeholder="/api/login"
                      value={form.affectedSystem} onChange={e=>f("affectedSystem",e.target.value)} required onFocus={onFocus} onBlur={onBlur}/>
                  </div>
                </div>

                {/* CVSS box */}
                <div style={{background:"var(--raised)",border:"1px solid var(--border)",borderRadius:6,padding:18,marginBottom:12}}>
                  <div style={{color:"var(--text-primary)",fontSize:12,fontWeight:700,letterSpacing:"0.1em",marginBottom:14,textTransform:"uppercase"}}>
                    Scoring — ML auto-calculates CVSS from these two fields
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                    <div>
                      <Label>Exploitability</Label>
                      <select style={inp} value={form.exploitability} onChange={e=>f("exploitability",e.target.value)}>
                        <option value="easy">EASY — No auth, one click</option>
                        <option value="medium">MEDIUM — Some skill needed</option>
                        <option value="hard">HARD — Complex conditions</option>
                      </select>
                    </div>
                    <div>
                      <Label>Impact</Label>
                      <select style={inp} value={form.impact} onChange={e=>f("impact",e.target.value)}>
                        <option value="critical">CRITICAL — Full takeover</option>
                        <option value="high">HIGH — Auth bypass / data leak</option>
                        <option value="medium">MEDIUM — Limited damage</option>
                        <option value="low">LOW — Minor info disclosure</option>
                      </select>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                    {[
                      {l:"CVSS Score",v:previewCvss.toFixed(1),c:"var(--text-primary)"},
                      {l:"Severity",  v:previewSev,             c:riskColor(previewSev)},
                      {l:"Has PoC",  v:"TRUE",                  c:"var(--text-muted)"},
                      {l:"Public",   v:"FALSE",                  c:"var(--text-faint)"},
                    ].map(i=><MetricTile key={i.l} label={i.l} value={i.v} color={i.c}/>)}
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                  <div>
                    <Label>Your Wallet Address</Label>
                    <input style={inp} placeholder="0x..."
                      value={form.hackerWallet} onChange={e=>f("hackerWallet",e.target.value)} required onFocus={onFocus} onBlur={onBlur}/>
                  </div>
                  <div>
                    <Label>Est. Affected Users</Label>
                    <input style={inp} type="number" value={form.affectedUsers}
                      onChange={e=>f("affectedUsers",Number(e.target.value))} onFocus={onFocus} onBlur={onBlur}/>
                  </div>
                </div>

                <div style={{marginBottom:12}}>
                  <Label>Description</Label>
                  <textarea style={{...inp,minHeight:80,resize:"vertical"}}
                    placeholder="Describe what this vulnerability allows an attacker to do..."
                    value={form.description} onChange={e=>f("description",e.target.value)} required onFocus={onFocus} onBlur={onBlur}/>
                </div>

                <div style={{marginBottom:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <Label>Exploit Simulation (Node.js)</Label>
                    <span style={{color:"var(--text-faint)",fontSize:11}}>AES-256 · Hidden until payment</span>
                  </div>
                  <div style={{background:"var(--raised)",border:"1px solid var(--border)",borderRadius:4,padding:12,marginBottom:8,fontSize:12,color:"var(--text-faint)",lineHeight:1.8}}>
                    Simulate the vulnerability in Node.js. Export state via{" "}
                    <code style={{color:"var(--text-secondary)",background:"var(--overlay)",padding:"1px 6px",borderRadius:3}}>exports.result</code>
                    {" "}for org test cases. Encrypted before storage.
                  </div>
                  <textarea style={{...inp,minHeight:160,fontFamily:"'Space Mono', monospace",fontSize:12,resize:"vertical"}}
                    placeholder={"// SQL Injection simulation\nexports.isVulnerable = true;\nexports.bypass = function(input) {\n  return `SELECT * FROM users WHERE email = '${input}'`;\n};\nconsole.log('Simulation ready');"}
                    value={form.exploitCode} onChange={e=>f("exploitCode",e.target.value)} required onFocus={onFocus} onBlur={onBlur}/>
                </div>

                <Btn type="submit" disabled={loading} style={{width:"100%",padding:"13px",fontSize:13,letterSpacing:"0.08em"}}>
                  {loading?"SUBMITTING & SCORING...":"SUBMIT ENCRYPTED REPORT"}
                </Btn>
              </form>
            </Card>
          )}

          {/* ── REPORT DETAIL ── */}
          {nav==="MY REPORTS"&&detail&&(
            <>
              {/* Header */}
              <Card>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                  <div>
                    <div style={{fontFamily:"'Syne', sans-serif",fontSize:20,fontWeight:800,color:"var(--text-primary)",marginBottom:10}}>{detail.title}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Pill label={detail.vulnerabilityType}/>
                      <Pill label={detail.riskLabel} color={riskColor(detail.riskLabel)}/>
                      <Pill label={detail.status}    color={statusColor(detail.status)}/>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                    <Pill label={`Sandbox: ${(detail.sandboxStatus||"pending").toUpperCase()}`}
                      color={detail.sandboxStatus==="passed"?"var(--status-negotiating)":detail.sandboxStatus==="failed"?"var(--risk-high)":"var(--text-faint)"}/>
                    <Btn variant="dim" style={{fontSize:11,padding:"6px 12px"}} onClick={()=>{ fetchDetailFn(detail._id); fetchReports(); }}>↻ Refresh</Btn>
                  </div>
                </div>
                <Divider/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:detail.description?16:0}}>
                  <MetricTile label="CVSS"    value={detail.cvssScore?.toFixed(1)}/>
                  <MetricTile label="Floor"   value={`$${detail.minBounty?.toLocaleString()}`}/>
                  <MetricTile label="Suggest" value={`$${detail.recommendedBounty?.toLocaleString()}`} color="var(--text-secondary)"/>
                  <MetricTile label="Agreed"  value={detail.agreedBounty?`$${detail.agreedBounty?.toLocaleString()}`:"—"}/>
                </div>
                {detail.description&&<div style={{...body,marginTop:8}}>{detail.description}</div>}
              </Card>

              {/* Sandbox output */}
              {detail.sandboxOutput&&(
                <Card>
                  <SectionHead>Sandbox Output</SectionHead>
                  <pre style={{background:"var(--raised)",borderRadius:4,padding:14,fontSize:12,lineHeight:1.6,margin:0,maxHeight:220,overflowY:"auto",fontFamily:"'Space Mono', monospace",color:detail.sandboxStatus==="passed"?"var(--text-secondary)":"var(--text-faint)",border:`1px solid ${detail.sandboxStatus==="passed"?"var(--border-hi)":"var(--border)"}`}}>
                    {detail.sandboxOutput}
                  </pre>
                </Card>
              )}

              {/* On-chain registration */}
              {detail.status==="negotiating"&&!detail.contractReportId&&(
                <Card accent>
                  <SectionHead sub="Register on Sepolia so the org can lock ETH — sets your wallet as payment recipient.">Register On-Chain (Required)</SectionHead>
                  <div style={{...body,marginBottom:16}}>Bounty agreed at <strong style={{color:"var(--text-primary)"}}>${detail.agreedBounty?.toLocaleString()}</strong>. Connect MetaMask and sign.</div>
                  <Btn onClick={handleCreateOnChain}>Register on Sepolia (MetaMask)</Btn>
                </Card>
              )}

              {detail.contractReportId!=null&&detail.status==="negotiating"&&(
                <Card>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:5}}>✓ Registered On-Chain</div>
                      <div style={{fontSize:12,color:"var(--text-muted)"}}>Contract ID: <code style={{color:"var(--text-primary)"}}># {detail.contractReportId}</code> · Waiting for org to lock ETH.</div>
                    </div>
                    <Pill label="On-Chain" color="var(--status-negotiating)"/>
                  </div>
                </Card>
              )}

              {/* Locked */}
              {detail.status==="locked"&&(
                <Card>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:5}}>ETH Locked in Escrow</div>
                      <div style={{fontSize:12,color:"var(--text-muted)"}}><strong style={{color:"var(--text-primary)"}}>${detail.agreedBounty?.toLocaleString()}</strong> locked in smart contract. Waiting for release.</div>
                    </div>
                    <Pill label="Locked" color="var(--status-locked)"/>
                  </div>
                  {detail.contractReportId!=null&&<Btn variant="danger" onClick={handleRaiseDispute} style={{fontSize:11}}>Raise Dispute (after deadline)</Btn>}
                </Card>
              )}

              {/* Negotiation */}
              {showNegotiation&&(
                <Card>
                  <SectionHead sub={`Status: ${detail.status.toUpperCase()} · Floor: $${detail.minBounty?.toLocaleString()}`}>Negotiation</SectionHead>
                  <Divider/>

                  {latestOrgProp?(
                    <div style={{background:"var(--raised)",border:"1px solid var(--border-hi)",borderLeft:"3px solid var(--accent)",borderRadius:4,padding:20,marginBottom:16}}>
                      <div style={{...faint,marginBottom:8}}>Org Proposes</div>
                      <div style={{color:"var(--text-primary)",fontSize:30,fontWeight:700,marginBottom:8}}>${latestOrgProp.amount?.toLocaleString()}</div>
                      {latestOrgProp.message&&<div style={{...body,marginBottom:14}}>{latestOrgProp.message}</div>}
                      <div style={{display:"flex",gap:10}}>
                        <Btn onClick={()=>handleAccept(latestOrgProp._id)}>Accept</Btn>
                        <Btn variant="ghost">Counter ↓</Btn>
                      </div>
                    </div>
                  ):(
                    <div style={{...body,padding:"12px 0",marginBottom:16,borderBottom:"1px solid var(--border)"}}>No org proposals yet — send a counter-proposal below.</div>
                  )}

                  <div style={{marginBottom:16}}>
                    <Label>Counter-Propose (USD)</Label>
                    <div style={{display:"flex",gap:10}}>
                      <input type="number" value={propAmount} onChange={e=>setPropAmount(e.target.value)}
                        placeholder="Amount" style={{...inp,flex:"0 0 140px",width:"auto"}} onFocus={onFocus} onBlur={onBlur}/>
                      <input value={propMsg} onChange={e=>setPropMsg(e.target.value)}
                        placeholder="Optional note" style={{...inp,flex:1}} onFocus={onFocus} onBlur={onBlur}/>
                      <Btn onClick={handlePropose} variant="ghost">Send</Btn>
                    </div>
                  </div>

                  {detail.bountyProposals?.length>0&&(
                    <div style={{marginBottom:16}}>
                      <Label>Proposal History</Label>
                      {detail.bountyProposals.map((p,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                          <div>
                            <span style={{color:p.proposedBy==="hacker"?"var(--text-primary)":"var(--text-muted)",fontSize:12,fontWeight:700}}>{p.proposedBy==="hacker"?"You":"Org"}</span>
                            {p.message&&<span style={{color:"var(--text-faint)",fontSize:12,marginLeft:12}}>{p.message}</span>}
                          </div>
                          <div style={{display:"flex",gap:10,alignItems:"center"}}>
                            <span style={{fontSize:13,color:"var(--text-secondary)",fontWeight:700}}>${p.amount?.toLocaleString()}</span>
                            <Pill label={p.status} color={p.status==="accepted"?"var(--text-primary)":"var(--text-faint)"}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Label>Secure Chat</Label>
                  <div style={{background:"var(--raised)",border:"1px solid var(--border)",borderRadius:4,padding:14,maxHeight:200,overflowY:"auto",marginBottom:10}}>
                    {!detail.messages?.length
                      ?<div style={{color:"var(--text-faint)",fontSize:12,textAlign:"center",padding:"12px 0"}}>No messages yet</div>
                      :detail.messages.map((m,i)=>(
                        <div key={i} style={{marginBottom:14}}>
                          <div style={{display:"flex",gap:10,marginBottom:3}}>
                            <span style={{color:m.role==="hacker"?"var(--text-primary)":"var(--text-muted)",fontSize:12,fontWeight:700}}>{m.sender}</span>
                            <span style={{color:"var(--text-faint)",fontSize:11}}>{new Date(m.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div style={{...body,paddingLeft:12,borderLeft:`2px solid ${m.role==="hacker"?"var(--accent)":"var(--border-hi)"}`}}>{m.message}</div>
                        </div>
                      ))
                    }
                    <div ref={chatEnd}/>
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&handleSend()}
                      placeholder="Type message..." style={{...inp,flex:1}} onFocus={onFocus} onBlur={onBlur}/>
                    <Btn onClick={handleSend} variant="ghost">Send</Btn>
                  </div>
                </Card>
              )}

              {detail.status==="released"&&(
                <Card accent>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)",letterSpacing:"0.06em",marginBottom:10}}>✓ Payment Released</div>
                  <div style={{...body,marginBottom:12}}>Bounty of <strong style={{color:"var(--text-primary)"}}>${detail.agreedBounty?.toLocaleString()}</strong> sent to your wallet.</div>
                  {detail.txHash&&<a href={`https://sepolia.etherscan.io/tx/${detail.txHash}`} target="_blank" rel="noreferrer" style={{color:"var(--text-muted)",fontSize:12}}>View on Etherscan →</a>}
                </Card>
              )}

              {detail.status==="disputed"&&(
                <Card>
                  <div style={{color:"var(--risk-high)",fontSize:14,fontWeight:700,marginBottom:8}}>⚠ Disputed</div>
                  <div style={body}>This report is under dispute. Platform admin will review.</div>
                </Card>
              )}
            </>
          )}

          {nav==="MY REPORTS"&&!detail&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"var(--text-faint)",fontSize:13,height:300,border:"1px dashed var(--border)",borderRadius:6,gap:12}}>
              <div>Select a report or submit a new one</div>
              <Btn variant="ghost" onClick={()=>setNav("SUBMIT NEW")} style={{fontSize:12}}>+ Submit New Report</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}