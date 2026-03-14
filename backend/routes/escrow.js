const express = require("express");
const router  = express.Router();
const {
  createOnChain,
  lockEscrow,
  releaseEscrow,
  getOnChainReport,
  getExploit,
} = require("../controllers/escrowController");
const { protect } = require("../middleware/auth");

router.post("/create/:reportId",    protect, createOnChain);
router.post("/lock/:reportId",      protect, lockEscrow);
router.post("/release/:reportId",   protect, releaseEscrow);
router.get("/report/:contractId",   protect, getOnChainReport);
router.get("/exploit/:reportId",    protect, getExploit);

module.exports = router;