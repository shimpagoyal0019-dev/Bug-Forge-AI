const { ethers } = require("ethers");
const Report     = require("../models/Report");

const getProvider = () =>
  new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

const CONTRACT_ABI = [
  "function createReport(uint256 _minBounty, string memory _reportHash) external returns (uint256)",
  "function lockBounty(uint256 _id, uint256 _deadline) external payable",
  "function verifyAndRelease(uint256 _id) external",
  "function getReport(uint256 _id) external view returns (tuple(uint256 id, address hacker, address organization, uint256 amount, uint256 minBounty, uint8 status, string reportHash, uint256 createdAt, uint256 deadline))",
  "event ReportCreated(uint256 indexed id, address indexed hacker, uint256 minBounty)",
];

// ── createOnChain ─────────────────────────────────────────────
// Called after hacker's MetaMask tx — saves contractReportId to MongoDB
const createOnChain = async (req, res) => {
  try {
    const { contractReportId, txHash } = req.body;
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.contractReportId = contractReportId;
    report.txHash           = txHash;
    report.updatedAt        = new Date();
    await report.save();

    return res.json({ success: true, contractReportId, txHash });
  } catch (err) {
    console.error("createOnChain ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ── lockEscrow ────────────────────────────────────────────────
// Called after org's MetaMask lockBounty tx — flips status to locked
const lockEscrow = async (req, res) => {
  try {
    const { txHash } = req.body;
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (req.user.role !== "organization") {
      return res.status(403).json({ message: "Org only" });
    }

    report.txHash    = txHash || report.txHash;
    report.status    = "locked";
    report.updatedAt = new Date();
    await report.save();

    const io = req.app.get("io");
    if (io) io.to(req.params.reportId).emit("escrow_locked", { txHash });

    return res.json(report);
  } catch (err) {
    console.error("lockEscrow ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ── releaseEscrow ─────────────────────────────────────────────
// Called after org's MetaMask verifyAndRelease tx — decrypts and returns exploit
const releaseEscrow = async (req, res) => {
  try {
    const { txHash } = req.body;
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (req.user.role !== "organization") {
      return res.status(403).json({ message: "Org only" });
    }

    report.txHash          = txHash || report.txHash;
    report.status          = "released";
    report.exploitRevealed = true;
    report.updatedAt       = new Date();
    await report.save();

    let exploitCode = null;
    try {
      exploitCode = Report.decrypt(report.exploitCodeEncrypted);
    } catch (e) {
      console.error("Decrypt error:", e.message);
      exploitCode = "(decryption error — check ENCRYPT_KEY)";
    }

    const io = req.app.get("io");
    if (io) {
      io.to(req.params.reportId).emit("exploit_revealed", { txHash });
      io.to(req.params.reportId).emit("escrow_released",  { txHash });
    }

    const r = report.toObject();
    delete r.exploitCodeEncrypted;

    return res.json({ ...r, exploitCode });
  } catch (err) {
    console.error("releaseEscrow ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ── getOnChainReport ──────────────────────────────────────────
// Read contract state directly from Sepolia
const getOnChainReport = async (req, res) => {
  try {
    if (!process.env.CONTRACT_ADDRESS) {
      return res.status(500).json({ message: "CONTRACT_ADDRESS not set" });
    }
    const provider = getProvider();
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );
    const data = await contract.getReport(req.params.contractId);
    return res.json({
      id:           Number(data.id),
      hacker:       data.hacker,
      organization: data.organization,
      amount:       ethers.formatEther(data.amount),
      minBounty:    ethers.formatEther(data.minBounty),
      status:       Number(data.status),
      deadline:     Number(data.deadline),
    });
  } catch (err) {
    console.error("getOnChainReport ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ── getExploit ────────────────────────────────────────────────
// Re-fetch decrypted exploit after page reload — org only, released reports only
const getExploit = async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (req.user.role !== "organization") {
      return res.status(403).json({ message: "Org only" });
    }
    if (report.status !== "released") {
      return res.status(403).json({ message: "Payment not released yet" });
    }

    let exploitCode = null;
    try {
      exploitCode = Report.decrypt(report.exploitCodeEncrypted);
    } catch (e) {
      console.error("getExploit decrypt error:", e.message);
      exploitCode = "(decryption error — check ENCRYPT_KEY)";
    }

    return res.json({ exploitCode });
  } catch (err) {
    console.error("getExploit ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createOnChain,
  lockEscrow,
  releaseEscrow,
  getOnChainReport,
  getExploit,
};