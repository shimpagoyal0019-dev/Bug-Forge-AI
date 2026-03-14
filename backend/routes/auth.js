const express = require("express");
const router  = express.Router();
const { register, login, getMe, getOrganizations } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/register", register);
router.post("/login",    login);
router.get("/me",        protect, getMe);
router.get("/organizations", protect, getOrganizations);

module.exports = router;