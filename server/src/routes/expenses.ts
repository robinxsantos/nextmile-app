import { Router, Response } from "express";
import { Expense } from "../models/Expense.js";
import { Truck } from "../models/Truck.js";
import { ExpenseCategory } from "./ExpenseCategory.js";
import { syncTripsForDate } from "../services/tripService.js";
import {
  validateExpenseData,
  validateExpenseUpdate,
} from "../middleware/validate.js";
import {
  requireAuth,
  requireManagerOrAdmin,
  canAccessTruck,
  type AuthRequest,
} from "../middleware/auth.js";

const router = Router();

// GET /api/expenses/categories?truck=
router.get(
  "/categories",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { truck } = req.query;

      const filter: any = {};

      if (req.user?.role === "employee") {
        if (!req.user.truck) {
          res.json({ categories: [] });
          return;
        }

        filter.truck = req.user.truck;
      } else if (req.user?.role === "manager") {
        const companyName = String(req.user.companyName || "").trim();

        if (!companyName) {
          res.json({ categories: [] });
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

      const categories: string[] =
        await Expense.find(filter).distinct("category");

      const cleaned = categories
        .map((c: string) => c.trim())
        .filter(Boolean)
        .sort();

      res.json({ categories: cleaned });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/expenses/category-settings?truck=
router.get(
  "/category-settings",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { truck } = req.query;

      if (!truck) {
        res.json({ categories: [] });
        return;
      }

      const truckId = String(truck);

      const allowed = await canAccessTruck(req, truckId);

      if (!allowed) {
        res.status(403).json({
          error: "You do not have access to this truck.",
        });
        return;
      }

      const categories = await ExpenseCategory.find({
        truck: truckId,
      }).sort({ name: 1 });

      res.json({
        categories: categories.map((category) => ({
          _id: category._id,
          name: category.name,
          reimbursable: category.reimbursable,
        })),
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message,
      });
    }
  },
);

// PUT /api/expenses/category-settings
router.put(
  "/category-settings",
  requireManagerOrAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { truckId, name, reimbursable } = req.body;

      if (!truckId) {
        res.status(400).json({
          error: "Truck is required.",
        });
        return;
      }

      const allowed = await canAccessTruck(req, String(truckId));

      if (!allowed) {
        res.status(403).json({
          error: "You do not have access to this truck.",
        });
        return;
      }

      const categoryName = String(name || "")
        .trim()
        .toUpperCase();

      if (!categoryName) {
        res.status(400).json({
          error: "Category name is required.",
        });
        return;
      }

      const category = await ExpenseCategory.findOneAndUpdate(
        {
          truck: truckId,
          name: categoryName,
        },
        {
          $set: {
            reimbursable: Boolean(reimbursable),
          },
          $setOnInsert: {
            truck: truckId,
            name: categoryName,
          },
        },
        {
          new: true,
          upsert: true,
        },
      );

      res.json({
        category: {
          _id: category._id,
          name: category.name,
          reimbursable: category.reimbursable,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message,
      });
    }
  },
);

// GET /api/expenses/by-date?truck=&date=
router.get("/by-date", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { truck, date } = req.query;

    if (!truck || !date) {
      res.status(400).json({
        error: "truck and date are required",
      });
      return;
    }

    const truckId = String(truck);

    const allowed = await canAccessTruck(req, truckId);

    if (!allowed) {
      res.status(403).json({
        error: "You do not have access to this truck.",
      });
      return;
    }

    const d = new Date(String(date));

    const startOfDay = new Date(d);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 59, 999);

    const expenses = await Expense.find({
      truck: truckId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }).sort({ createdAt: 1 });

    const items = expenses.map((e) => ({
      _id: e._id,
      category: e.category,
      description: e.description,
      amount: e.amount,
      reimbursed: e.reimbursed || false,
      label: [e.category, e.description].filter(Boolean).join(": "),
    }));

    const total = items.reduce((sum: number, e) => sum + e.amount, 0);

    res.json({ items, total });
  } catch (err: any) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// GET /api/expenses/summary?truck=&year=&month=
router.get("/summary", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { truck, year, month } = req.query;

    const selectedYear = Number(year) || new Date().getFullYear();
    const selectedMonth = Number(month) || new Date().getMonth() + 1;

    if (selectedMonth < 1 || selectedMonth > 12) {
      res.status(400).json({
        error: "Month must be between 1 and 12.",
      });
      return;
    }

    const filter: any = {};

    // Employee: own created expenses + assigned truck only.
    if (req.user?.role === "employee") {
      if (!req.user.truck) {
        res.json({
          currentTotal: 0,
          previousTotal: 0,
          monthlyTotals: Array(12).fill(0),
        });
        return;
      }

      filter.createdBy = req.user._id;
      filter.truck = req.user.truck;
    }

    // Manager: expenses under their company.
    else if (req.user?.role === "manager") {
      const companyName = String(req.user.companyName || "").trim();

      if (!companyName) {
        res.json({
          currentTotal: 0,
          previousTotal: 0,
          monthlyTotals: Array(12).fill(0),
        });
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
    }

    // Admin: all expenses, or requested truck.
    else if (req.user?.role === "admin" && truck) {
      filter.truck = String(truck);
    }

    // Full selected year for Jan-Dec sparkline.
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

    const yearlyExpenses = await Expense.find({
      ...filter,
      date: {
        $gte: yearStart,
        $lte: yearEnd,
      },
    }).select("date amount reimbursed");

    const monthlyTotals = Array(12).fill(0);

    for (const expense of yearlyExpenses) {
      if (expense.reimbursed) continue;

      const expenseDate = new Date(expense.date);

      monthlyTotals[expenseDate.getMonth()] += Number(expense.amount || 0);
    }

    const currentTotal = monthlyTotals[selectedMonth - 1] || 0;

    // Previous month may belong to the previous year.
    let previousYear = selectedYear;
    let previousMonthIndex = selectedMonth - 2;

    if (previousMonthIndex < 0) {
      previousMonthIndex = 11;
      previousYear -= 1;
    }

    let previousTotal = 0;

    if (previousYear === selectedYear) {
      previousTotal = monthlyTotals[previousMonthIndex] || 0;
    } else {
      const previousStart = new Date(previousYear, previousMonthIndex, 1);
      const previousEnd = new Date(
        previousYear,
        previousMonthIndex + 1,
        0,
        23,
        59,
        59,
        999,
      );

      const previousExpenses = await Expense.find({
        ...filter,
        date: {
          $gte: previousStart,
          $lte: previousEnd,
        },
      }).select("amount");

      previousTotal = previousExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0,
      );
    }

    const yearTotal = monthlyTotals.reduce((sum, total) => sum + total, 0);

    const previousYearStart = new Date(selectedYear - 1, 0, 1);
    const previousYearEnd = new Date(selectedYear - 1, 11, 31, 23, 59, 59, 999);

    const previousYearExpenses = await Expense.find({
      ...filter,
      date: {
        $gte: previousYearStart,
        $lte: previousYearEnd,
      },
    }).select("amount");

    const previousYearTotal = previousYearExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0,
    );

    res.json({
      currentTotal,
      previousTotal,
      yearTotal,
      previousYearTotal,
      monthlyTotals,
    });
  } catch (err: any) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// GET /api/expenses?truck=&month=&start=&end=
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { truck, month, start, end } = req.query;

    const filter: any = {};

    // Employee: own created expenses + assigned truck only.
    if (req.user?.role === "employee") {
      if (!req.user.truck) {
        res.json({ rows: [] });
        return;
      }

      filter.createdBy = req.user._id;
      filter.truck = req.user.truck;
    }

    // Manager: every expense under their company.
    else if (req.user?.role === "manager") {
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
    }

    // Admin: all expenses, or requested truck.
    else if (req.user?.role === "admin" && truck) {
      filter.truck = String(truck);
    }

    if (start || end) {
      filter.date = {};

      if (start) {
        const startDate = new Date(String(start));
        startDate.setHours(0, 0, 0, 0);
        filter.date.$gte = startDate;
      }

      if (end) {
        const endDate = new Date(String(end));
        endDate.setHours(23, 59, 59, 999);
        filter.date.$lte = endDate;
      }
    } else if (month && month !== "ALL") {
      const year = new Date().getFullYear();
      const m = Number(month) - 1;

      filter.date = {
        $gte: new Date(year, m, 1),
        $lte: new Date(year, m + 1, 0, 23, 59, 59, 999),
      };
    }

    const expenses = await Expense.find(filter)
      .populate("truck", "truckName companyName")
      .sort({ date: 1 });

    const rows = expenses.map((e: any) => ({
      tripId: e.tripId,
      _id: e._id,
      truck: e.truck,
      truckName: e.truck?.truckName || "",
      date: e.date,
      dateIso: e.date.toISOString().slice(0, 10),
      dateText: e.date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      category: e.category,
      amount: e.amount,
      description: e.description,
      reimbursed: e.reimbursed || false,
    }));

    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// POST /api/expenses (admin or employee for their truck)
router.post(
  "/",
  requireAuth,
  validateExpenseData,
  async (req: AuthRequest, res: Response) => {
    try {
      const { truckId, date, category, amount, description, tripId } = req.body;

      if (!truckId) {
        res.status(400).json({ error: "Truck is required." });
        return;
      }

      const allowed = await canAccessTruck(req, String(truckId));

      if (!allowed) {
        res.status(403).json({
          error: "You do not have access to this truck.",
        });
        return;
      }

      if (!date) {
        res.status(400).json({ error: "Date is required." });
        return;
      }
      if (!category?.trim()) {
        res.status(400).json({ error: "Category is required." });
        return;
      }
      if (!amount && amount !== 0) {
        res.status(400).json({ error: "Amount is required." });
        return;
      }

      const truck = await Truck.findById(truckId);
      if (!truck) {
        res.status(404).json({ error: "Truck not found." });
        return;
      }

      const parsedDate = new Date(date);
      parsedDate.setHours(12, 0, 0, 0);

      const expense = await Expense.create({
        truck: truck._id,
        createdBy: req.user?._id || null,
        date: parsedDate,
        category: category.trim(),
        amount: Number(amount) || 0,
        description: (description || "").trim(),
        tripId: tripId || null, // 🔥 ADD THIS
      });

      // Sync trips for this date to update expense totals
      await syncTripsForDate(truck._id as any, parsedDate);

      res.status(201).json(expense);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// PUT /api/expenses/:id (admin, or employee for their truck)
router.put(
  "/:id",
  requireAuth,
  validateExpenseUpdate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { date, category, amount, description } = req.body;

      const existing = await Expense.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: "Expense not found." });
        return;
      }

      const allowed = await canAccessTruck(req, String(existing.truck));

      if (!allowed) {
        res.status(403).json({
          error: "You do not have access to this expense.",
        });
        return;
      }

      const parsedDate = date ? new Date(date) : existing.date;
      parsedDate.setHours(12, 0, 0, 0);

      await Expense.findByIdAndUpdate(req.params.id, {
        date: parsedDate,
        category: category?.trim() || existing.category,
        amount: Number(amount) ?? existing.amount,
        description: description?.trim() ?? existing.description,
      });

      // Sync trips for both old and new dates
      await syncTripsForDate(existing.truck as any, existing.date);
      if (parsedDate.toDateString() !== existing.date.toDateString()) {
        await syncTripsForDate(existing.truck as any, parsedDate);
      }

      const updated = await Expense.findById(req.params.id);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// PATCH /api/expenses/:id/toggle-reimbursed (admin only)
router.patch(
  "/:id/toggle-reimbursed",
  requireManagerOrAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const expense = await Expense.findById(req.params.id);
      if (!expense) {
        res.status(404).json({ error: "Expense not found." });
        return;
      }

      const allowed = await canAccessTruck(req, String(expense.truck));

      if (!allowed) {
        res.status(403).json({
          error: "You do not have access to this expense.",
        });
        return;
      }

      const newReimbursed = !expense.reimbursed;
      await Expense.findByIdAndUpdate(req.params.id, {
        reimbursed: newReimbursed,
      });

      // Re-sync trips for this date to update NET
      await syncTripsForDate(expense.truck as any, expense.date);

      res.json({ ok: true, reimbursed: newReimbursed });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// DELETE /api/expenses/:id (admin, or employee for their truck)
router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.status(404).json({ error: "Expense not found." });
      return;
    }

    const allowed = await canAccessTruck(req, String(expense.truck));

    if (!allowed) {
      res.status(403).json({
        error: "You do not have access to this expense.",
      });
      return;
    }

    const truckId = expense.truck;
    const expenseDate = expense.date;

    await Expense.findByIdAndDelete(req.params.id);

    // Re-sync trips for this date
    await syncTripsForDate(truckId as any, expenseDate);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
