import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import truckRoutes from "./routes/trucks.js";
import tripRoutes from "./routes/trips.js";
import expenseRoutes from "./routes/expenses.js";
import dashboardRoutes from "./routes/dashboard.js";
import authRoutes, { ensureDefaultAdmin } from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import paymentRoutes from "./routes/payments.js";
import { requireAuth } from "./middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://nextmileph.vercel.app"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(morgan("dev"));

// Public routes (no auth required)
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/trucks", requireAuth, truckRoutes);
app.use("/api/trips", requireAuth, tripRoutes);
app.use("/api/expenses", requireAuth, expenseRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve React frontend in production
// if (process.env.NODE_ENV === "production") {
//   const clientDist = path.join(__dirname, "../../client/dist");
//   app.use(express.static(clientDist));

//   app.get("*", (_req, res) => {
//     res.sendFile(path.join(clientDist, "index.html"));
//   });
// }

// Error handler
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  },
);

// Start
async function start() {
  await connectDB();

  // 🔥 AUTO-CREATE ADMIN
  const adminResult = await ensureDefaultAdmin();
  if (adminResult.created) {
    console.log("✅ Default admin created (admin / admin123)");
  } else {
    console.log("ℹ️ Admin already exists");
  }

  app.listen(PORT, () => {
    console.log(`🚀 NEXTMILE API running on http://localhost:${PORT}`);
  });
}

start();
