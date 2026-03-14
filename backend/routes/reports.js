const express = require("express");
const router  = express.Router();
const {
  submitReport, getMyReports, getOrgReports, getReport,
  sendMessage, proposeBounty, acceptProposal,
  addTestCase, deleteTestCase, runSandbox, getOrganizations,
} = require("../controllers/reportController");
const { protect } = require("../middleware/auth");

router.post("/submit",                protect, submitReport);
router.get("/my",                     protect, getMyReports);
router.get("/organizations",          protect, getOrganizations);
router.get("/org/all",                protect, getOrgReports);
router.get("/:id",                    protect, getReport);
router.post("/:id/message",           protect, sendMessage);
router.post("/:id/propose",           protect, proposeBounty);
router.post("/:id/accept/:propId",    protect, acceptProposal);
router.post("/:id/testcase",          protect, addTestCase);
router.delete("/:id/testcase/:tcId",  protect, deleteTestCase);
router.post("/:id/sandbox",           protect, runSandbox);

module.exports = router;