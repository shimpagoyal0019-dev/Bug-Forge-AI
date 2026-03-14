const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// @route POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, email, password, role, walletAddress } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    const user = await User.create({
      username,
      email,
      password,
      role:          role || "hacker",
      walletAddress: walletAddress || "",
    });

    res.status(201).json({
      _id:           user._id,
      username:      user.username,
      email:         user.email,
      role:          user.role,
      walletAddress: user.walletAddress,
      token:         generateToken(user._id),
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id:           user._id,
        username:      user.username,
        email:         user.email,
        role:          user.role,
        walletAddress: user.walletAddress,
        token:         generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("LOGIN ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/auth/me
const getMe = async (req, res) => {
  res.json(req.user);
};

// @route GET /api/auth/organizations
// All org accounts + aggregated report stats — used by hacker dashboard
const getOrganizations = async (req, res) => {
  try {
    const Report = require("../models/Report");

    const orgs = await User.find({ role: "organization" })
      .select("_id username email walletAddress createdAt")
      .lean();

    const result = await Promise.all(
      orgs.map(async (org) => {
        // Match reports by organizationName field (the org's username)
        const orgReports = await Report.find({ organizationName: org.username })
          .select("hacker status vulnerabilityType title minBounty agreedBounty cvssScore riskLabel")
          .populate("hacker", "username")
          .lean();

        const uniqueHackers = new Set(
          orgReports.map(r => r.hacker?._id?.toString()).filter(Boolean)
        ).size;

        const totalBountyPaid = orgReports
          .filter(r => r.status === "released")
          .reduce((sum, r) => sum + (r.agreedBounty || 0), 0);

        const recentReports = orgReports.slice(-3).map(r => ({
          title:             r.title,
          vulnerabilityType: r.vulnerabilityType,
          status:            r.status,
          cvssScore:         r.cvssScore,
          riskLabel:         r.riskLabel,
        }));

        return {
          ...org,
          reportCount: orgReports.length,
          uniqueHackers,
          totalBountyPaid,
          recentReports,
        };
      })
    );

    return res.json(result);
  } catch (err) {
    console.error("GET ORGANIZATIONS ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, getMe, getOrganizations };