const vm     = require("vm");
const Report = require("../models/Report");

/* ── safe vm runner ─────────────────────────────────────── */
const runInSandbox = (code, contextObj = {}, timeoutMs = 4000) => {
  const logs    = [];
  const exports = {};
  const mod     = { exports };

  const sandbox = {
    exports,
    module: mod,
    console: {
      log:   (...a) => logs.push(a.map(v => typeof v === "object" ? JSON.stringify(v) : String(v)).join(" ")),
      error: (...a) => logs.push("[ERR] "  + a.map(String).join(" ")),
      warn:  (...a) => logs.push("[WARN] " + a.map(String).join(" ")),
      info:  (...a) => logs.push("[INFO] " + a.map(String).join(" ")),
    },
    JSON, Math, parseInt, parseFloat, isNaN, isFinite,
    String, Number, Boolean, Array, Object, RegExp, Date, Error,
    // blocked
    Buffer: undefined, process: undefined, require: undefined, global: undefined,
    ...contextObj,
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: timeoutMs, displayErrors: true });

  // merge both export styles: exports.x = ... AND module.exports = { ... }
  const merged = Object.assign({}, sandbox.exports, sandbox.module.exports);
  return { exports: merged, logs };
};

/* ── main handler ───────────────────────────────────────── */
const runSandbox = async (req, res) => {
  const { id } = req.params;
  const io     = req.app.get("io");

  try {
    /* 1. Load report */
    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    /* 2. Org only */
    if (req.user.role !== "organization") {
      return res.status(403).json({ message: "Only organisations can run sandboxes" });
    }

    /* 3. Need test cases */
    if (!report.orgTestCases || report.orgTestCases.length === 0) {
      return res.status(400).json({ message: "Add at least one test case before running the sandbox" });
    }

    /* 4. Need hacker's simulation
         Field is exploitCodeEncrypted (NOT exploitCode) — see Report.js */
    if (!report.exploitCodeEncrypted) {
      return res.status(400).json({ message: "Hacker has not submitted a simulation script yet" });
    }

    /* 5. Decrypt using Report's own static — key/algo guaranteed to match */
    let hackerCode;
    try {
      hackerCode = Report.decrypt(report.exploitCodeEncrypted);
    } catch (e) {
      console.error("Sandbox decrypt error:", e.message);
      return res.status(500).json({ message: "Failed to decrypt hacker simulation", error: e.message });
    }

    if (!hackerCode?.trim()) {
      return res.status(400).json({ message: "Hacker simulation is empty after decryption" });
    }

    /* 6. Run hacker simulation → capture its exports as hackerEnv */
    let hackerEnv  = {};
    let hackerLogs = [];

    try {
      const r = runInSandbox(hackerCode);
      hackerEnv  = r.exports || {};
      hackerLogs = r.logs    || [];
    } catch (e) {
      console.error("Hacker sim vm error:", e.message);
      hackerEnv  = {};
      hackerLogs = [`[Hacker sim crashed] ${e.message}`];
    }

    /* 7. Run each org test case with hackerEnv injected */
    const total   = report.orgTestCases.length;
    let allPassed = true;
    const allLogs = [];

    if (hackerLogs.length) {
      allLogs.push("=== Hacker simulation output ===");
      allLogs.push(...hackerLogs);
      allLogs.push("\n=== Org test results ===\n");
    }

    for (let i = 0; i < total; i++) {
      const tc = report.orgTestCases[i];
      let passed   = false;
      let tcOutput = [];
      let tcError  = null;

      try {
        const { logs } = runInSandbox(tc.testScript, { hackerEnv });
        tcOutput = logs;
        passed   = logs.some(l => l.includes("VULNERABILITY_CONFIRMED"));
      } catch (e) {
        tcError  = e.message;
        tcOutput = [`[ERROR] ${e.message}`];
      }

      if (!passed) allPassed = false;

      allLogs.push(
        [`[${i+1}/${total}] ${tc.description}: ${passed ? "PASS ✓" : "FAIL ✗"}`,
          ...tcOutput,
          tcError ? `  → ${tcError}` : null,
        ].filter(Boolean).join("\n")
      );

      if (io) io.to(id).emit("sandbox_progress", {
        testCase: i + 1, total,
        description: tc.description,
        passed, output: tcOutput.join("\n"),
      });
    }

    /* 8. Persist */
    const sandboxStatus = allPassed ? "passed" : "failed";
    const sandboxOutput = allLogs.join("\n\n");

    report.sandboxStatus = sandboxStatus;
    report.sandboxOutput = sandboxOutput;
    report.sandboxRanAt  = new Date();
    report.updatedAt     = new Date();

    if (report.status === "pending") report.status = "testing";
    if (allPassed && report.status === "testing") report.status = "negotiating";

    await report.save();

    if (io) io.to(id).emit("sandbox_complete", { status: sandboxStatus, output: sandboxOutput, passed: allPassed });

    return res.json({
      status: sandboxStatus, output: sandboxOutput, passed: allPassed,
      report: { _id: report._id, status: report.status, sandboxStatus, sandboxOutput },
    });

  } catch (err) {
    console.error("runSandbox FATAL:", err);
    return res.status(500).json({ message: "Sandbox execution failed", error: err.message });
  }
};

module.exports = { runSandbox };