import { Types } from "mongoose";
import { Trip, ITrip } from "../models/Trip.js";
import { Expense } from "../models/Expense.js";
import {
  weekLabelForDate,
  normalizeStatus,
  tripCountDefault,
  crewSalaryDefault,
  calculateTripFields,
  toISODateString,
  formatDateText,
} from "../utils/calculations.js";

/**
 * Get the total expenses for a specific truck on a specific date
 */
export async function getExpenseTotalForDate(
  truckId: Types.ObjectId | string,
  date: Date,
): Promise<{ total: number; notes: string[] }> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const expenses = await Expense.find({
    truck: truckId,
    date: { $gte: startOfDay, $lte: endOfDay },
  });

  // Exclude reimbursed expenses from the total (client pays for those)
  const total = expenses.reduce(
    (sum, e) => sum + (e.reimbursed ? 0 : e.amount),
    0,
  );
  const notes = expenses
    .map((e) => {
      const parts = [];
      if (e.category) parts.push(e.category);
      if (e.description) parts.push(e.description);
      if (e.reimbursed) parts.push("(Reimbursed)");
      return parts.join(": ");
    })
    .filter(Boolean);

  return { total, notes };
}

/**
 * Recalculate and sync expense data for all trips on a given date+truck.
 * Only the first trip per date gets expenses applied (to avoid double-counting).
 */
export async function syncTripsForDate(
  truckId: Types.ObjectId | string,
  date: Date,
): Promise<void> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const trips = await Trip.find({
    truck: truckId,
    date: { $gte: startOfDay, $lte: endOfDay },
  }).sort({ createdAt: 1 });

  if (trips.length === 0) return;

  const { total: expenseTotal, notes } = await getExpenseTotalForDate(
    truckId,
    date,
  );
  const expenseNote = notes.join(" | ");

  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    const applyExpense = i === 0;
    const expenses = applyExpense ? expenseTotal : 0;

    const computed = calculateTripFields({
      rate: trip.rate,
      trips: trip.trips,
      crewSalary: trip.crewSalary,
      cashAdvance: trip.cashAdvance,
      reimbursements: trip.reimbursements,
      expenses,
      paid: trip.paid,
    });

    await Trip.findByIdAndUpdate(trip._id, {
      expenses,
      note: applyExpense ? expenseNote : trip.note,
      grossIncome: computed.grossIncome,
      netIncome: computed.netIncome,
      payable: computed.payable,
    });
  }
}

/**
 * Prepare trip data with auto-defaults and computed fields before save
 */
export function prepareTripData(data: {
  date: Date;
  status?: string;
  dayOff?: number;
  shipmentNumber?: string;
  rate?: number;
  trips?: number;
  crewSalary?: number;
  cashAdvance?: number;
  reimbursements?: number;
  note?: string;
  paid?: boolean;
  expenses?: number;
}): Partial<ITrip> {
  const date = new Date(data.date);
  date.setHours(12, 0, 0, 0); // Normalize to noon to avoid timezone issues

  const status = normalizeStatus(data.status, date, data.dayOff ?? 0);
  const rate = data.rate || 0;
  const trips = tripCountDefault(status, rate, data.trips);
  const crewSalary = crewSalaryDefault(status, rate, data.crewSalary);
  const cashAdvance = data.cashAdvance || 0;
  const reimbursements = data.reimbursements || 0;
  const expenses = data.expenses || 0;
  const paid = data.paid || false;

  const computed = calculateTripFields({
    rate,
    trips,
    crewSalary,
    cashAdvance,
    reimbursements,
    expenses,
    paid,
  });

  return {
    date,
    week: weekLabelForDate(date),
    status,
    shipmentNumber: data.shipmentNumber || "",
    rate,
    trips,
    crewSalary,
    cashAdvance,
    reimbursements,
    note: data.note || "",
    paid,
    expenses,
    grossIncome: computed.grossIncome,
    netIncome: computed.netIncome,
    payable: computed.payable,
  };
}

/**
 * Format a trip document for API response
 */
export function formatTripResponse(trip: ITrip & { truck?: any }) {
  const date = new Date(trip.date);
  return {
    _id: trip._id,
    truck: trip.truck,
    truckName: trip.truck?.truckName || "",
    createdBy: trip.createdBy ? String(trip.createdBy) : null,
    date: trip.date,
    dateIso: toISODateString(date),
    dateText: formatDateText(date),
    week: trip.week,
    status: trip.status,
    shipmentNumber: trip.shipmentNumber,
    rate: trip.rate,
    trips: trip.trips,
    crewSalary: trip.crewSalary,
    cashAdvance: trip.cashAdvance,
    reimbursements: trip.reimbursements,
    expenses: trip.expenses,
    note: trip.note,
    grossIncome: trip.grossIncome,
    netIncome: trip.netIncome,
    payable: trip.payable,
    paid: trip.paid,
  };
}
