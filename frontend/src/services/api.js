import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL
});

API.interceptors.request.use((req) => {
  const user = localStorage.getItem("user");
  if (user) {
    req.headers.Authorization = `Bearer ${JSON.parse(user).token}`;
  }
  return req;
});

// ── Auth ──────────────────────────────────────────────────
export const register = (data) => API.post("/api/auth/register", data);
export const login    = (data) => API.post("/api/auth/login",    data);
export const getMe    = ()     => API.get("/api/auth/me");

// ── Reports ───────────────────────────────────────────────
export const submitReport  = (data) => API.post("/api/reports/submit",   data);
export const getMyReports  = ()     => API.get("/api/reports/my");
export const getOrgReports = ()     => API.get("/api/reports/org/all");
export const getReport     = (id)   => API.get(`/api/reports/${id}`);
export const sendMessage   = (id, data) => API.post(`/api/reports/${id}/message`, data);
export const agreeBounty   = (id, data) => API.put(`/api/reports/${id}/agree`,    data);
export const proposeBounty = (id, data) => API.post(`/api/reports/${id}/propose`, data);
export const acceptProposal= (id, propId) => API.post(`/api/reports/${id}/accept/${propId}`);
export const getOrganizations = () => API.get("/api/reports/organizations");

// ── Sandbox ───────────────────────────────────────────────
export const addTestCase   = (id, data) => API.post(`/api/reports/${id}/testcase`,       data);
export const deleteTestCase= (id, tcId) => API.delete(`/api/reports/${id}/testcase/${tcId}`);
export const runSandbox    = (id)       => API.post(`/api/reports/${id}/sandbox`);

// ── Escrow ────────────────────────────────────────────────
// All three called AFTER MetaMask tx completes — just save txHash to DB
export const createOnChain    = (reportId, data) => API.post(`/api/escrow/create/${reportId}`,  data);
export const lockEscrow       = (reportId, data) => API.post(`/api/escrow/lock/${reportId}`,    data);
export const releaseEscrow    = (reportId, data) => API.post(`/api/escrow/release/${reportId}`, data);
export const getOnChainReport = (contractId)     => API.get(`/api/escrow/report/${contractId}`);
export const getExploit = (reportId) => API.get(`/api/escrow/exploit/${reportId}`);