import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getOrgReports, getReport,
  addTestCase, deleteTestCase,
  runSandbox, proposeBounty, acceptProposal,
  sendMessage, lockEscrow, releaseEscrow, getExploit,
} from "../services/api";
import { lockBountyOnChain, releaseBounty } from "../services/web3";
import { io } from "socket.io-client";
import {
  riskColor, statusColor,
  Pill, Label, Divider, Btn, inp, onFocus, onBlur,
  Card, MetricTile, Toast, SectionHead,
} from "../components/ui";

const TABS = ["pending","testing","negotiating","locked","released"];

const DEFAULT_TC_DESC   = "SQL injection bypasses login authentication";
const DEFAULT_TC_SCRIPT = `if (hackerEnv.isVulnerable === true && typeof hackerEnv.bypass === "function") {
  const result = hackerEnv.bypass();
  if (result === true) {
    console.log("VULNERABILITY_CONFIRMED");
  } else {
    console.log("bypass() returned false");
  }
} else {
  console.log("simulation not set up correctly");
}`;

function parseWeb3Error(err, agreedBountyUsd=0) {
  const msg = err?.message||""; const code = err?.code||""; const reason = err?.reason||"";
  if(code==="ACTION_REJECTED"||msg.includes("user rejected")||msg.includes("User denied"))
    return "Transaction cancelled in MetaMask.";
  if(code==="INSUFFICIENT_FUNDS"||msg.toLowerCase().includes("insufficient funds")||msg.toLowerCase().includes("insufficient balance"))
    return `Not enough Sepolia ETH. You need ~${agreedBountyUsd>0?(agreedBountyUsd/300000).toFixed(6):"some"} ETH. Get free Sepolia ETH from sepoliafaucet.com`;
  if(msg.includes("MetaMask not found")||msg.includes("window.ethereum"))
    return "MetaMask is not installed. Install it from metamask.io";
  if(reason||msg.includes("execution reverted")){
    const r = reason||msg.match(/execution reverted: (.+)/)?.[1]||"";
    if(r.includes("Below AI minimum bounty")) return "Amount is below the contract's minimum bounty.";
    if(r.includes("Report not pending"))     return "Report is no longer pending on-chain.";
    if(r.includes("Already locked"))         return "Escrow is already locked for this report.";
    if(r.includes("Not locked"))             return "Cannot release — escrow not locked yet.";
    if(r.includes("Only organization"))      return "Your wallet is not the org wallet for this report.";
    if(r) return `Contract rejected: "${r}"`;
  }
  if(msg.includes("cannot estimate gas")) return "Transaction would fail on-chain. Check contract state.";
  return msg||"Transaction failed. Check MetaMask and try again.";
}

export default function OrgDashboard() {
  const { user }                    = useAuth();
  const [reports,setReports]        = useState([]);
  const [selected,setSelected]      = useState(null);
  const [detail,setDetail]          = useState(null);
  const [tab,setTab]                = useState("pending");
  const [action,setAction]          = useState("");
  const [toast,setToast]            = useState(null);
  const [sandboxLog,setSandboxLog]  = useState([]);
  const [tcDesc,setTcDesc]          = useState(DEFAULT_TC_DESC);
  const [tcScript,setTcScript]      = useState(DEFAULT_TC_SCRIPT);
  const [propAmount,setPropAmount]  = useState("");
  const [propMsg,setPropMsg]        = useState("");
  const [chatMsg,setChatMsg]        = useState("");
  const socketRef = useRef(null);
  const chatEnd   = useRef(null);

  const toast_show = (text,type="ok") => { setToast({text,type}); setTimeout(()=>setToast(null),3500); };

  useEffect(()=>{ fetchReports(); },[]);
  useEffect(()=>{ chatEnd.current?.scrollIntoView({behavior:"smooth"}); },[detail?.messages]);

  useEffect(()=>{
    if(!detail?._id) return;
    const s = io(process.env.REACT_APP_BACKEND_URL||"http://localhost:5000");
    socketRef.current = s;
    s.emit("join_report",detail._id);
    s.on("new_message", m=>setDetail(d=>d?{...d,messages:[...(d.messages||[]),m]}:d));
    s.on("new_proposal",p=>setDetail(d=>d?{...d,bountyProposals:[...(d.bountyProposals||[]),p]}:d));
    s.on("bounty_agreed",({agreedBounty})=>{
      toast_show(`Bounty agreed: $${agreedBounty.toLocaleString()}`);
      setDetail(d=>d?{...d,agreedBounty,status:"negotiating"}:d);
    });
    s.on("sandbox_progress",({testCase,total,description,passed,output})=>{
      setSandboxLog(l=>[...l,`[${testCase}/${total}] ${description}: ${passed?"PASS":"FAIL"}\n${output}`]);
    });
    s.on("sandbox_complete",({status,output})=>{
      setDetail(d=>d?{...d,sandboxStatus:status,sandboxOutput:output}:d);
      toast_show(status==="passed"?"All test cases passed":"Some test cases failed",status==="passed"?"ok":"err");
      fetchReports();
    });
    s.on("escrow_locked",()=>{ toast_show("Escrow locked on-chain"); fetchDetailFn(detail._id); });
    return ()=>{ s.emit("leave_report",detail._id); s.disconnect(); };
  },[detail?._id]);

  const fetchReports  = async()=>{ try{ const{data}=await getOrgReports(); setReports(data); }catch{} };
  const fetchDetailFn = async(id)=>{ try{ const{data}=await getReport(id); setDetail(data); }catch{} };

  const openReport = async(r)=>{
    setSelected(r._id); setSandboxLog([]);
    setPropAmount(r.recommendedBounty||r.minBounty||"");
    await fetchDetailFn(r._id);
  };

  const handleAddTc = async()=>{
    if(!tcDesc.trim()||!tcScript.trim()) return;
    try{
      const{data}=await addTestCase(detail._id,{description:tcDesc,testScript:tcScript});
      setDetail(d=>d?{...d,orgTestCases:data.orgTestCases,status:data.status}:d);
      setTcDesc(DEFAULT_TC_DESC); setTcScript(DEFAULT_TC_SCRIPT); fetchReports(); toast_show("Test case added");
    }catch(err){ toast_show(err.response?.data?.message||"Failed","err"); }
  };

  const handleDeleteTc = async(tcId)=>{
    try{ const{data}=await deleteTestCase(detail._id,tcId); setDetail(d=>d?{...d,orgTestCases:data.orgTestCases}:d); }
    catch{ toast_show("Failed","err"); }
  };

  const handleSandbox = async()=>{
    setSandboxLog([]); setAction("sandbox");
    try{
      const{data}=await runSandbox(detail._id);
      setDetail(d=>d?{...d,sandboxStatus:data.status,sandboxOutput:data.output}:d);
      if(data.passed) fetchReports();
    }catch(err){ toast_show(err.response?.data?.message||"Sandbox error","err"); }
    setAction("");
  };

  const handlePropose = async()=>{
    if(!propAmount) return;
    try{
      await proposeBounty(detail._id,{amount:Number(propAmount),message:propMsg});
      setPropMsg(""); toast_show(`Proposal $${Number(propAmount).toLocaleString()} sent`);
    }catch(err){ toast_show(err.response?.data?.message||"Failed","err"); }
  };

  const handleAccept = async(propId)=>{
    try{
      const{data}=await acceptProposal(detail._id,propId.toString());
      setDetail(data.report); fetchReports();
      toast_show(`✓ Agreed: $${data.agreedBounty?.toLocaleString()}`);
    }catch(err){ toast_show(err.response?.data?.message||"Accept failed","err"); }
  };

  const handleLock = async()=>{
    if(!detail.agreedBounty){ toast_show("Accept a bounty proposal first","err"); return; }
    if(!detail.contractReportId){ toast_show("Hacker must register on-chain first","err"); return; }
    setAction("lock");
    try{
      const txHash = await lockBountyOnChain(detail.contractReportId, detail.agreedBounty);
      const{data}=await lockEscrow(detail._id,{txHash});
      setDetail({...data,revealedExploit:null}); fetchReports();
      toast_show("✓ ETH locked in smart contract on Sepolia");
    }catch(err){
      console.error("handleLock error:",err);
      toast_show(parseWeb3Error(err,detail.agreedBounty),"err");
    }
    setAction("");
  };

  const handleRelease = async() => {
    if(!detail.agreedBounty)       { toast_show("No agreed bounty","err"); return; }
    if(detail.status!=="locked")   { toast_show("Lock escrow first","err"); return; }
    if(!detail.contractReportId)   { toast_show("No contract report ID","err"); return; }
    setAction("release");
    try{
      const txHash   = await releaseBounty(detail.contractReportId);
      const{data}    = await releaseEscrow(detail._id,{txHash});
      console.log("Release response:", data);
      console.log("Exploit code:", data.exploitCode);
      setDetail({...data, revealedExploit: data.exploitCode});
      fetchReports();
      toast_show("✓ Payment released — exploit code revealed");
    }catch(err){
      console.error("handleRelease error:",err);
      toast_show(parseWeb3Error(err,0),"err");
    }
    setAction("");
  };

  const handleFetchExploit = async() => {
    try{
      const{data} = await getExploit(detail._id);
      setDetail(d=>({...d, revealedExploit: data.exploitCode, exploitCode: data.exploitCode}));
      toast_show("✓ Exploit code loaded");
    }catch{
      toast_show("Failed to fetch exploit","err");
    }
  };

  const handleChat = async()=>{
    if(!chatMsg.trim()) return;
    try{ await sendMessage(detail._id,{message:chatMsg}); setChatMsg(""); }catch{}
  };

  const tabReports = reports.filter(r=>r.status===tab);
  const tabCount   = t=>reports.filter(r=>r.status===t).length;
  const latestHackerProp = detail?.bountyProposals?.slice().reverse().find(p=>p.proposedBy==="hacker"&&p.status==="pending");

  const body  = {color:"var(--text-secondary)",fontSize:13,lineHeight:1.7};
  const faint = {color:"var(--text-faint)",fontSize:11,letterSpacing:"0.12em",fontWeight:700,textTransform:"uppercase"};

  return (
    <div style={{background:"var(--bg)",minHeight:"100vh",fontFamily:"'Space Mono', monospace",color:"var(--text-secondary)"}}>
      <Toast toast={toast}/>
      <div style={{maxWidth:1360,margin:"0 auto",padding:"24px 20px",display:"grid",gridTemplateColumns:"280px 1fr",gap:20,alignItems:"start"}}>

        {/* ══ SIDEBAR ══ */}
        <div style={{position:"sticky",top:80}}>
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:"'Syne', sans-serif",fontSize:16,fontWeight:800,color:"var(--text-primary)",letterSpacing:"0.06em"}}>ORG PORTAL</div>
            <div style={{...faint,marginTop:4}}>{user?.username}</div>
          </div>

          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:16}}>
            {TABS.map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                background:tab===t?"var(--accent)":"transparent",
                color:tab===t?"var(--bg)":"var(--text-muted)",
                border:`1px solid ${tab===t?"var(--accent)":"var(--border)"}`,
                borderRadius:4,padding:"5px 12px",cursor:"pointer",
                fontFamily:"'Space Mono', monospace",fontSize:11,fontWeight:700,
                letterSpacing:"0.08em",transition:"all 0.12s",
              }}>
                {t.toUpperCase()}{tabCount(t)>0&&` (${tabCount(t)})`}
              </button>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {tabReports.length===0&&(
              <div style={{color:"var(--text-faint)",fontSize:12,textAlign:"center",padding:28,border:"1px dashed var(--border)",borderRadius:6}}>
                No reports in this status
              </div>
            )}
            {tabReports.map(r=>(
              <div key={r._id} onClick={()=>openReport(r)} style={{
                background:selected===r._id?"var(--raised)":"var(--surface)",
                border:`1px solid ${selected===r._id?"var(--border-hi)":"var(--border)"}`,
                borderLeft:`3px solid ${selected===r._id?"var(--accent)":"transparent"}`,
                borderRadius:4,padding:"13px 14px",cursor:"pointer",transition:"all 0.12s",
              }}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:8,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.title}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{color:"var(--text-muted)",fontSize:12}}>{r.hacker?.username}</span>
                  <Pill label={r.vulnerabilityType}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:"var(--text-faint)",fontSize:11}}>CVSS {r.cvssScore?.toFixed(1)}</span>
                  <span style={{color:"var(--text-muted)",fontSize:11}}>${r.minBounty?.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ MAIN ══ */}
        {!detail?(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-faint)",fontSize:13,letterSpacing:"0.08em",height:300,border:"1px dashed var(--border)",borderRadius:6}}>
            Select a report from the sidebar
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

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
                <div style={{textAlign:"right"}}>
                  <div style={{...faint,marginBottom:5}}>Hacker</div>
                  <div style={{color:"var(--text-primary)",fontSize:14,fontWeight:700}}>{detail.hacker?.username}</div>
                  <div style={{color:"var(--text-muted)",fontSize:12,marginTop:3}}>{detail.hacker?.email}</div>
                </div>
              </div>
              <Divider/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:detail.description?16:0}}>
                <MetricTile label="CVSS"     value={detail.cvssScore?.toFixed(1)}/>
                <MetricTile label="ML Floor" value={`$${detail.minBounty?.toLocaleString()}`}/>
                <MetricTile label="Suggest"  value={`$${detail.recommendedBounty?.toLocaleString()}`} color="var(--text-secondary)"/>
                <MetricTile label="Agreed"   value={detail.agreedBounty?`$${detail.agreedBounty?.toLocaleString()}`:"—"}/>
              </div>
              {detail.description&&<div style={body}>{detail.description}</div>}
            </Card>

            {/* STEP 1 — Test cases */}
            <Card>
              <SectionHead sub={<>Test scripts run against the hacker's simulation via <code style={{color:"var(--text-secondary)",background:"var(--raised)",padding:"1px 6px",borderRadius:3,fontSize:12}}>hackerEnv</code>. Print <code style={{color:"var(--text-primary)",background:"var(--raised)",padding:"1px 6px",borderRadius:3,fontSize:12}}>VULNERABILITY_CONFIRMED</code> to pass.</>}>
                Step 1 — Write Test Cases
              </SectionHead>

              {detail.orgTestCases?.length>0&&(
                <div style={{marginBottom:14}}>
                  {detail.orgTestCases.map((tc,i)=>(
                    <div key={tc._id} style={{background:"var(--raised)",border:"1px solid var(--border)",borderRadius:4,padding:14,marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                        <span style={{color:"var(--text-secondary)",fontSize:12,fontWeight:700}}>Test {i+1}: {tc.description}</span>
                        <button onClick={()=>handleDeleteTc(tc._id)} style={{background:"transparent",border:"none",color:"var(--text-faint)",cursor:"pointer",fontSize:11,fontFamily:"'Space Mono', monospace",fontWeight:700}}>REMOVE</button>
                      </div>
                      <pre style={{margin:0,color:"var(--text-muted)",fontSize:11,lineHeight:1.6,maxHeight:80,overflowY:"auto",fontFamily:"'Space Mono', monospace"}}>{tc.testScript}</pre>
                    </div>
                  ))}
                </div>
              )}

              <div style={{marginBottom:10}}>
                <Label>Test Description</Label>
                <input value={tcDesc} onChange={e=>setTcDesc(e.target.value)}
                  placeholder="e.g. SQL injection bypasses login auth"
                  style={inp} onFocus={onFocus} onBlur={onBlur}/>
              </div>
              <div style={{marginBottom:12}}>
                <Label>Test Script</Label>
                <textarea value={tcScript} onChange={e=>setTcScript(e.target.value)}
                  style={{...inp,minHeight:110,fontFamily:"'Space Mono', monospace",fontSize:12,resize:"vertical"}}
                  placeholder={"// hackerEnv is the hacker's simulation exports\nif (hackerEnv.isVulnerable === true) {\n  console.log('VULNERABILITY_CONFIRMED');\n}"}
                  onFocus={onFocus} onBlur={onBlur}/>
              </div>
              <Btn onClick={handleAddTc} variant="ghost">+ Add Test Case</Btn>
            </Card>

            {/* STEP 2 — Sandbox */}
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <SectionHead sub="Platform runs your test cases against the hacker's simulation server-side.">
                  Step 2 — Run Sandbox
                </SectionHead>
                <Pill label={detail.sandboxStatus||"pending"}
                  color={detail.sandboxStatus==="passed"?"var(--text-primary)":"var(--text-faint)"}/>
              </div>

              {sandboxLog.length>0&&(
                <pre style={{background:"var(--raised)",border:"1px solid var(--border)",borderRadius:4,padding:14,fontSize:12,color:"var(--text-muted)",maxHeight:160,overflowY:"auto",marginBottom:12,fontFamily:"'Space Mono', monospace",lineHeight:1.6}}>
                  {sandboxLog.join("\n\n")}
                </pre>
              )}
              {detail.sandboxOutput&&!sandboxLog.length&&(
                <pre style={{background:"var(--raised)",borderRadius:4,padding:14,fontSize:12,lineHeight:1.6,marginBottom:12,maxHeight:160,overflowY:"auto",color:detail.sandboxStatus==="passed"?"var(--text-secondary)":"var(--text-faint)",border:`1px solid ${detail.sandboxStatus==="passed"?"var(--border-hi)":"var(--border)"}`,fontFamily:"'Space Mono', monospace"}}>
                  {detail.sandboxOutput}
                </pre>
              )}

              <Btn onClick={handleSandbox}
                disabled={action==="sandbox"||!detail.orgTestCases?.length||detail.sandboxStatus==="passed"}
                variant={detail.sandboxStatus==="passed"?"dim":"primary"}>
                {action==="sandbox"?"Running..."
                  :detail.sandboxStatus==="passed"?"✓ Sandbox Passed"
                  :!detail.orgTestCases?.length?"Add Test Cases First"
                  :"Run Sandbox"}
              </Btn>
            </Card>

            {/* STEP 3 — Negotiate */}
            {["testing","negotiating","locked"].includes(detail.status)&&(
              <Card>
                <SectionHead>Step 3 — Negotiate Bounty</SectionHead>
                <div style={{background:"var(--raised)",border:"1px solid var(--border)",borderRadius:4,padding:14,marginBottom:14,fontSize:12,color:"var(--text-muted)",lineHeight:1.8}}>
                  ML Floor:{" "}<span style={{color:"var(--text-primary)",fontWeight:700}}>${detail.minBounty?.toLocaleString()}</span>
                  {" · "}Cannot propose below this.{" "}
                  Suggested:{" "}<span style={{color:"var(--text-secondary)"}}>${detail.recommendedBounty?.toLocaleString()}</span>
                </div>

                {latestHackerProp&&(
                  <div style={{background:"var(--raised)",border:"1px solid var(--border-hi)",borderLeft:"3px solid var(--accent)",borderRadius:4,padding:20,marginBottom:14}}>
                    <div style={{...faint,marginBottom:8}}>Hacker Counter-Proposes</div>
                    <div style={{color:"var(--text-primary)",fontSize:30,fontWeight:700,marginBottom:8}}>${latestHackerProp.amount?.toLocaleString()}</div>
                    {latestHackerProp.message&&<div style={{...body,marginBottom:14}}>{latestHackerProp.message}</div>}
                    <Btn onClick={()=>handleAccept(latestHackerProp._id)}>Accept</Btn>
                  </div>
                )}

                <div style={{marginBottom:14}}>
                  <Label>Propose Amount (USD)</Label>
                  <div style={{display:"flex",gap:10}}>
                    <input type="number" value={propAmount} onChange={e=>setPropAmount(e.target.value)}
                      placeholder={`Min $${detail.minBounty}`}
                      style={{...inp,flex:"0 0 150px",width:"auto"}} onFocus={onFocus} onBlur={onBlur}/>
                    <input value={propMsg} onChange={e=>setPropMsg(e.target.value)}
                      placeholder="Message to hacker" style={{...inp,flex:1}} onFocus={onFocus} onBlur={onBlur}/>
                    <Btn onClick={handlePropose} variant="ghost">Send</Btn>
                  </div>
                </div>

                {detail.bountyProposals?.length>0&&(
                  <div style={{marginBottom:14}}>
                    <Label>Proposal History</Label>
                    {detail.bountyProposals.map((p,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                        <div>
                          <span style={{color:p.proposedBy==="organization"?"var(--text-primary)":"var(--text-muted)",fontSize:12,fontWeight:700}}>
                            {p.proposedBy==="organization"?"You":"Hacker"}
                          </span>
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
                <div style={{background:"var(--raised)",border:"1px solid var(--border)",borderRadius:4,padding:14,maxHeight:180,overflowY:"auto",marginBottom:10}}>
                  {!detail.messages?.length
                    ?<div style={{color:"var(--text-faint)",fontSize:12,textAlign:"center",padding:"12px 0"}}>No messages</div>
                    :detail.messages.map((m,i)=>(
                      <div key={i} style={{marginBottom:14}}>
                        <div style={{display:"flex",gap:10,marginBottom:3}}>
                          <span style={{color:m.role==="organization"?"var(--text-primary)":"var(--text-muted)",fontSize:12,fontWeight:700}}>{m.sender}</span>
                          <span style={{color:"var(--text-faint)",fontSize:11}}>{new Date(m.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div style={{...body,paddingLeft:12,borderLeft:`2px solid ${m.role==="organization"?"var(--accent)":"var(--border-hi)"}`}}>{m.message}</div>
                      </div>
                    ))
                  }
                  <div ref={chatEnd}/>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleChat()}
                    placeholder="Type message..." style={{...inp,flex:1}} onFocus={onFocus} onBlur={onBlur}/>
                  <Btn onClick={handleChat} variant="ghost">Send</Btn>
                </div>
              </Card>
            )}

            {/* STEP 4 — Escrow & Payment */}
            {["negotiating","locked","released"].includes(detail.status)&&detail.agreedBounty>0&&(
              <Card accent>
                <SectionHead>Step 4 — Escrow & Payment</SectionHead>

                {/* Status description */}
                <div style={{...body,marginBottom:16}}>
                  {detail.status==="negotiating" && "Bounty agreed. Lock ETH in smart contract. Exploit stays hidden until you release payment."}
                  {detail.status==="locked"       && "ETH is locked on-chain. Release payment to receive the exploit code."}
                  {detail.status==="released"     && "Payment released. Exploit code is now visible below."}
                </div>

                {/* Lock button */}
                {detail.status==="negotiating"&&(
                  <Btn onClick={handleLock} disabled={action==="lock"}>
                    {action==="lock"?"Locking...":`Lock $${detail.agreedBounty?.toLocaleString()} in Escrow`}
                  </Btn>
                )}

                {/* Release button */}
                {detail.status==="locked"&&(
                  <Btn onClick={handleRelease} disabled={action==="release"}>
                    {action==="release"?"Releasing...":"Release Payment & Reveal Exploit"}
                  </Btn>
                )}

                {/* ── Exploit code — shown after release ── */}
                {detail.status==="released"&&(
                  <div style={{marginTop:16}}>
                    <Label>Exploit Code — Revealed After Payment</Label>

                    {(detail.revealedExploit || detail.exploitCode) ? (
                      <pre style={{
                        background:  "var(--raised)",
                        border:      "1px solid var(--border-hi)",
                        borderRadius: 4,
                        padding:     16,
                        color:       "var(--text-secondary)",
                        fontSize:    12,
                        maxHeight:   320,
                        overflowY:   "auto",
                        fontFamily:  "'Space Mono', monospace",
                        lineHeight:  1.7,
                        whiteSpace:  "pre-wrap",
                        wordBreak:   "break-word",
                        marginTop:   8,
                      }}>
                        {detail.revealedExploit || detail.exploitCode}
                      </pre>
                    ) : (
                      <div style={{
                        background:  "var(--raised)",
                        border:      "1px dashed var(--border)",
                        borderRadius: 4,
                        padding:     20,
                        marginTop:   8,
                        color:       "var(--text-faint)",
                        fontSize:    12,
                        lineHeight:  1.8,
                      }}>
                        ⚠ Exploit code not loaded in this session.
                        <br/>
                        <Btn
                          variant="ghost"
                          style={{marginTop:12,fontSize:11}}
                          onClick={handleFetchExploit}>
                          ↻ Fetch Exploit Code
                        </Btn>
                      </div>
                    )}
                  </div>
                )}

                {/* Etherscan link */}
                {detail.txHash&&(
                  <a href={`https://sepolia.etherscan.io/tx/${detail.txHash}`} target="_blank" rel="noreferrer"
                    style={{display:"block",color:"var(--text-muted)",fontSize:12,marginTop:16,letterSpacing:"0.06em"}}>
                    View TX on Etherscan →
                  </a>
                )}
              </Card>
            )}

          </div>
        )}
      </div>
    </div>
  );
}