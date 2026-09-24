import { Router, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import fs from "fs";
import { Payment } from "../models/Payment.js";
import { Truck } from "../models/Truck.js";
import {
  uploadPaymentFile,
  getPaymentFile,
  deletePaymentFile,
} from "../lib/googleDrive.js";
import {
  requireAuth,
  requireAdmin,
  type AuthRequest,
} from "../middleware/auth.js";

// Configure multer
const storage = multer.memoryStorage();

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
    let uploadedDriveFileId = "";

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

      if (Number.isNaN(parsedDate.getTime())) {
        res.status(400).json({ error: "Invalid date" });
        return;
      }

      parsedDate.setHours(12, 0, 0, 0);

      let uploadBuffer = file.buffer;
      let uploadMimeType = file.mimetype;

      const originalName = file.originalname.toLowerCase();

      const isHeic =
        file.mimetype === "image/heic" ||
        file.mimetype === "image/heif" ||
        originalName.endsWith(".heic") ||
        originalName.endsWith(".heif");

      if (isHeic) {
        uploadBuffer = await sharp(file.buffer)
          .jpeg({
            quality: 85,
            mozjpeg: true,
          })
          .toBuffer();

        uploadMimeType = "image/jpeg";
      }

      const extensionByMime: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
      };

      const ext = extensionByMime[file.mimetype] || "";

      const dateStr = `${parsedDate.getFullYear()}-${String(
        parsedDate.getMonth() + 1,
      ).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;

      const displayFilename = `${String(category).trim()} - ${dateStr}${ext}`;

      // Upload the image buffer directly to Google Drive
      const driveFile = await uploadPaymentFile(
        file.buffer,
        displayFilename,
        file.mimetype,
      );

      uploadedDriveFileId = driveFile.id!;

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

        // New payments live in Google Drive
        driveFileId: uploadedDriveFileId,

        // Keep empty for backward compatibility with old local payments
        filePath: "",

        fileSize: file.size,
        mimeType: file.mimetype,
        note: String(note || "").trim(),
      });

      const populated = await Payment.findById(payment._id)
        .populate("truck", "truckName")
        .populate("uploadedBy", "displayName");

      if (!populated) {
        throw new Error("Failed to reload payment");
      }

      res.status(201).json({
        payment: toRow(populated),
      });
    } catch (err: any) {
      // If Drive upload succeeded but MongoDB failed,
      // remove the orphaned Drive file.
      if (uploadedDriveFileId) {
        try {
          await deletePaymentFile(uploadedDriveFileId);
        } catch (cleanupError) {
          console.error(
            "Failed to clean up orphaned Drive file:",
            cleanupError,
          );
        }
      }

      console.error("Error uploading payment:", err);

      res.status(500).json({
        error: err.message || "Upload failed",
      });
    }
  },
);

// PUT /api/payments/:id
router.put(
  "/:id",
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    let newDriveFileId = "";

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
      let fileSize = payment.fileSize;
      let mimeType = payment.mimeType;

      if (file) {
        const extensionByMime: Record<string, string> = {
          "image/jpeg": ".jpg",
          "image/png": ".png",
          "image/gif": ".gif",
          "image/webp": ".webp",
        };

        const ext = extensionByMime[file.mimetype] || "";

        const dateStr = `${parsedDate.getFullYear()}-${String(
          parsedDate.getMonth() + 1,
        ).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;

        filename = `${String(category).trim()} - ${dateStr}${ext}`;
        originalFilename = file.originalname;
        fileSize = file.size;
        mimeType = file.mimetype;

        // Upload replacement first.
        // We only delete the old file after the new upload succeeds.
        const driveFile = await uploadPaymentFile(
          file.buffer,
          filename,
          file.mimetype,
        );

        if (!driveFile.id) {
          throw new Error("Google Drive did not return a file ID");
        }

        newDriveFileId = driveFile.id;
      }

      const oldDriveFileId = payment.driveFileId || "";
      const oldFilePath = payment.filePath || "";

      payment.truck = truck._id;
      payment.category = String(category).trim();
      payment.recipient = String(recipient || "").trim();
      payment.amount = Number(amount || 0);
      payment.method = String(method || "").trim();
      payment.date = parsedDate;
      payment.note = String(note || "").trim();
      payment.filename = filename;
      payment.originalFilename = originalFilename;
      payment.fileSize = fileSize;
      payment.mimeType = mimeType;

      if (newDriveFileId) {
        payment.driveFileId = newDriveFileId;
        payment.filePath = "";
      }

      await payment.save();

      // New record is safely saved.
      // Now remove the replaced old proof.
      if (newDriveFileId) {
        if (oldDriveFileId) {
          try {
            await deletePaymentFile(oldDriveFileId);
          } catch (cleanupError) {
            console.error(
              "Failed to delete old Drive payment proof:",
              cleanupError,
            );
          }
        }

        if (oldFilePath && fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (cleanupError) {
            console.error(
              "Failed to delete old local payment proof:",
              cleanupError,
            );
          }
        }
      }

      const populated = await Payment.findById(payment._id)
        .populate("truck", "truckName")
        .populate("uploadedBy", "displayName");

      if (!populated) {
        throw new Error("Failed to reload payment");
      }

      res.json({
        payment: toRow(populated),
      });
    } catch (err: any) {
      // If the new Drive upload succeeded but the DB update failed,
      // remove the newly uploaded file instead of leaving an orphan.
      if (newDriveFileId) {
        try {
          await deletePaymentFile(newDriveFileId);
        } catch (cleanupError) {
          console.error(
            "Failed to clean up replacement Drive file:",
            cleanupError,
          );
        }
      }

      console.error("Error updating payment:", err);

      res.status(500).json({
        error: err.message || "Update failed",
      });
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

    res.setHeader("Content-Type", payment.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${payment.filename}"`,
    );

    // New payments: stream privately from Google Drive
    if (payment.driveFileId) {
      const driveResponse = await getPaymentFile(payment.driveFileId);

      driveResponse.data.on("error", (error) => {
        console.error("Google Drive stream error:", error);

        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to load payment proof" });
        } else {
          res.end();
        }
      });

      driveResponse.data.pipe(res);
      return;
    }

    // Old payments: continue serving from local disk
    if (payment.filePath && fs.existsSync(payment.filePath)) {
      res.sendFile(payment.filePath);
      return;
    }

    res.status(404).json({
      error: "Payment proof file not found",
    });
  } catch (err: any) {
    console.error("Error loading payment proof:", err);

    res.status(500).json({
      error: err.message || "Failed to load payment proof",
    });
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

    // New payments: delete proof from Google Drive
    if (payment.driveFileId) {
      try {
        await deletePaymentFile(payment.driveFileId);
      } catch (error) {
        console.error(
          "Failed to delete payment proof from Google Drive:",
          error,
        );

        res.status(500).json({
          error: "Failed to delete payment proof from Google Drive",
        });
        return;
      }
    }

    // Old payments: delete proof from local disk
    if (payment.filePath && fs.existsSync(payment.filePath)) {
      try {
        fs.unlinkSync(payment.filePath);
      } catch (error) {
        console.error("Failed to delete local payment proof:", error);

        res.status(500).json({
          error: "Failed to delete local payment proof",
        });
        return;
      }
    }

    await Payment.findByIdAndDelete(payment._id);

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Error deleting payment:", err);

    res.status(500).json({
      error: err.message || "Failed to delete payment",
    });
  }
});

export default router;
