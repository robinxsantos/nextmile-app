import { Router, Request, Response } from "express";
import { Trip } from "../models/Trip.js";
import { Expense } from "../models/Expense.js";
import { Truck } from "../models/Truck.js";
import { formatTripResponse } from "../services/tripService.js";
// import { toISODateString } from "../utils/calculations.js";
import { attachExpenseNotes } from "../utils/enrichNotes.js";
import {
  previousRangeForPreset,
  type RangePreset,
} from "../utils/dateHelpers.js";

type DateRange = {
  prevStart: Date;
  prevEnd: Date;
};

function getComparisonRangeForPreset(
  preset: string | undefined,
  currentStart: Date,
  currentEnd: Date,
  truckConfig?: { cutoffStart?: number; cutoffEnd?: number },
): DateRange | null {
  const start = new Date(currentStart);
  const end = new Date(currentEnd);

  // current cutoff / last cutoff
  if (preset === "CC" || preset === "current_cutoff") {
    const durationMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    return { prevStart, prevEnd };
  }

  // this month
  if (preset === "TM" || preset === "this_month") {
    const prevMonthStart = new Date(
      start.getFullYear(),
      start.getMonth() - 1,
      1,
    );
    const prevMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0);

    return { prevStart: prevMonthStart, prevEnd: prevMonthEnd };
  }

  // fallback
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return { prevStart, prevEnd };
}

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

    const crewSalary = r.crewSalary || 0;
    const cashAdvance = r.cashAdvance || 0;
    const reimbursements = r.reimbursements || 0;

    const payable = crewSalary - cashAdvance + reimbursements;

    if (r.paid) {
      totalCashOutflow += payable + cashAdvance;
    } else {
      totalPayable += payable;
    }
  });

  const totalExpenses = expenses.reduce((sum: number, e: any) => {
    if (e.reimbursed) return sum;
    return sum + e.amount;
  }, 0);

  const totalVat = rows.reduce(
    (sum: number, r: any) => sum + Number(r.vat || 0),
    0,
  );

  const totalNet = totalGross - totalVat - totalCrewSalary - totalExpenses;

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
function getPreviousPeriodRange(
  start: string | undefined,
  end: string | undefined,
): { prevStart: Date; prevEnd: Date } | null {
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
router.get("/", async (req: Request, res: Response) => {
  try {
    const { truck, start, end, rangePreset } = req.query;

    // Get active trucks for dropdown
    const allTrucks = await Truck.find({ status: "Active" }).sort({
      truckName: 1,
    });
    const truckOptions = allTrucks.map((t) => ({
      _id: t._id,
      truckName: t.truckName,
      cutoffType: t.cutoffType || "weekly",
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
      .populate("truck", "truckName")
      .sort({ date: 1, createdAt: 1 });

    const allExpenses = await Expense.find(truck ? { truck } : {});
    const formattedTrips = trips.map((t) => formatTripResponse(t as any));
    const enriched = attachExpenseNotes(formattedTrips, allExpenses);

    const rows = enriched.map((resp: any) => {
      (resp as any).hasExpenses = resp.expenses > 0;
      (resp as any).expenseNote = resp.note || "";
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
    let previousKpis = {
      gross: 0,
      net: 0,
      trips: 0,
      payable: 0,
      cashOutflow: 0,
      expenses: 0,
    };

    if (start && end) {
      const truckConfig = truckOptions.find(
        (t) => String(t._id) === String(truck || ""),
      );

      const rawPreset = String(rangePreset || "ALL");

      const preset: RangePreset =
        rawPreset === "ALL" ||
        rawPreset === "CC" ||
        rawPreset === "LC" ||
        rawPreset === "TM" ||
        rawPreset === "LM" ||
        rawPreset === "MTD" ||
        rawPreset === "YTD" ||
        rawPreset === "CUSTOM"
          ? rawPreset
          : "ALL";

      const prevRange = previousRangeForPreset(
        preset,
        truckConfig?.cutoffType ?? "weekly",
        truckConfig?.cutoffStart ?? 1,
        truckConfig?.cutoffEnd ?? 6,
      );

      if (prevRange) {
        const prevTripFilter: any = {};
        if (truck) prevTripFilter.truck = truck;
        prevTripFilter.date = {
          $gte: prevRange.start,
          $lte: prevRange.end,
        };

        const prevTrips = await Trip.find(prevTripFilter)
          .populate("truck", "truckName")
          .sort({ date: 1, createdAt: 1 });

        const prevRows = prevTrips.map((t) => formatTripResponse(t as any));

        const prevExpenseFilter: any = {};
        if (truck) prevExpenseFilter.truck = truck;
        prevExpenseFilter.date = {
          $gte: prevRange.start,
          $lte: prevRange.end,
        };

        const prevExpenses = await Expense.find(prevExpenseFilter);

        previousKpis = calculateKpis(prevRows, prevExpenses);
      }
    }

    // Build chart data (monthly aggregation)
    const chartMode = rangePreset === "TM" ? "WEEKLY" : "MONTHLY";

    const chartMap: Record<
      string,
      {
        label: string;
        gross: number;
        salary: number;
        expenses: number;
        trips: number;
      }
    > = {};

    const seenDates: Record<string, Set<string>> = {};

    rows.forEach((r) => {
      const d = new Date(r.date);
      let key = "";
      let label = "";

      if (chartMode === "WEEKLY") {
        const week = Math.ceil(d.getDate() / 7);
        key = `${d.getFullYear()}-${d.getMonth()}-W${week}`;
        label = `Week ${week}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        label = d.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      }

      const dateKey = r.dateIso;

      if (!chartMap[key]) {
        chartMap[key] = {
          label,
          gross: 0,
          salary: 0,
          expenses: 0,
          trips: 0,
        };
        seenDates[key] = new Set();
      }

      chartMap[key].gross += r.grossIncome || 0;
      chartMap[key].salary += r.crewSalary || 0;
      chartMap[key].trips += r.trips || 0;

      if (!seenDates[key].has(dateKey)) {
        seenDates[key].add(dateKey);
        chartMap[key].expenses += r.expenses || 0;
      }
    });

    const chartKeys = Object.keys(chartMap).sort();

    const chartData = rows.map((r) => {
      const crewSalary = r.crewSalary || 0;
      const cashAdvance = r.cashAdvance || 0;
      const reimbursements = r.reimbursements || 0;
      const payable = crewSalary - cashAdvance + reimbursements;

      return {
        label: r.dateText,
        dateIso: r.dateIso,

        gross: r.grossIncome || 0,
        net: r.grossIncome - r.vat - r.crewSalary - r.expenses,
        trips: r.trips || 0,

        expenses: r.expenses || 0,
        payable: r.paid ? 0 : payable,
        cashOutflow: r.paid ? payable + cashAdvance : 0,
      };
    });

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
router.get("/reports", async (req: Request, res: Response) => {
  try {
    const { truck, month } = req.query;
    const filter: any = {};

    if (truck) {
      filter.truck = truck;
    }

    if (month && month !== "ALL") {
      const year = new Date().getFullYear();
      const m = Number(month) - 1;
      filter.date = {
        $gte: new Date(year, m, 1),
        $lte: new Date(year, m + 1, 0, 23, 59, 59, 999),
      };
    }

    const trips = await Trip.find(filter)
      .populate("truck", "truckName")
      .sort({ date: 1, createdAt: 1 });

    const allExpenses = await Expense.find(filter);

    const formattedTrips = trips.map((t) => formatTripResponse(t as any));
    const enriched = attachExpenseNotes(formattedTrips, allExpenses);

    const seenDates = new Set<string>();

    const rows = enriched.map((response: any) => {
      const dateKey = response.dateIso;

      if (seenDates.has(dateKey)) {
        const net =
          response.grossIncome -
          response.vat -
          response.crewSalary -
          response.expenses;

        return {
          ...response,
          expenses: 0,
          netIncome: net,
          reportPayable:
            response.crewSalary -
            response.cashAdvance +
            response.reimbursements,
          reportNetIncome: net,
        };
      }

      seenDates.add(dateKey);

      const reportPayable =
        response.crewSalary - response.cashAdvance + response.reimbursements;

      const reportNetIncome =
        response.grossIncome -
        response.vat -
        response.crewSalary -
        response.expenses;

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
