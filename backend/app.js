const express    = require("express");
const cors       = require("cors");
const dotenv     = require("dotenv");
const http       = require("http");
const { Server } = require("socket.io");
const connectDB  = require("./config/db");

dotenv.config();
connectDB();

const app    = express();
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:  process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join_report",  (reportId) => {
    socket.join(reportId);
    console.log(`Socket ${socket.id} joined room: ${reportId}`);
  });
  socket.on("leave_report", (reportId) => socket.leave(reportId));
  socket.on("disconnect",   () => console.log("Socket disconnected:", socket.id));
});

// ── CORS — must come BEFORE routes ───────────────────────────
app.use(cors({
  origin:         process.env.FRONTEND_URL || "http://localhost:3000",
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth",    require("./routes/auth"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/escrow",  require("./routes/escrow"));

app.get("/", (req, res) =>
  res.json({ status: "BugForge AI Backend", version: "2.0.0" })
);

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` })
);

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err.message);
  res.status(500).json({ message: err.message || "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

module.exports = { app, server, io };