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
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
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

function toRow(p: any) {
  return {
    _id: p._id,
    truck: p.truck,
    truckName: p.truck?.truckName || "",
    uploadedBy: p.uploadedBy?.displayName || "",
    category: p.category,
    recipient: p.recipient,
    amount: p.amount,
    method: p.method,
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
  };
}

// GET /api/payments?truck=&month=
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { truck, month } = req.query;

    const filter: Record<string, any> = {};
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

    res.json({ rows: payments.map(toRow) });
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
      const { truckId, category, recipient, amount, method, date, note } =
        req.body;
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

      const ext = path.extname(file.originalname);
      const dateStr = `${parsedDate.getFullYear()}-${String(
        parsedDate.getMonth() + 1,
      ).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;

      const displayFilename = `${category} - ${dateStr}${ext}`;

      const payment = await Payment.create({
        truck: truck._id,
        uploadedBy: req.user!._id,
        category: String(category).trim(),
        recipient: String(recipient || "").trim(),
        amount: Number(amount || 0),
        method: String(method || "").trim(),
        date: parsedDate,
        filename: displayFilename,
        originalFilename: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        note: String(note || "").trim(),
      });

      const populated = await Payment.findById(payment._id)
        .populate("truck", "truckName")
        .populate("uploadedBy", "displayName");

      if (!populated) {
        res.status(500).json({ error: "Failed to reload payment" });
        return;
      }

      res.status(201).json({ payment: toRow(populated) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// PUT /api/payments/:id
router.put(
  "/:id",
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { truckId, category, recipient, amount, method, date, note } =
        req.body;
      const file = req.file;

      const payment = await Payment.findById(id);
      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
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
      if (Number.isNaN(parsedDate.getTime())) {
        res.status(400).json({ error: "Invalid date" });
        return;
      }
      parsedDate.setHours(12, 0, 0, 0);

      let filename = payment.filename;
      let originalFilename = payment.originalFilename;
      let filePath = payment.filePath;
      let fileSize = payment.fileSize;
      let mimeType = payment.mimeType;

      if (file) {
        try {
          if (payment.filePath && fs.existsSync(payment.filePath)) {
            fs.unlinkSync(payment.filePath);
          }
        } catch {
          // ignore old file deletion errors
        }

        const ext = path.extname(file.originalname);
        const dateStr = `${parsedDate.getFullYear()}-${String(
          parsedDate.getMonth() + 1,
        ).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;

        filename = `${category} - ${dateStr}${ext}`;
        originalFilename = file.originalname;
        filePath = file.path;
        fileSize = file.size;
        mimeType = file.mimetype;
      }

      payment.truck = truck._id;
      payment.category = String(category).trim();
      payment.recipient = String(recipient || "").trim();
      payment.amount = Number(amount || 0);
      payment.method = String(method || "").trim();
      payment.date = parsedDate;
      payment.note = String(note || "").trim();
      payment.filename = filename;
      payment.originalFilename = originalFilename;
      payment.filePath = filePath;
      payment.fileSize = fileSize;
      payment.mimeType = mimeType;

      await payment.save();

      const populated = await Payment.findById(payment._id)
        .populate("truck", "truckName")
        .populate("uploadedBy", "displayName");

      if (!populated) {
        res.status(500).json({ error: "Failed to reload payment" });
        return;
      }

      res.json({ payment: toRow(populated) });
    } catch (err: any) {
      console.error("Error updating payment:", err);
      res.status(500).json({ error: err.message || "Update failed" });
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

    try {
      if (payment.filePath && fs.existsSync(payment.filePath)) {
        fs.unlinkSync(payment.filePath);
      }
    } catch {
      // ignore file deletion issues
    }

    await Payment.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
