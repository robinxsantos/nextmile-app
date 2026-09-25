import { Router, Response } from "express";
import { Truck } from "../models/Truck.js";
import { Trip } from "../models/Trip.js";
import { Expense } from "../models/Expense.js";
import { User } from "../models/User.js";
import { dayNameShort } from "../utils/calculations.js";
import { validateTruckData } from "../middleware/validate.js";
import {
  requireAuth,
  requireManagerOrAdmin,
  canAccessTruck,
  type AuthRequest,
} from "../middleware/auth.js";

const router = Router();

async function recalculateLastChangeOil(truckId: string) {
  const truck = await Truck.findById(truckId);

  if (!truck) return null;

  const history = [...(truck.changeOilHistory || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  truck.lastChangeOil =
    history.length > 0 ? Number(history[0].odometer ?? 0) : null;

  await truck.save();

  return truck;
}

// GET /api/trucks - List all trucks
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const filter: Record<string, any> = {};

    if (req.user?.role === "manager") {
      const companyName = String(req.user.companyName || "").trim();

      if (!companyName) {
        res.json({
          rows: [],
          total: 0,
          active: 0,
          inactive: 0,
          sheets: 0,
        });
        return;
      }

      filter.companyName = companyName;
    }

    if (req.user?.role === "employee") {
      if (!req.user.truck) {
        res.json({
          rows: [],
          total: 0,
          active: 0,
          inactive: 0,
          sheets: 0,
        });
        return;
      }

      filter._id = req.user.truck;
    }

    const trucks = await Truck.find(filter).sort({ createdAt: -1 });

    const rows = trucks.map((t) => {
      const isMonthly = t.cutoffType === "monthly";

      return {
        _id: t._id,
        truckName: t.truckName,
        companyName: t.companyName || "",

        status: t.status,
        cutoffType: t.cutoffType || "weekly",
        client: t.client || t.notes || "",

        billingType: t.billingType || "subcontracted",

        billedTo: t.billedTo || "",

        lastChangeOil: t.lastChangeOil ?? null,

        changeOilHistory: t.changeOilHistory || [],

        notes: t.notes,
        cutoffStart: t.cutoffStart,
        cutoffEnd: t.cutoffEnd,
        payday: t.payday,
        dayOff: t.dayOff,
        cutoffStartText: isMonthly
          ? String(t.cutoffStart)
          : dayNameShort(t.cutoffStart),
        cutoffEndText: isMonthly
          ? String(t.cutoffEnd)
          : dayNameShort(t.cutoffEnd),
        paydayText: isMonthly ? String(t.payday) : dayNameShort(t.payday),
        dayOffText: isMonthly ? "-" : dayNameShort(t.dayOff),
        dateAdded: t.createdAt.toISOString().slice(0, 10),
      };
    });

    const total = trucks.length;
    const active = trucks.filter((t) => t.status === "Active").length;
    const inactive = trucks.filter((t) => t.status === "Inactive").length;

    res.json({ rows, total, active, inactive, sheets: total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trucks - Create truck (admin or manager)
router.post(
  "/",
  requireManagerOrAdmin,
  validateTruckData,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        truckName,
        companyName,
        status,
        cutoffType = "weekly",
        client,
        billingType = "subcontracted",
        billedTo,
        notes,
        cutoffStart,
        cutoffEnd,
        payday,
        dayOff,
      } = req.body;

      if (!truckName?.trim()) {
        res.status(400).json({ error: "Truck name is required." });
        return;
      }

      let finalCompanyName = "";

      if (req.user?.role === "manager") {
        finalCompanyName = String(req.user.companyName || "").trim();

        if (!finalCompanyName) {
          res.status(400).json({
            error: "Your manager account does not have an assigned company.",
          });
          return;
        }
      } else {
        finalCompanyName = String(companyName || "").trim();

        if (!finalCompanyName) {
          res.status(400).json({
            error: "Company name is required.",
          });
          return;
        }
      }

      const existing = await Truck.findOne({
        truckName: { $regex: new RegExp(`^${truckName.trim()}$`, "i") },
      });

      if (existing) {
        res.status(400).json({ error: "Truck already exists." });
        return;
      }

      const truck = await Truck.create({
        truckName: truckName.trim(),
        companyName: finalCompanyName,
        status: status || "Active",
        cutoffType,
        client: client?.trim() || notes?.trim() || "",

        billingType: billingType === "direct" ? "direct" : "subcontracted",

        billedTo: billingType === "direct" ? "" : billedTo?.trim() || "",
        notes: notes || "",
        cutoffStart: cutoffStart ?? 1,
        cutoffEnd: cutoffEnd ?? 6,
        payday: payday ?? 6,
        dayOff: dayOff ?? 0,
      });

      res.status(201).json(truck);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// PUT /api/trucks/:id - Update truck (admin or own-company manager)
router.put(
  "/:id",
  requireManagerOrAdmin,
  validateTruckData,
  async (req: AuthRequest, res: Response) => {
    try {
      const existingTruck = await Truck.findById(req.params.id);

      if (!existingTruck) {
        res.status(404).json({ error: "Truck not found." });
        return;
      }

      const allowed = await canAccessTruck(req, String(existingTruck._id));

      if (!allowed) {
        res.status(403).json({
          error: "You do not have access to this truck.",
        });
        return;
      }
      const {
        truckName,
        companyName,
        status,
        cutoffType = "weekly",
        client,
        billingType = "subcontracted",
        billedTo,
        notes,
        cutoffStart,
        cutoffEnd,
        payday,
        dayOff,
      } = req.body;

      const finalCompanyName =
        req.user?.role === "manager"
          ? String(req.user.companyName || "").trim()
          : String(companyName || "").trim();

      if (!finalCompanyName) {
        res.status(400).json({
          error: "Company name is required.",
        });
        return;
      }

      if (!truckName?.trim()) {
        res.status(400).json({ error: "Truck name is required." });
        return;
      }

      const truck = await Truck.findByIdAndUpdate(
        req.params.id,
        {
          truckName: truckName.trim(),
          companyName: finalCompanyName,
          status: status || "Active",
          cutoffType,
          client: client?.trim() || notes?.trim() || "",

          billingType: billingType === "direct" ? "direct" : "subcontracted",

          billedTo: billingType === "direct" ? "" : billedTo?.trim() || "",
          notes: notes || "",
          cutoffStart: cutoffStart ?? 1,
          cutoffEnd: cutoffEnd ?? 6,
          payday: payday ?? 6,
          dayOff: dayOff ?? 0,
        },
        { new: true },
      );

      if (!truck) {
        res.status(404).json({ error: "Truck not found." });
        return;
      }

      res.json(truck);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// POST /api/trucks/:id/change-oil - Add change oil history record
router.post(
  "/:id/change-oil",
  requireManagerOrAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const allowed = await canAccessTruck(req, String(req.params.id));

      if (!allowed) {
        res.status(403).json({
          error: "You do not have access to this truck.",
        });
        return;
      }
      const { date, odometer, notes } = req.body;

      if (!date) {
        res.status(400).json({ error: "Change oil date is required." });
        return;
      }

      const odometerNum = Number(odometer);

      if (!Number.isFinite(odometerNum) || odometerNum < 0) {
        res.status(400).json({ error: "Odometer must be a valid number." });
        return;
      }

      const changeOilDate = new Date(date);

      if (Number.isNaN(changeOilDate.getTime())) {
        res.status(400).json({ error: "Invalid change oil date." });
        return;
      }

      // Keep date stable regardless of timezone.
      changeOilDate.setHours(12, 0, 0, 0);

      const truck = await Truck.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            changeOilHistory: {
              date: changeOilDate,
              odometer: odometerNum,
              notes: String(notes || "").trim(),
            },
          },
        },
        { new: true },
      );

      if (!truck) {
        res.status(404).json({ error: "Truck not found." });
        return;
      }

      const updatedTruck = await recalculateLastChangeOil(
        String(req.params.id),
      );

      res.json(updatedTruck);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// PUT /api/trucks/:id/change-oil/:recordId - Edit change oil record
router.put(
  "/:id/change-oil/:recordId",
  requireManagerOrAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const allowed = await canAccessTruck(req, String(req.params.id));

      if (!allowed) {
        res.status(403).json({
          error: "You do not have access to this truck.",
        });
        return;
      }
      const { date, odometer, notes } = req.body;

      if (!date) {
        res.status(400).json({ error: "Change oil date is required." });
        return;
      }

      const odometerNum = Number(odometer);

      if (!Number.isFinite(odometerNum) || odometerNum < 0) {
        res.status(400).json({
          error: "Odometer must be a valid number.",
        });
        return;
      }

      const changeOilDate = new Date(date);

      if (Number.isNaN(changeOilDate.getTime())) {
        res.status(400).json({ error: "Invalid change oil date." });
        return;
      }

      changeOilDate.setHours(12, 0, 0, 0);

      const truck = await Truck.findOneAndUpdate(
        {
          _id: req.params.id,
          "changeOilHistory._id": req.params.recordId,
        },
        {
          $set: {
            "changeOilHistory.$.date": changeOilDate,
            "changeOilHistory.$.odometer": odometerNum,
            "changeOilHistory.$.notes": String(notes || "").trim(),
          },
        },
        { new: true },
      );

      if (!truck) {
        res.status(404).json({
          error: "Truck or change oil record not found.",
        });
        return;
      }

      const updatedTruck = await recalculateLastChangeOil(
        String(req.params.id),
      );

      res.json(updatedTruck);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// DELETE /api/trucks/:id/change-oil/:recordId - Delete change oil record
router.delete(
  "/:id/change-oil/:recordId",
  requireManagerOrAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const allowed = await canAccessTruck(req, String(req.params.id));

      if (!allowed) {
        res.status(403).json({
          error: "You do not have access to this truck.",
        });
        return;
      }
      const truck = await Truck.findByIdAndUpdate(
        req.params.id,
        {
          $pull: {
            changeOilHistory: {
              _id: req.params.recordId,
            },
          },
        },
        { new: true },
      );

      if (!truck) {
        res.status(404).json({ error: "Truck not found." });
        return;
      }

      const updatedTruck = await recalculateLastChangeOil(
        String(req.params.id),
      );

      res.json(updatedTruck);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// DELETE /api/trucks/:id - Delete truck + cascade
// Requires current user's password confirmation.
router.delete(
  "/:id",
  requireManagerOrAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { password } = req.body;

      if (!password || !String(password).trim()) {
        res.status(400).json({
          error: "Password is required to delete a truck.",
        });
        return;
      }

      const truck = await Truck.findById(req.params.id);

      if (!truck) {
        res.status(404).json({
          error: "Truck not found.",
        });
        return;
      }

      const allowed = await canAccessTruck(req, String(truck._id));

      if (!allowed) {
        res.status(403).json({
          error: "You do not have access to this truck.",
        });
        return;
      }

      // Load the authenticated user WITH password hash.
      const currentUser = await User.findById(req.user?._id);

      if (!currentUser || !currentUser.active) {
        res.status(401).json({
          error: "Invalid user account.",
        });
        return;
      }

      const passwordMatches = await currentUser.comparePassword(
        String(password),
      );

      if (!passwordMatches) {
        res.status(401).json({
          error: "Incorrect password.",
        });
        return;
      }

      // Password confirmed. Cascade delete related records.
      await Trip.deleteMany({
        truck: truck._id,
      });

      await Expense.deleteMany({
        truck: truck._id,
      });

      await Truck.findByIdAndDelete(truck._id);

      res.json({
        ok: true,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message,
      });
    }
  },
);

export default router;
