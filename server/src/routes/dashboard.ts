import { Router, Request, Response } from 'express';
import { Trip } from '../models/Trip.js';
import { Expense } from '../models/Expense.js';
import { Truck } from '../models/Truck.js';
import { formatTripResponse } from '../services/tripService.js';
import { toISODateString } from '../utils/calculations.js';

const router = Router();

// Helper: calculate KPIs from trips and expenses
function calculateKpis(rows: any[], expenses: any[]) {
  let totalGross = 0;
  let totalTrips = 0;
  let totalPayable = 0;
  let totalCashOutflow = 0;
  let totalCrewSalary = 0;

  rows.forEach((r: any) => {
    totalGross += r.grossIncome || 0;
    totalTrips += r.trips || 0;
    totalCrewSalary += r.crewSalary || 0;

    const originalPayable = (r.crewSalary || 0) - (r.cashAdvance || 0) + (r.reimbursements || 0);

    if (r.paid) {
      totalCashOutflow += originalPayable;
    } else {
      totalPayable += originalPayable;
    }
  });

  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const totalNet = totalGross - totalCrewSalary - totalExpenses;

  return {
    gross: totalGross,
    net: totalNet,
    trips: totalTrips,
    payable: totalPayable,
    cashOutflow: totalCashOutflow,
    expenses: totalExpenses,
  };
}

// Helper: calculate previous period date range
function getPreviousPeriodRange(start: string | undefined, end: string | undefined): { prevStart: Date; prevEnd: Date } | null {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMs = endDate.getTime() - startDate.getTime();

  const prevEnd = new Date(startDate.getTime() - 1); // day before current start
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  prevStart.setHours(0, 0, 0, 0);

  return { prevStart, prevEnd };
}

// GET /api/dashboard?truck=&start=&end=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { truck, start, end } = req.query;

    // Get active trucks for dropdown
    const allTrucks = await Truck.find({ status: 'Active' }).sort({ truckName: 1 });
    const truckOptions = allTrucks.map((t) => ({
      _id: t._id,
      truckName: t.truckName,
      cutoffStart: t.cutoffStart,
      cutoffEnd: t.cutoffEnd,
      payday: t.payday,
      dayOff: t.dayOff,
    }));

    // Build trip filter
    const tripFilter: any = {};
    if (truck) {
      tripFilter.truck = truck;
    }
    if (start || end) {
      tripFilter.date = {};
      if (start) tripFilter.date.$gte = new Date(start as string);
      if (end) {
        const endDate = new Date(end as string);
        endDate.setHours(23, 59, 59, 999);
        tripFilter.date.$lte = endDate;
      }
    }

    // Get trips
    const trips = await Trip.find(tripFilter)
      .populate('truck', 'truckName')
      .sort({ date: 1, createdAt: 1 });

    // Build expense note map by date
    const allExpenses = await Expense.find(truck ? { truck } : {});
    const expenseNoteMap: Record<string, string> = {};
    allExpenses.forEach((e) => {
      const dateKey = e.date.toISOString().slice(0, 10);
      const label = [e.category, e.description].filter(Boolean).join(': ');
      if (!expenseNoteMap[dateKey]) expenseNoteMap[dateKey] = label;
      else expenseNoteMap[dateKey] += ' | ' + label;
    });

    const rows = trips.map((t) => {
      const resp = formatTripResponse(t as any);
      // Auto-fill note from expenses if trip has no manual note
      const expNote = expenseNoteMap[resp.dateIso] || '';
      if (!resp.note && expNote) {
        resp.note = expNote;
      }
      // Flag whether this row has linked expenses (for clickable note)
      (resp as any).hasExpenses = resp.expenses > 0;
      (resp as any).expenseNote = expNote;
      return resp;
    });

    // Get expenses for the same filter
    const expenseFilter: any = {};
    if (truck) expenseFilter.truck = truck;
    if (start || end) {
      expenseFilter.date = {};
      if (start) expenseFilter.date.$gte = new Date(start as string);
      if (end) {
        const endDate = new Date(end as string);
        endDate.setHours(23, 59, 59, 999);
        expenseFilter.date.$lte = endDate;
      }
    }

    const expenses = await Expense.find(expenseFilter);

    // Calculate KPIs
    const kpis = calculateKpis(rows, expenses);

    // Calculate previous period KPIs
    let previousKpis = { gross: 0, net: 0, trips: 0, payable: 0, cashOutflow: 0, expenses: 0 };
    const prevRange = getPreviousPeriodRange(start as string | undefined, end as string | undefined);
    if (prevRange) {
      const prevTripFilter: any = {};
      if (truck) prevTripFilter.truck = truck;
      prevTripFilter.date = { $gte: prevRange.prevStart, $lte: prevRange.prevEnd };

      const prevTrips = await Trip.find(prevTripFilter)
        .populate('truck', 'truckName')
        .sort({ date: 1, createdAt: 1 });

      const prevRows = prevTrips.map((t) => formatTripResponse(t as any));

      const prevExpenseFilter: any = {};
      if (truck) prevExpenseFilter.truck = truck;
      prevExpenseFilter.date = { $gte: prevRange.prevStart, $lte: prevRange.prevEnd };

      const prevExpenses = await Expense.find(prevExpenseFilter);
      previousKpis = calculateKpis(prevRows, prevExpenses);
    }

    // Build chart data (monthly aggregation)
    const monthMap: Record<string, { label: string; gross: number; salary: number; expenses: number; trips: number }> = {};
    const seenDatesPerMonth: Record<string, Set<string>> = {};

    rows.forEach((r) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const dateKey = r.dateIso;

      if (!monthMap[key]) {
        monthMap[key] = {
          label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          gross: 0,
          salary: 0,
          expenses: 0,
          trips: 0,
        };
        seenDatesPerMonth[key] = new Set();
      }

      monthMap[key].gross += r.grossIncome || 0;
      monthMap[key].salary += r.crewSalary || 0;
      monthMap[key].trips += r.trips || 0;

      if (!seenDatesPerMonth[key].has(dateKey)) {
        seenDatesPerMonth[key].add(dateKey);
        monthMap[key].expenses += r.expenses || 0;
      }
    });

    const chartKeys = Object.keys(monthMap).sort();
    const chartData = chartKeys.map((k) => ({
      label: monthMap[k].label,
      gross: monthMap[k].gross,
      net: monthMap[k].gross - monthMap[k].salary - monthMap[k].expenses,
      trips: monthMap[k].trips,
    }));

    res.json({
      rows,
      kpis,
      previousKpis,
      chartData,
      truckOptions,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/reports?truck=&month=
router.get('/reports', async (req: Request, res: Response) => {
  try {
    const { truck, month } = req.query;
    const filter: any = {};

    if (truck) {
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

    const trips = await Trip.find(filter)
      .populate('truck', 'truckName')
      .sort({ date: 1, createdAt: 1 });

    // Apply single-expense-per-date logic
    const seenDates = new Set<string>();
    const rows = trips.map((t) => {
      const response = formatTripResponse(t as any);
      const dateKey = response.dateIso;

      if (seenDates.has(dateKey)) {
        // Duplicate date: zero out expenses, recalculate net
        const net = response.grossIncome - response.crewSalary - response.reimbursements;
        return {
          ...response,
          expenses: 0,
          netIncome: net,
          // Report shows original payable (ignoring paid state)
          reportPayable: response.crewSalary - response.cashAdvance + response.reimbursements,
          reportNetIncome: net,
        };
      }

      seenDates.add(dateKey);
      const reportPayable = response.crewSalary - response.cashAdvance + response.reimbursements;
      const reportNetIncome = response.grossIncome - response.crewSalary - response.expenses;

      return {
        ...response,
        reportPayable,
        reportNetIncome,
      };
    });

    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
