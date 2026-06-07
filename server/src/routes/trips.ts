import { Router, Request, Response } from "express";
import { Trip } from "../models/Trip.js";
import { Truck } from "../models/Truck.js";
import {
  prepareTripData,
  syncTripsForDate,
  getExpenseTotalForDate,
  formatTripResponse,
} from "../services/tripService.js";
import {
  validateTripData,
  validateTripUpdate,
  sanitizeString,
} from "../middleware/validate.js";
import { requireAdmin, type AuthRequest } from "../middleware/auth.js";

async function getFirstTripOfDay(truckId: any, date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const trips = await Trip.find({
    truck: truckId,
    date: { $gte: start, $lte: end },
  }).sort({ createdAt: 1 });

  return trips[0] || null;
}

async function recomputeTrip(tripId: any) {
  const trip = await Trip.findById(tripId);
  if (!trip) return;

  const truck = await Truck.findById(trip.truck);

  const recalculated = prepareTripData({
    date: trip.date,
    status: trip.status,
    dayOff: truck?.dayOff ?? 0,
    shipmentNumber: trip.shipmentNumber,
    rate: trip.rate,
    trips: trip.trips,
    crewSalary: trip.crewSalary,
    cashAdvance: trip.cashAdvance,
    reimbursements: trip.reimbursements,
    note: trip.note,
    paid: trip.paid,
    expenses: trip.expenses,
  });

  await Trip.findByIdAndUpdate(tripId, recalculated);
}

const router = Router();

// GET /api/trips/last?truck=
router.get("/last", async (req: Request, res: Response) => {
  try {
    const { truck } = req.query;
    if (!truck) {
      res.status(400).json({ error: "Truck required" });
      return;
    }
    const trip = await Trip.findOne({ truck })
      .populate("truck", "truckName")
      .sort({ date: -1, createdAt: -1 });
    res.json({ trip: trip ? formatTripResponse(trip as any) : null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/trips/bulk-paid (admin only)
router.patch(
  "/bulk-paid",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { ids, paid } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "ids array is required" });
        return;
      }

      let updatedCount = 0;
      for (const id of ids) {
        const trip = await Trip.findById(id);
        if (!trip) continue;
        const totalPayable =
          trip.crewSalary - trip.cashAdvance + trip.reimbursements;
        await Trip.findByIdAndUpdate(id, {
          paid: !!paid,
          payable: paid ? 0 : totalPayable,
        });
        updatedCount++;
      }

      res.json({ ok: true, count: updatedCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// DELETE /api/trips/bulk-delete (admin only)
router.delete(
  "/bulk-delete",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "ids array is required" });
        return;
      }

      // Collect affected truck+date combos for re-sync
      const affectedDates: { truckId: any; date: Date }[] = [];
      for (const id of ids) {
        const trip = await Trip.findById(id);
        if (trip) {
          affectedDates.push({ truckId: trip.truck, date: trip.date });
          await Trip.findByIdAndDelete(id);
        }
      }

      // Re-sync expenses for affected dates
      for (const { truckId, date } of affectedDates) {
        await syncTripsForDate(truckId as any, date);
      }

      res.json({ ok: true, count: affectedDates.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/trips?truck=&start=&end=
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { truck, start, end } = req.query;

    const filter: any = {};

    // Employees can only see trips for their assigned truck
    if (req.user?.role === "employee") {
      if (req.user.truck) {
        filter.truck = req.user.truck;
      } else {
        // Employee with no assigned truck sees nothing
        res.json({ rows: [] });
        return;
      }
    } else if (truck) {
      // Admin can filter by any truck
      const truckDoc = await Truck.findById(truck);
      if (!truckDoc) {
        res.json({ rows: [] });
        return;
      }
      filter.truck = truckDoc._id;
    }

    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = new Date(start as string);
      if (end) {
        const endDate = new Date(end as string);
        endDate.setHours(23, 59, 59, 999);
        filter.date.$lte = endDate;
      }
    }

    const trips = await Trip.find(filter)
      .populate("truck", "truckName")
      .sort({ date: 1, createdAt: 1 });

    const rows = trips.map((t) => formatTripResponse(t as any));
    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trips
router.post("/", validateTripData, async (req: AuthRequest, res: Response) => {
  try {
    const {
      truckId,
      date,
      status,
      shipmentNumber,
      rate,
      trips,
      crewSalary,
      cashAdvance,
      reimbursements,
      note,
    } = req.body;
    const isAdmin = req.user?.role === "admin";

    if (!truckId) {
      res.status(400).json({ error: "Truck is required." });
      return;
    }

    const truck = await Truck.findById(truckId);
    if (!truck) {
      res.status(404).json({ error: "Truck not found." });
      return;
    }

    if (!date) {
      res.status(400).json({ error: "Date is required." });
      return;
    }

    // Drivers/employees can add shipment number and note only.
    // Admins still need rate and crew salary for Working Day trips.
    if (isAdmin && status === "Working Day" && (!rate || Number(rate) <= 0)) {
      res.status(400).json({ error: "Rate is required for Working Day." });
      return;
    }
    if (
      isAdmin &&
      status === "Working Day" &&
      (!crewSalary || Number(crewSalary) <= 0)
    ) {
      res
        .status(400)
        .json({ error: "Crew Salary is required for Working Day." });
      return;
    }

    const parsedDate = new Date(date);
    const { total: expenseTotal } = await getExpenseTotalForDate(
      truck._id as any,
      parsedDate,
    );

    // Check if this is the first trip for this date
    const startOfDay = new Date(parsedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(parsedDate);
    endOfDay.setHours(23, 59, 59, 999);
    const existingTrips = await Trip.countDocuments({
      truck: truck._id,
      date: { $gte: startOfDay, $lte: endOfDay },
    });
    const applyExpense = existingTrips === 0;

    // 🔥 STEP 1: compute reimbursement FIRST
    let finalReimbursement = isAdmin ? Number(reimbursements) || 0 : 0;

    if (finalReimbursement > 0) {
      const firstTrip = await getFirstTripOfDay(truck._id, parsedDate);

      if (firstTrip && existingTrips > 0) {
        await Trip.findByIdAndUpdate(firstTrip._id, {
          $inc: { reimbursements: finalReimbursement },
        });

        // 🔥 ADD THIS LINE
        await recomputeTrip(firstTrip._id);

        finalReimbursement = 0;
      }
    }

    // 🔥 STEP 2: NOW build tripData
    const tripData = prepareTripData({
      date: parsedDate,
      status,
      dayOff: truck.dayOff,
      shipmentNumber,
      rate: isAdmin ? Number(rate) || 0 : 0,
      trips: isAdmin ? Number(trips) || 0 : 0,
      crewSalary: isAdmin ? Number(crewSalary) || 0 : 0,
      cashAdvance: isAdmin ? Number(cashAdvance) || 0 : 0,
      reimbursements: finalReimbursement, // ✅ CLEAN
      note,
      expenses: applyExpense ? expenseTotal : 0,
    });

    const trip = await Trip.create({
      truck: truck._id,
      createdBy: req.user?._id || null,
      ...tripData,
    });

    // Re-sync all trips for this date if there are multiple
    // if (existingTrips > 0) {
    //   await syncTripsForDate(truck._id as any, parsedDate);
    // }

    const populated = await Trip.findById(trip._id).populate(
      "truck",
      "truckName",
    );
    res.status(201).json(formatTripResponse(populated as any));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/trips/:id (admin, or owner of unpaid trip)
router.put(
  "/:id",
  validateTripUpdate,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        date,
        status,
        shipmentNumber,
        rate,
        trips,
        crewSalary,
        cashAdvance,
        reimbursements,
        note,
      } = req.body;

      const existingTrip = await Trip.findById(req.params.id).populate(
        "truck",
        "truckName dayOff",
      );
      if (!existingTrip) {
        res.status(404).json({ error: "Trip not found." });
        return;
      }

      // Non-admin can only edit their own unpaid trips
      if (req.user?.role !== "admin") {
        const isOwner =
          existingTrip.createdBy &&
          String(existingTrip.createdBy) === String(req.user?._id);
        if (!isOwner || existingTrip.paid) {
          res
            .status(403)
            .json({ error: "You can only edit your own unpaid trips." });
          return;
        }
      }

      const truck = await Truck.findById(existingTrip.truck);
      if (!truck) {
        res.status(404).json({ error: "Truck not found." });
        return;
      }
      const parsedDate = date ? new Date(date) : existingTrip.date;

      let finalReimbursement = Number(reimbursements) || 0;

      const firstTrip = await getFirstTripOfDay(truck._id, parsedDate);
      const isFirst = String(firstTrip?._id) === String(existingTrip._id);

      if (!isFirst && finalReimbursement > 0 && firstTrip) {
        const diff = finalReimbursement - (existingTrip.reimbursements || 0);

        await Trip.findByIdAndUpdate(firstTrip._id, {
          $inc: { reimbursements: diff },
        });

        // 🔥 ADD THIS LINE
        await recomputeTrip(firstTrip._id);

        finalReimbursement = 0;
      }

      const tripData = prepareTripData({
        date: parsedDate,
        status,
        dayOff: truck?.dayOff ?? 0,
        shipmentNumber,
        rate: Number(rate) || 0,
        trips: Number(trips) || 0,
        crewSalary: Number(crewSalary) || 0,
        cashAdvance: Number(cashAdvance) || 0,
        reimbursements: finalReimbursement, // ✅ FIXED
        note,
        paid: existingTrip.paid,
        expenses: existingTrip.expenses,
      });

      await Trip.findByIdAndUpdate(req.params.id, tripData);

      const updated = await Trip.findById(req.params.id).populate(
        "truck",
        "truckName",
      );
      res.json(formatTripResponse(updated as any));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// DELETE /api/trips/:id (admin, or owner of unpaid trip)
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      res.status(404).json({ error: "Trip not found." });
      return;
    }

    // Non-admin can only delete their own unpaid trips
    if (req.user?.role !== "admin") {
      const isOwner =
        trip.createdBy && String(trip.createdBy) === String(req.user?._id);
      if (!isOwner || trip.paid) {
        res
          .status(403)
          .json({ error: "You can only delete your own unpaid trips." });
        return;
      }
    }

    const truckId = trip.truck;
    const tripDate = trip.date;

    await Trip.findByIdAndDelete(req.params.id);

    // Re-sync remaining trips for this date
    // await syncTripsForDate(truckId as any, tripDate);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/trips/:id/quick-edit (admin only)
router.patch(
  "/:id/quick-edit",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { field, value } = req.body;
      const allowedFields = [
        "rate",
        "trips",
        "crewSalary",
        "cashAdvance",
        "reimbursements",
        "note",
        "verificationStatus",
      ];

      if (!allowedFields.includes(field)) {
        res.status(400).json({ error: "Invalid field" });
        return;
      }

      const trip = await Trip.findById(req.params.id).populate(
        "truck",
        "dayOff",
      );
      if (!trip) {
        res.status(404).json({ error: "Trip not found" });
        return;
      }

      // Update the field
      // 1. Apply field update
      if (field === "note" || field === "verificationStatus") {
        (trip as any)[field] = value;
      } else {
        (trip as any)[field] = Number(value) || 0;
      }

      if (field === "reimbursements") {
        const parsedDate = trip.date;
        const firstTrip = await getFirstTripOfDay(trip.truck, parsedDate);
        const isFirst = String(firstTrip?._id) === String(trip._id);

        if (!isFirst && Number(value) > 0) {
          const diff = Number(value) - (trip.reimbursements || 0);

          await Trip.findByIdAndUpdate(firstTrip._id, {
            $inc: { reimbursements: diff },
          });

          // 🔥 ADD THIS LINE
          await recomputeTrip(firstTrip._id);

          (trip as any)[field] = 0;
        }
      }

      // 2. Recalculate numeric fields only
      const recalculated = prepareTripData({
        date: trip.date,
        status: trip.status,
        dayOff: (trip.truck as any)?.dayOff,
        shipmentNumber: trip.shipmentNumber,
        rate: trip.rate,
        trips: trip.trips,
        crewSalary: trip.crewSalary,
        cashAdvance: trip.cashAdvance,
        reimbursements: trip.reimbursements,
        note: trip.note,
        paid: trip.paid,
        expenses: trip.expenses,
      });

      // 3. Merge WITHOUT losing verificationStatus
      const updatePayload: any = {
        ...recalculated,
      };

      // 🔥 explicitly set only when needed
      if (field === "verificationStatus") {
        updatePayload.verificationStatus = value;
      }

      await Trip.findByIdAndUpdate(req.params.id, updatePayload);

      // Re-sync expenses for this date

      const result = await Trip.findById(req.params.id).populate(
        "truck",
        "truckName",
      );
      res.json(formatTripResponse(result as any));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// PATCH /api/trips/:id/toggle-paid (admin only)
router.patch(
  "/:id/toggle-paid",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const trip = await Trip.findById(req.params.id);
      if (!trip) {
        res.status(404).json({ error: "Trip not found." });
        return;
      }

      const newPaid = !trip.paid;
      const totalPayable =
        trip.crewSalary - trip.cashAdvance + trip.reimbursements;

      await Trip.findByIdAndUpdate(req.params.id, {
        paid: newPaid,
        payable: newPaid ? 0 : totalPayable,
      });

      const updated = await Trip.findById(req.params.id).populate(
        "truck",
        "truckName",
      );
      res.json(formatTripResponse(updated as any));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
