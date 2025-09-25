// backend/index.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

// CORS: allow frontend requests and Authorization header
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ====== Config ======
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/notesnest";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// ====== MongoDB ======
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Mongo Error:", err));

// ====== Schemas & Models ======
const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  plan: { type: String, enum: ["free", "pro"], default: "free" }, // free = 3 note limit
});
const Tenant = mongoose.model("Tenant", tenantSchema);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "member"], default: "member" },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
});
const User = mongoose.model("User", userSchema);

const noteSchema = new mongoose.Schema(
  {
    title: String,
    details: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
  },
  { timestamps: true }
);
const Note = mongoose.model("Note", noteSchema);

// ====== Auth Middleware ======
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "No token" });
  const token = auth.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, tenantId }
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function roleCheck(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.role !== role) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

// ====== Auth Routes ======
// Login (email + password) -> returns { token, user }
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email+password required" });

    const user = await User.findOne({ email }).populate("tenant");
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, tenantId: String(user.tenant._id) },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: { email: user.email, role: user.role, tenant: user.tenant.slug, plan: user.tenant.plan },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Auth/me -> returns current user info based on token
app.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("tenant");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      user: { email: user.email, role: user.role, tenant: user.tenant.slug, plan: user.tenant.plan },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ====== Notes CRUD (tenant-isolated) ======
// List notes for tenant
app.get("/api/notes", authMiddleware, async (req, res) => {
  try {
    const notes = await Note.find({ tenant: req.user.tenantId }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Create note with subscription gating
app.post("/api/notes", authMiddleware, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(400).json({ error: "Tenant not found" });

    // if free plan, limit to 3 notes
    if (tenant.plan === "free") {
      const count = await Note.countDocuments({ tenant: tenant._id });
      if (count >= 3) {
        return res.status(403).json({ error: "Free plan limit reached. Upgrade to Pro." });
      }
    }

    const note = await Note.create({
      title: req.body.title,
      details: req.body.details,
      user: req.user.id,
      tenant: req.user.tenantId,
    });
    res.status(201).json(note);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// Get single note (tenant enforced)
app.get("/api/notes/:id", authMiddleware, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, tenant: req.user.tenantId });
    if (!note) return res.status(404).json({ error: "Not found" });
    res.json(note);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

// Update note
app.put("/api/notes/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Note.findOneAndUpdate(
      { _id: req.params.id, tenant: req.user.tenantId },
      { title: req.body.title, details: req.body.details },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

// Delete note
app.delete("/api/notes/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Note.findOneAndDelete({ _id: req.params.id, tenant: req.user.tenantId });
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "Invalid request" });
  }
});

// ====== Tenant upgrade (admin only) ======
app.post("/tenants/:slug/upgrade", authMiddleware, async (req, res) => {
  try {
    // Ensure the requester is admin in the same tenant
    const requestingUser = await User.findById(req.user.id).populate("tenant");
    if (!requestingUser) return res.status(401).json({ error: "Unauthorized" });

    // verify user's tenant slug matches :slug
    const tenant = await Tenant.findOne({ slug: req.params.slug });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    if (String(requestingUser.tenant._id) !== String(tenant._id)) {
      return res.status(403).json({ error: "Cannot upgrade another tenant" });
    }

    if (requestingUser.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    tenant.plan = "pro";
    await tenant.save();
    res.json({ success: true, tenant: { slug: tenant.slug, plan: tenant.plan } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ====== Health endpoint ======
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ====== Seed function (creates tenants + 4 test users) ======
async function seed() {
  try {
    const existing = await Tenant.findOne({ slug: "acme" });
    if (existing) {
      console.log("Seed: tenants/users already present (skipping)");
      return;
    }

    // create tenants
    const acme = await Tenant.create({ name: "Acme Corp", slug: "acme", plan: "free" });
    const globex = await Tenant.create({ name: "Globex Corp", slug: "globex", plan: "free" });

    const passwd = await bcrypt.hash("password", 10);

    // users: admin + member for each tenant
    await User.create([
      { email: "admin@acme.test", password: passwd, role: "admin", tenant: acme._id },
      { email: "user@acme.test", password: passwd, role: "member", tenant: acme._id },
      { email: "admin@globex.test", password: passwd, role: "admin", tenant: globex._id },
      { email: "user@globex.test", password: passwd, role: "member", tenant: globex._id },
    ]);

    console.log("Seed complete: created tenants + test users (password = password)");
  } catch (err) {
    console.error("Seed error:", err);
  }
}

seed();

// ====== Start Server ======
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
