const Report = require("../models/Report");
const axios  = require("axios");

/* ─── helpers ─────────────────────────────────────────── */

// Safe JSON-serialisable view of a report for the hacker
// Never leaks exploitCodeEncrypted to the org (or anyone unexpected)
const safeReport = (doc, requestingUserId) => {
  const r = doc.toObject ? doc.toObject() : { ...doc };
  // Remove the raw encrypted blob — hacker sees "(encrypted)", org sees nothing until released
  delete r.exploitCodeEncrypted;
  return r;
};

/* ─── submit ───────────────────────────────────────────── */
const submitReport = async (req, res) => {
  try {
    const {
      title, description, vulnerabilityType, affectedSystem,
      affectedUsers, organizationName, hackerWallet,
      exploitCode,           // plain-text from hacker form
      exploitability, impact,
    } = req.body;

    if (!exploitCode || !exploitCode.trim()) {
      return res.status(400).json({ message: "Exploit simulation code is required" });
    }

    // ── ML scoring ──────────────────────────────────────
    let scoring = null;
    try {
      const { data } = await axios.post(
        `${process.env.AI_ENGINE_URL}/predict-bounty`,
        { vulnerabilityType, affectedUsers, exploitability, impact, affectedSystem },
        { timeout: 8000 }
      );
      scoring = data;
    } catch {
      // Fallback CVSS table if AI engine is down
      const cvssMap = {
        easy:   { critical: 9.8, high: 8.5, medium: 7.0, low: 5.5 },
        medium: { critical: 8.8, high: 7.5, medium: 6.0, low: 4.5 },
        hard:   { critical: 7.5, high: 6.5, medium: 5.0, low: 3.5 },
      };
      const cvss = (cvssMap[exploitability] || cvssMap.medium)[impact] || 6.0;
      const label = cvss >= 9 ? "CRITICAL" : cvss >= 7 ? "HIGH" : cvss >= 4 ? "MEDIUM" : "LOW";
      const min   = Math.round(cvss * 500);
      scoring = {
        cvssScore:       cvss,
        riskLabel:       label,
        minBounty:       min,
        recommendedBounty: Math.round(min * 1.3),
        confidenceBand:  { low: min, high: Math.round(min * 2) },
        aiUsed:          false,
      };
    }

    // ── Build and encrypt report ─────────────────────────
    const report = new Report({
      title, description, vulnerabilityType, affectedSystem,
      affectedUsers:      affectedUsers || 1000,
      organizationName:   organizationName || "Unknown",
      hackerWallet:       hackerWallet || "",
      hacker:             req.user._id,
      exploitRevealed:    false,
      cvssScore:          scoring.cvssScore,
      riskLabel:          scoring.riskLabel,
      minBounty:          scoring.minBounty,
      recommendedBounty:  scoring.recommendedBounty,
      confidenceBand:     scoring.confidenceBand,
      status:             "pending",
    });

    // Use the model's instance method to encrypt + set the field
    report.setExploit(exploitCode);

    await report.save();

    return res.status(201).json({
      message: "Report submitted",
      reportId: report._id,
      scoring,
    });
  } catch (err) {
    console.error("submitReport ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};

/* ─── list: hacker's own reports ──────────────────────── */
const getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ hacker: req.user._id })
      .select("-exploitCodeEncrypted")
      .sort({ createdAt: -1 });
    return res.json(reports);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ─── list: org sees all reports for their org ─────────── */
const getOrgReports = async (req, res) => {
  try {
    const reports = await Report.find({ organizationName: req.user.username })
      .select("-exploitCodeEncrypted")
      .populate("hacker", "username email walletAddress")
      .sort({ createdAt: -1 });
    return res.json(reports);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ─── single report ────────────────────────────────────── */
const getReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("hacker", "username email walletAddress");

    if (!report) return res.status(404).json({ message: "Report not found" });

    // Auth: only hacker who owns it or org can view
    const isHacker = report.hacker?._id?.toString() === req.user._id.toString();
    const isOrg    = req.user.role === "organization";
    if (!isHacker && !isOrg) {
      return res.status(403).json({ message: "Access denied" });
    }

    const r = report.toObject();
    delete r.exploitCodeEncrypted; // never send the encrypted blob to client
    return res.json(r);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ─── org adds test case ───────────────────────────────── */
const addTestCase = async (req, res) => {
  try {
    const { description, testScript } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.orgTestCases.push({ description, testScript, addedBy: req.user._id });
    // Move to testing once org adds their first test case
    if (report.status === "pending") report.status = "testing";
    report.updatedAt = new Date();
    await report.save();

    const r = report.toObject();
    delete r.exploitCodeEncrypted;
    return res.json(r);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ─── org deletes test case ────────────────────────────── */
const deleteTestCase = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.orgTestCases = report.orgTestCases.filter(
      tc => tc._id.toString() !== req.params.tcId
    );
    report.updatedAt = new Date();
    await report.save();

    const r = report.toObject();
    delete r.exploitCodeEncrypted;
    return res.json(r);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ─── chat message ─────────────────────────────────────── */
const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const msg = {
      sender:    req.user.username,
      senderId:  req.user._id,
      role:      req.user.role === "organization" ? "organization" : "hacker",
      message,
      timestamp: new Date(),
    };
    report.messages.push(msg);
    report.updatedAt = new Date();
    await report.save();

    const io = req.app.get("io");
    if (io) io.to(req.params.id).emit("new_message", msg);

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ─── propose bounty ───────────────────────────────────── */
const proposeBounty = async (req, res) => {
  try {
    const { amount, message } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (amount < report.minBounty) {
      return res.status(400).json({
        message: `Amount $${amount} is below the ML floor of $${report.minBounty}`,
      });
    }

    const proposal = {
      proposedBy: req.user.role === "organization" ? "organization" : "hacker",
      amount: Number(amount),
      message: message || "",
      status: "pending",
      timestamp: new Date(),
    };
    report.bountyProposals.push(proposal);
    if (report.status === "testing") report.status = "negotiating";
    report.updatedAt = new Date();
    await report.save();

    const io = req.app.get("io");
    if (io) io.to(req.params.id).emit("new_proposal", proposal);

    const r = report.toObject();
    delete r.exploitCodeEncrypted;
    return res.json(r);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ─── accept proposal ──────────────────────────────────── */
const acceptProposal = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const proposal = report.bountyProposals.id(req.params.propId);
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    proposal.status    = "accepted";
    report.agreedBounty = proposal.amount;
    report.status       = "negotiating"; // stays negotiating until escrow locked
    report.updatedAt    = new Date();
    await report.save();

    const io = req.app.get("io");
    if (io) io.to(req.params.id).emit("bounty_agreed", { agreedBounty: proposal.amount });

    const r = report.toObject();
    delete r.exploitCodeEncrypted;
    return res.json({ report: r, agreedBounty: proposal.amount });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
/* ─── run sandbox (mocked) ─────────────────────────────── */
const runSandbox = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (req.user.role !== "organization") {
      return res.status(403).json({ message: "Org only" });
    }
    if (!report.orgTestCases?.length) {
      return res.status(400).json({ message: "Add test cases first" });
    }

    // Decrypt hacker's exploit code to run against test cases
    let exploitCode = "";
    try {
      exploitCode = Report.decrypt(report.exploitCodeEncrypted);
    } catch {
      exploitCode = "exports.isVulnerable = true;";
    }

    // Run each test case against the exploit simulation
    const vm     = require("vm");
    const logs   = [];
    let   passed = 0;

    for (let i = 0; i < report.orgTestCases.length; i++) {
      const tc = report.orgTestCases[i];
      let output = "";
      let tcPass = false;

      try {
        // Sandbox: load hacker's exports, then run org's test script
        const hackerEnv = {};
        const hackerCtx = vm.createContext({ exports: hackerEnv, console: { log: (m) => { output += m + "\n"; } } });
        vm.runInContext(exploitCode, hackerCtx, { timeout: 2000 });

        const testCtx = vm.createContext({
          hackerEnv,
          console: { log: (m) => { output += m + "\n"; } }
        });
        vm.runInContext(tc.testScript, testCtx, { timeout: 2000 });

        tcPass = output.includes("VULNERABILITY_CONFIRMED");
        if (tcPass) passed++;
      } catch (e) {
        output += `ERROR: ${e.message}`;
      }

      logs.push(`[${i+1}/${report.orgTestCases.length}] ${tc.description}: ${tcPass ? "PASS" : "FAIL"}\n${output}`);

      // Emit progress via socket
      const io = req.app.get("io");
      if (io) io.to(req.params.id).emit("sandbox_progress", {
        testCase: i + 1, total: report.orgTestCases.length,
        description: tc.description, passed: tcPass, output
      });
    }

    const allPassed    = passed === report.orgTestCases.length;
    const finalOutput  = logs.join("\n\n");
    const finalStatus  = allPassed ? "passed" : "failed";

    report.sandboxStatus = finalStatus;
    report.sandboxOutput = finalOutput;
    report.sandboxRanAt  = new Date();
    if (allPassed && report.status === "testing") report.status = "negotiating";
    report.updatedAt = new Date();
    await report.save();

    const io = req.app.get("io");
    if (io) io.to(req.params.id).emit("sandbox_complete", {
      status: finalStatus, output: finalOutput, passed: allPassed
    });

    return res.json({ passed: allPassed, status: finalStatus, output: finalOutput });
  } catch (err) {
    console.error("runSandbox ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

/* ─── get all organisations ────────────────────────────── */
const getOrganizations = async (req, res) => {
  try {
    const User = require("../models/User");

    const orgs = await User.find({ role: "organization" })
      .select("_id username email")
      .lean();

    // Attach stats for each org
    const enriched = await Promise.all(orgs.map(async (org) => {
      const reports = await Report.find({ organizationName: org.username })
        .select("status agreedBounty hacker cvssScore riskLabel vulnerabilityType title")
        .populate("hacker", "username")
        .lean();

      const uniqueHackers  = new Set(reports.map(r => r.hacker?._id?.toString())).size;
      const totalBountyPaid = reports
        .filter(r => r.status === "released")
        .reduce((sum, r) => sum + (r.agreedBounty || 0), 0);

      return {
        ...org,
        reportCount:    reports.length,
        uniqueHackers,
        totalBountyPaid,
        recentReports:  reports.slice(0, 3).map(r => ({
          title:           r.title,
          vulnerabilityType: r.vulnerabilityType,
          cvssScore:       r.cvssScore,
          riskLabel:       r.riskLabel,
          status:          r.status,
        })),
      };
    }));

    return res.json(enriched);
  } catch (err) {
    console.error("getOrganizations ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};
module.exports = {
  submitReport, getMyReports, getOrgReports, getReport,
  addTestCase, deleteTestCase, sendMessage,
  proposeBounty, acceptProposal,
  runSandbox, getOrganizations,
};