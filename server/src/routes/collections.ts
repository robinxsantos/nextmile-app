import { Router, Response } from "express";
import { Collection } from "../models/Collection.js";
import { Trip } from "../models/Trip.js";
import { Truck } from "../models/Truck.js";
import {
  requireAuth,
  requireManagerOrAdmin,
  canAccessTruck,
  type AuthRequest,
} from "../middleware/auth.js";

const router = Router();

// Collections are available to admins and company-scoped managers.
router.use(requireAuth, requireManagerOrAdmin);

// GET /api/collections?truck=
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { truck } = req.query;

    const filter: Record<string, any> = {};

    if (req.user?.role === "manager") {
      const companyName = String(req.user.companyName || "").trim();

      if (!companyName) {
        res.json({ rows: [] });
        return;
      }

      if (truck) {
        const truckId = String(truck);

        const allowed = await canAccessTruck(req, truckId);

        if (!allowed) {
          res.status(403).json({
            error: "You do not have access to this truck.",
          });
          return;
        }

        filter.truck = truckId;
      } else {
        const allowedTrucks = await Truck.find({
          companyName,
        }).select("_id");

        filter.truck = {
          $in: allowedTrucks.map((item) => item._id),
        };
      }
    } else if (req.user?.role === "admin" && truck) {
      filter.truck = String(truck);
    }

    const collections = await Collection.find(filter)
      .populate("truck", "truckName companyName")
      .populate({
        path: "trips",
        select: "date shipmentNumber rate vat status",
      })
      .populate("createdBy", "displayName")
      .sort({ collectionDate: -1, createdAt: -1 });

    res.json({
      rows: collections,
    });
  } catch (err: any) {
    console.error("Error loading collections:", err);

    res.status(500).json({
      error: err.message || "Failed to load collections",
    });
  }
});

// POST /api/collections
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      truckId,
      tripIds,
      collectionDate,
      coverageStartDate,
      coverageEndDate,
      soaNumber,
      method,
      reference,
      billingType,
      adjustments = [],
      note,
    } = req.body;

    if (!truckId) {
      res.status(400).json({ error: "Truck is required" });
      return;
    }

    const allowed = await canAccessTruck(req, String(truckId));

    if (!allowed) {
      res.status(403).json({
        error: "You do not have access to this truck.",
      });
      return;
    }

    if (!Array.isArray(tripIds) || tripIds.length === 0) {
      res.status(400).json({
        error: "At least one trip is required",
      });
      return;
    }

    if (!["Rate Only", "Rate + VAT"].includes(billingType)) {
      res.status(400).json({
        error: "Invalid billing type",
      });
      return;
    }

    const truck = await Truck.findById(truckId);

    if (!truck) {
      res.status(404).json({
        error: "Truck not found",
      });
      return;
    }

    const parsedCollectionDate = collectionDate
      ? new Date(collectionDate)
      : new Date();

    if (Number.isNaN(parsedCollectionDate.getTime())) {
      res.status(400).json({
        error: "Invalid collection date",
      });
      return;
    }

    parsedCollectionDate.setHours(12, 0, 0, 0);

    const parsedCoverageStartDate = coverageStartDate
      ? new Date(coverageStartDate)
      : null;

    const parsedCoverageEndDate = coverageEndDate
      ? new Date(coverageEndDate)
      : null;

    if (
      (parsedCoverageStartDate &&
        Number.isNaN(parsedCoverageStartDate.getTime())) ||
      (parsedCoverageEndDate && Number.isNaN(parsedCoverageEndDate.getTime()))
    ) {
      res.status(400).json({
        error: "Invalid coverage date",
      });
      return;
    }

    if (parsedCoverageStartDate) {
      parsedCoverageStartDate.setHours(12, 0, 0, 0);
    }

    if (parsedCoverageEndDate) {
      parsedCoverageEndDate.setHours(12, 0, 0, 0);
    }

    if (
      (parsedCoverageStartDate && !parsedCoverageEndDate) ||
      (!parsedCoverageStartDate && parsedCoverageEndDate)
    ) {
      res.status(400).json({
        error: "Both coverage start and end dates are required",
      });
      return;
    }

    if (
      parsedCoverageStartDate &&
      parsedCoverageEndDate &&
      parsedCoverageStartDate > parsedCoverageEndDate
    ) {
      res.status(400).json({
        error: "Coverage start date cannot be after end date",
      });
      return;
    }

    // Load the actual trips from MongoDB.
    // Never trust amounts sent by the frontend.
    const trips = await Trip.find({
      _id: { $in: tripIds },
      truck: truck._id,
      status: "Working Day",
    });

    if (trips.length !== tripIds.length) {
      res.status(400).json({
        error: "One or more selected trips are invalid",
      });
      return;
    }

    // Prevent the same trip from being collected twice.
    const existingCollection = await Collection.findOne({
      trips: {
        $in: tripIds,
      },
    });

    if (existingCollection) {
      res.status(409).json({
        error: "One or more selected trips are already collected",
      });
      return;
    }

    if (!Array.isArray(adjustments)) {
      res.status(400).json({
        error: "Adjustments must be an array",
      });
      return;
    }

    const cleanAdjustments = adjustments.map((adjustment: any) => ({
      description: String(adjustment.description || "").trim(),
      type: adjustment.type,
      amount: Number(adjustment.amount || 0),
    }));

    const invalidAdjustment = cleanAdjustments.some(
      (adjustment) =>
        !adjustment.description ||
        !["Add", "Less"].includes(adjustment.type) ||
        !Number.isFinite(adjustment.amount) ||
        adjustment.amount < 0,
    );

    if (invalidAdjustment) {
      res.status(400).json({
        error: "One or more adjustments are invalid",
      });
      return;
    }

    const tripSubtotal = trips.reduce((sum, trip) => {
      const rate = Number(trip.rate || 0);
      const vat = Number(trip.vat || 0);

      return sum + (billingType === "Rate + VAT" ? rate + vat : rate);
    }, 0);

    const adjustmentTotal = cleanAdjustments.reduce(
      (sum, adjustment) =>
        sum +
        (adjustment.type === "Add" ? adjustment.amount : -adjustment.amount),
      0,
    );

    const totalAmount = tripSubtotal + adjustmentTotal;

    if (totalAmount < 0) {
      res.status(400).json({
        error: "Collection total cannot be negative",
      });
      return;
    }

    const collection = await Collection.create({
      truck: truck._id,
      trips: trips.map((trip) => trip._id),
      createdBy: req.user!._id,
      collectionDate: parsedCollectionDate,
      coverageStartDate: parsedCoverageStartDate,
      coverageEndDate: parsedCoverageEndDate,
      soaNumber: String(soaNumber || "").trim(),
      method: String(method || "").trim(),
      reference: String(reference || "").trim(),
      billingType,
      adjustments: cleanAdjustments,
      totalAmount,
      note: String(note || "").trim(),
    });

    const populated = await Collection.findById(collection._id)
      .populate("truck", "truckName")
      .populate({
        path: "trips",
        select: "date shipmentNumber rate vat status",
      })
      .populate("createdBy", "displayName");

    res.status(201).json({
      collection: populated,
    });
  } catch (err: any) {
    console.error("Error creating collection:", err);

    res.status(500).json({
      error: err.message || "Failed to create collection",
    });
  }
});

// PUT /api/collections/:id
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const {
      collectionDate,
      coverageStartDate,
      coverageEndDate,
      soaNumber,
      method,
      reference,
      billingType,
      adjustments = [],
      tripIds,
      note,
    } = req.body;

    if (!["Rate Only", "Rate + VAT"].includes(billingType)) {
      res.status(400).json({
        error: "Invalid billing type",
      });
      return;
    }

    const collection = await Collection.findById(req.params.id);

    if (!collection) {
      res.status(404).json({
        error: "Collection not found",
      });
      return;
    }

    const allowed = await canAccessTruck(req, String(collection.truck));

    if (!allowed) {
      res.status(403).json({
        error: "You do not have access to this collection.",
      });
      return;
    }

    const parsedCollectionDate = collectionDate
      ? new Date(collectionDate)
      : collection.collectionDate;

    if (Number.isNaN(parsedCollectionDate.getTime())) {
      res.status(400).json({
        error: "Invalid collection date",
      });
      return;
    }

    parsedCollectionDate.setHours(12, 0, 0, 0);

    const parsedCoverageStartDate = coverageStartDate
      ? new Date(coverageStartDate)
      : null;

    const parsedCoverageEndDate = coverageEndDate
      ? new Date(coverageEndDate)
      : null;

    if (
      (parsedCoverageStartDate &&
        Number.isNaN(parsedCoverageStartDate.getTime())) ||
      (parsedCoverageEndDate && Number.isNaN(parsedCoverageEndDate.getTime()))
    ) {
      res.status(400).json({
        error: "Invalid coverage date",
      });
      return;
    }

    if (parsedCoverageStartDate) {
      parsedCoverageStartDate.setHours(12, 0, 0, 0);
    }

    if (parsedCoverageEndDate) {
      parsedCoverageEndDate.setHours(12, 0, 0, 0);
    }

    if (
      (parsedCoverageStartDate && !parsedCoverageEndDate) ||
      (!parsedCoverageStartDate && parsedCoverageEndDate)
    ) {
      res.status(400).json({
        error: "Both coverage start and end dates are required",
      });
      return;
    }

    if (
      parsedCoverageStartDate &&
      parsedCoverageEndDate &&
      parsedCoverageStartDate > parsedCoverageEndDate
    ) {
      res.status(400).json({
        error: "Coverage start date cannot be after end date",
      });
      return;
    }

    // REMOVE-ONLY covered trip editing.
    // If tripIds is omitted, keep all currently covered trips.
    const requestedTripIds = Array.isArray(tripIds)
      ? tripIds.map((id: any) => String(id))
      : collection.trips.map((id) => String(id));

    if (requestedTripIds.length === 0) {
      res.status(400).json({
        error: "At least one covered trip must remain",
      });
      return;
    }

    // Reject duplicate trip IDs.
    const uniqueRequestedTripIds = [...new Set(requestedTripIds)];

    if (uniqueRequestedTripIds.length !== requestedTripIds.length) {
      res.status(400).json({
        error: "Duplicate trip IDs are not allowed",
      });
      return;
    }

    // Existing collection trip IDs.
    const existingTripIds = new Set(collection.trips.map((id) => String(id)));

    // For now, editing can only REMOVE existing trips.
    // It cannot add trips that were not already part of this collection.
    const containsNewTrip = uniqueRequestedTripIds.some(
      (id) => !existingTripIds.has(id),
    );

    if (containsNewTrip) {
      res.status(400).json({
        error: "New trips cannot be added to an existing collection",
      });
      return;
    }

    // Reload only the trips that should remain covered.
    const trips = await Trip.find({
      _id: { $in: uniqueRequestedTripIds },
      truck: collection.truck,
      status: "Working Day",
    });

    if (trips.length !== uniqueRequestedTripIds.length) {
      res.status(400).json({
        error: "One or more selected collection trips are invalid",
      });
      return;
    }

    if (!Array.isArray(adjustments)) {
      res.status(400).json({
        error: "Adjustments must be an array",
      });
      return;
    }

    const cleanAdjustments = adjustments.map((adjustment: any) => ({
      description: String(adjustment.description || "").trim(),
      type: adjustment.type,
      amount: Number(adjustment.amount || 0),
    }));

    const invalidAdjustment = cleanAdjustments.some(
      (adjustment) =>
        !adjustment.description ||
        !["Add", "Less"].includes(adjustment.type) ||
        !Number.isFinite(adjustment.amount) ||
        adjustment.amount < 0,
    );

    if (invalidAdjustment) {
      res.status(400).json({
        error: "One or more adjustments are invalid",
      });
      return;
    }

    // Recalculate subtotal using only the trips that remain covered.
    const tripSubtotal = trips.reduce((sum, trip) => {
      const rate = Number(trip.rate || 0);
      const vat = Number(trip.vat || 0);

      return sum + (billingType === "Rate + VAT" ? rate + vat : rate);
    }, 0);

    // Apply Add / Less adjustments.
    const adjustmentTotal = cleanAdjustments.reduce(
      (sum, adjustment) =>
        sum +
        (adjustment.type === "Add" ? adjustment.amount : -adjustment.amount),
      0,
    );

    const totalAmount = tripSubtotal + adjustmentTotal;

    if (totalAmount < 0) {
      res.status(400).json({
        error: "Collection total cannot be negative",
      });
      return;
    }

    collection.collectionDate = parsedCollectionDate;
    collection.coverageStartDate = parsedCoverageStartDate ?? undefined;
    collection.coverageEndDate = parsedCoverageEndDate ?? undefined;

    collection.soaNumber = String(soaNumber || "").trim();
    collection.method = String(method || "").trim();
    collection.reference = String(reference || "").trim();
    collection.billingType = billingType;

    // Save only the trips that remain checked.
    collection.trips = trips.map((trip) => trip._id);

    collection.adjustments = cleanAdjustments;
    collection.totalAmount = totalAmount;
    collection.note = String(note || "").trim();

    await collection.save();

    const populated = await Collection.findById(collection._id)
      .populate("truck", "truckName")
      .populate({
        path: "trips",
        select: "date shipmentNumber rate vat status",
      })
      .populate("createdBy", "displayName");

    res.json({
      collection: populated,
    });
  } catch (err: any) {
    console.error("Error updating collection:", err);

    res.status(500).json({
      error: err.message || "Failed to update collection",
    });
  }
});
// DELETE /api/collections/:id
// Removes the collection batch.
// Covered trips automatically become available for collection again.
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const collection = await Collection.findById(req.params.id);

    if (!collection) {
      res.status(404).json({
        error: "Collection not found",
      });
      return;
    }

    const allowed = await canAccessTruck(req, String(collection.truck));

    if (!allowed) {
      res.status(403).json({
        error: "You do not have access to this collection.",
      });
      return;
    }

    await Collection.findByIdAndDelete(collection._id);

    res.json({
      ok: true,
    });
  } catch (err: any) {
    console.error("Error deleting collection:", err);

    res.status(500).json({
      error: err.message || "Failed to undo collection",
    });
  }
});
export default router;
