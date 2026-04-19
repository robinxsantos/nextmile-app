import { Router, Request, Response } from "express";
import { Truck } from "../models/Truck.js";
import { Trip } from "../models/Trip.js";
import { Expense } from "../models/Expense.js";
import { dayNameShort } from "../utils/calculations.js";
import { validateTruckData } from "../middleware/validate.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/trucks - List all trucks
router.get("/", async (_req: Request, res: Response) => {
  try {
    const trucks = await Truck.find().sort({ createdAt: -1 });

    const rows = trucks.map((t) => ({
      _id: t._id,
      truckName: t.truckName,
      status: t.status,
      client: t.client || t.notes || "",
      lastChangeOil: t.lastChangeOil ?? null,
      notes: t.notes,
      cutoffStart: t.cutoffStart,
      cutoffEnd: t.cutoffEnd,
      payday: t.payday,
      dayOff: t.dayOff,
      cutoffStartText: dayNameShort(t.cutoffStart),
      cutoffEndText: dayNameShort(t.cutoffEnd),
      paydayText: dayNameShort(t.payday),
      dayOffText: dayNameShort(t.dayOff),
      dateAdded: t.createdAt.toISOString().slice(0, 10),
    }));

    const total = trucks.length;
    const active = trucks.filter((t) => t.status === "Active").length;
    const inactive = trucks.filter((t) => t.status === "Inactive").length;

    res.json({ rows, total, active, inactive, sheets: total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trucks - Create truck (admin only)
router.post(
  "/",
  requireAdmin,
  validateTruckData,
  async (req: Request, res: Response) => {
    try {
      const {
        truckName,
        status,
        client,
        lastChangeOil,
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

      const existing = await Truck.findOne({
        truckName: { $regex: new RegExp(`^${truckName.trim()}$`, "i") },
      });

      if (existing) {
        res.status(400).json({ error: "Truck already exists." });
        return;
      }

      const truck = await Truck.create({
        truckName: truckName.trim(),
        status: status || "Active",
        client: client?.trim() || notes?.trim() || "",
        lastChangeOil:
          lastChangeOil !== undefined && lastChangeOil !== null
            ? Number(lastChangeOil)
            : null,
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

// PUT /api/trucks/:id - Update truck (admin only)
router.put(
  "/:id",
  requireAdmin,
  validateTruckData,
  async (req: Request, res: Response) => {
    try {
      const {
        truckName,
        status,
        client,
        lastChangeOil,
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

      const truck = await Truck.findByIdAndUpdate(
        req.params.id,
        {
          truckName: truckName.trim(),
          status: status || "Active",
          client: client?.trim() || notes?.trim() || "",
          lastChangeOil:
            lastChangeOil !== undefined && lastChangeOil !== null
              ? Number(lastChangeOil)
              : null,
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

// DELETE /api/trucks/:id - Delete truck + cascade (admin only)
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const truck = await Truck.findById(req.params.id);
    if (!truck) {
      res.status(404).json({ error: "Truck not found." });
      return;
    }

    // Cascade delete trips and expenses
    await Trip.deleteMany({ truck: truck._id });
    await Expense.deleteMany({ truck: truck._id });
    await Truck.findByIdAndDelete(truck._id);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
