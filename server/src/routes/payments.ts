import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Payment } from "../models/Payment.js";
import { Truck } from "../models/Truck.js";
import {
  requireAuth,
  requireAdmin,
  type AuthRequest,
} from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const router = Router();

// All payment routes require auth + admin
router.use(requireAuth, requireAdmin);

// GET /api/payments?truck=&month=
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { truck, month } = req.query;
    const filter: Record<string, unknown> = {};

    if (truck) filter.truck = truck;
    if (month && month !== "ALL") {
      const year = new Date().getFullYear();
      const m = Number(month) - 1;
      filter.date = {
        $gte: new Date(year, m, 1),
        $lte: new Date(year, m + 1, 0, 23, 59, 59, 999),
      };
    }

    const payments = await Payment.find(filter)
      .populate("truck", "truckName")
      .populate("uploadedBy", "displayName")
      .sort({ date: -1, createdAt: -1 });

    const rows = payments.map((p) => ({
      _id: p._id,
      truck: p.truck,
      truckName: (p.truck as any)?.truckName || "",
      uploadedBy: (p.uploadedBy as any)?.displayName || "",
      category: p.category,
      date: p.date,
      dateText: p.date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      filename: p.filename,
      originalFilename: p.originalFilename,
      note: p.note,
      fileSize: p.fileSize,
      mimeType: p.mimeType,
      createdAt: p.createdAt,
    }));

    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/upload
router.post(
  "/upload",
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { truckId, category, date, note } = req.body;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: "File is required" });
        return;
      }
      if (!truckId) {
        res.status(400).json({ error: "Truck is required" });
        return;
      }
      if (!category) {
        res.status(400).json({ error: "Category is required" });
        return;
      }

      const truck = await Truck.findById(truckId);
      if (!truck) {
        res.status(404).json({ error: "Truck not found" });
        return;
      }

      const parsedDate = date ? new Date(date) : new Date();
      parsedDate.setHours(12, 0, 0, 0);

      // Build auto-generated filename
      const ext = path.extname(file.originalname);
      const dateStr = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
      const displayFilename = `${category} - ${dateStr}${ext}`;

      const payment = await Payment.create({
        truck: truck._id,
        uploadedBy: req.user!._id,
        category: category.trim(),
        date: parsedDate,
        filename: displayFilename,
        originalFilename: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        note: (note || "").trim(),
      });

      res.status(201).json(payment);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/payments/:id/file
router.get("/:id/file", async (req: AuthRequest, res: Response) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    if (!fs.existsSync(payment.filePath)) {
      res.status(404).json({ error: "File not found on disk" });
      return;
    }

    res.setHeader("Content-Type", payment.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${payment.filename}"`,
    );
    res.sendFile(payment.filePath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/payments/:id
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }

    // Delete the file from disk
    if (fs.existsSync(payment.filePath)) {
      fs.unlinkSync(payment.filePath);
    }

    await Payment.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
