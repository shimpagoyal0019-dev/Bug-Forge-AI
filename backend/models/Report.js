const mongoose = require("mongoose");
const crypto   = require("crypto");

// Encryption helpers — exploit code never stored in plaintext
const ALGO = "aes-256-cbc";
const KEY  = Buffer.from(
  (process.env.ENCRYPT_KEY || "bugforge_encrypt_key_32bytes!!xx").slice(0, 32)
);

const encrypt = (text) => {
  const iv         = crypto.randomBytes(16);
  const cipher     = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted  = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

const decrypt = (text) => {
  const [ivHex, encHex] = text.split(":");
  const iv              = Buffer.from(ivHex, "hex");
  const enc             = Buffer.from(encHex, "hex");
  const decipher        = crypto.createDecipheriv(ALGO, KEY, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString();
};

/* ─── Sub-schemas ──────────────────────────────────────── */

const MessageSchema = new mongoose.Schema({
  sender:    { type: String },
  senderId:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  role:      { type: String, enum: ["hacker", "organization"] },
  message:   { type: String },
  timestamp: { type: Date, default: Date.now }
});

const BountyProposalSchema = new mongoose.Schema({
  proposedBy: { type: String, enum: ["hacker", "organization"] },
  amount:     { type: Number },
  message:    { type: String, default: "" },
  status:     { type: String, enum: ["pending", "accepted", "countered"], default: "pending" },
  timestamp:  { type: Date, default: Date.now }
});

const OrgTestCaseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  testScript:  { type: String, required: true },
  addedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  addedAt:     { type: Date, default: Date.now }
});

/* ─── Main Report Schema ───────────────────────────────── */

const ReportSchema = new mongoose.Schema({

  // ── What hacker submits (visible to org) ──
  title:            { type: String, required: true },
  description:      { type: String, required: true },
  vulnerabilityType:{ type: String, enum: ["rce","sqli","xss","ssrf","idor","csrf","other"], required: true },
  affectedSystem:   { type: String, required: true },   // e.g. "login endpoint", "payment API"
  affectedUsers:    { type: Number, default: 1000 },

  // ── Hacker's exploit simulation — ENCRYPTED, never sent to org until paid ──
  exploitCodeEncrypted: { type: String, required: true },  // AES encrypted
  exploitRevealed:      { type: Boolean, default: false }, // flips true after on-chain payment

  // ── ML model scoring (platform calculates, hacker cannot set these) ──
  cvssScore:         { type: Number, default: 0 },
  riskLabel:         { type: String, default: "UNKNOWN" },
  minBounty:         { type: Number, default: 0 },
  recommendedBounty: { type: Number, default: 0 },
  minBountyWei:      { type: String, default: "0" },
  confidenceBand:    { low: Number, high: Number },

  // ── Parties ──
  hacker:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  hackerWallet:     { type: String, required: true },
  organization:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  organizationName: { type: String, required: true },

  // ── Org's test cases (org writes these after seeing the report) ──
  orgTestCases: [OrgTestCaseSchema],

  // ── Sandbox ──
  sandboxStatus: { type: String, enum: ["pending","running","passed","failed"], default: "pending" },
  sandboxOutput: { type: String, default: "" },
  sandboxRanAt:  { type: Date },

  // ── Negotiation ──
  bountyProposals: [BountyProposalSchema],
  agreedBounty:    { type: Number, default: 0 },

  // ── Blockchain ──
  contractReportId: { type: Number,  default: null },
  txHash:           { type: String,  default: null },
  ipfsHash:         { type: String,  default: null },

  // ── Status machine ──
  // pending       → report submitted, waiting for org to add test cases
  // testing       → org added test cases, sandbox can run
  // negotiating   → sandbox passed, bounty negotiation in progress
  // locked        → escrow locked on-chain, awaiting fix verification
  // released      → payment confirmed, exploit revealed to org
  // disputed      → disagreement raised
  // refunded      → org refunded
  status: {
    type:    String,
    enum:    ["pending","testing","negotiating","locked","released","disputed","refunded"],
    default: "pending"
  },

  // ── Chat messages (both parties) ──
  messages: [MessageSchema],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/* ─── Instance methods ─────────────────────────────────── */

// Decrypt exploit for org — only call after payment confirmed
ReportSchema.methods.getExploit = function () {
  if (!this.exploitRevealed) throw new Error("Exploit not yet revealed — payment required");
  return decrypt(this.exploitCodeEncrypted);
};

// Encrypt and set exploit
ReportSchema.methods.setExploit = function (plaintext) {
  this.exploitCodeEncrypted = encrypt(plaintext);
};

/* ─── Static helpers ───────────────────────────────────── */
ReportSchema.statics.encrypt = encrypt;
ReportSchema.statics.decrypt = decrypt;

module.exports = mongoose.model("Report", ReportSchema);