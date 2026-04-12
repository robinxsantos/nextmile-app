import { Router, Request, Response } from 'express';
import { Expense } from '../models/Expense.js';
import { Truck } from '../models/Truck.js';
import { syncTripsForDate } from '../services/tripService.js';
import { validateExpenseData, validateExpenseUpdate } from '../middleware/validate.js';
import { requireAdmin, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/expenses/categories?truck=
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { truck } = req.query;
    const filter: any = {};
    if (truck) filter.truck = truck;

    const categories: string[] = await Expense.find(filter).distinct('category');
    const cleaned = categories
      .map((c: string) => c.trim())
      .filter(Boolean)
      .sort();
    res.json({ categories: cleaned });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/by-date?truck=&date= (MUST be before /:id routes)
router.get('/by-date', async (req: Request, res: Response) => {
  try {
    const { truck, date } = req.query;
    if (!truck || !date) {
      res.status(400).json({ error: 'truck and date are required' });
      return;
    }

    const d = new Date(date as string);
    const startOfDay = new Date(d);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 59, 999);

    const expenses = await Expense.find({
      truck,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ createdAt: 1 });

    const items = expenses.map((e) => ({
      _id: e._id,
      category: e.category,
      description: e.description,
      amount: e.amount,
      label: [e.category, e.description].filter(Boolean).join(': '),
    }));

    const total = items.reduce((sum: number, e) => sum + e.amount, 0);

    res.json({ items, total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses?truck=&month=
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { truck, month } = req.query;
    const filter: any = {};

    // Employees can only see their own expenses
    if (req.user?.role === 'employee') {
      filter.createdBy = req.user._id;
      if (req.user.truck) {
        filter.truck = req.user.truck;
      }
    } else if (truck) {
      filter.truck = truck;
    }

    if (month && month !== 'ALL') {
      const year = new Date().getFullYear();
      const m = Number(month) - 1;
      filter.date = {
        $gte: new Date(year, m, 1),
        $lte: new Date(year, m + 1, 0, 23, 59, 59, 999),
      };
    }

    const expenses = await Expense.find(filter)
      .populate('truck', 'truckName')
      .sort({ date: 1 });

    const rows = expenses.map((e) => ({
      _id: e._id,
      truck: e.truck,
      truckName: (e.truck as any)?.truckName || '',
      date: e.date,
      dateIso: e.date.toISOString().slice(0, 10),
      dateText: e.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      category: e.category,
      amount: e.amount,
      description: e.description,
      reimbursed: e.reimbursed || false,
    }));

    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses (admin or employee for their truck)
router.post('/', validateExpenseData, async (req: AuthRequest, res: Response) => {
  try {
    const { truckId, date, category, amount, description } = req.body;

    // Employees can only add expenses for their assigned truck
    if (req.user?.role === 'employee') {
      if (!req.user.truck || String(req.user.truck) !== truckId) {
        res.status(403).json({ error: 'You can only add expenses for your assigned truck.' });
        return;
      }
    }

    if (!truckId) {
      res.status(400).json({ error: 'Truck is required.' });
      return;
    }
    if (!date) {
      res.status(400).json({ error: 'Date is required.' });
      return;
    }
    if (!category?.trim()) {
      res.status(400).json({ error: 'Category is required.' });
      return;
    }
    if (!amount && amount !== 0) {
      res.status(400).json({ error: 'Amount is required.' });
      return;
    }

    const truck = await Truck.findById(truckId);
    if (!truck) {
      res.status(404).json({ error: 'Truck not found.' });
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
      description: (description || '').trim(),
    });

    // Sync trips for this date to update expense totals
    await syncTripsForDate(truck._id as any, parsedDate);

    res.status(201).json(expense);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id (admin, or employee for their truck)
router.put('/:id', validateExpenseUpdate, async (req: AuthRequest, res: Response) => {
  try {
    const { date, category, amount, description } = req.body;

    const existing = await Expense.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    // Employee can only edit expenses for their assigned truck
    if (req.user?.role === 'employee') {
      if (!req.user.truck || String(req.user.truck) !== String(existing.truck)) {
        res.status(403).json({ error: 'You can only edit expenses for your assigned truck.' });
        return;
      }
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
});

// PATCH /api/expenses/:id/toggle-reimbursed (admin only)
router.patch('/:id/toggle-reimbursed', requireAdmin, async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    const newReimbursed = !expense.reimbursed;
    await Expense.findByIdAndUpdate(req.params.id, { reimbursed: newReimbursed });

    // Re-sync trips for this date to update NET
    await syncTripsForDate(expense.truck as any, expense.date);

    res.json({ ok: true, reimbursed: newReimbursed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id (admin, or employee for their truck)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    // Employee can only delete expenses for their assigned truck
    if (req.user?.role === 'employee') {
      if (!req.user.truck || String(req.user.truck) !== String(expense.truck)) {
        res.status(403).json({ error: 'You can only delete expenses for your assigned truck.' });
        return;
      }
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
