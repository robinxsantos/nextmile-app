import { Types } from "mongoose";
import { Trip, ITrip } from "../models/Trip.js";
import { Expense } from "../models/Expense.js";
import { Truck } from "../models/Truck.js";
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

  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

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

  const truck = await Truck.findById(truckId).select("billingType");

  const billingType =
    truck?.billingType === "direct" ? "direct" : "subcontracted";

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
      vat: trip.vat,
      trips: trip.trips,
      crewSalary: trip.crewSalary,
      cashAdvance: trip.cashAdvance,
      reimbursements: trip.reimbursements,
      expenses,
      paid: trip.paid,
      billingType,
    });

    await Trip.findByIdAndUpdate(trip._id, {
      expenses,
      note: applyExpense ? expenseNote : trip.note,
      grossIncome: computed.grossIncome,
      netIncome: computed.netIncome,
      payable: computed.payable,
      verificationStatus: trip.verificationStatus, // 🔥 PRESERVE
    });
  }
}

export function calculateRateAdjustment({
  originalRate,
  rateAdjustmentType = "none",
  rateAdjustment = 0,
  autoComputeVat = true,
  manualVat = 0,
}: {
  originalRate: number;
  rateAdjustmentType?: "none" | "amount" | "percentage";
  rateAdjustment?: number;
  autoComputeVat?: boolean;
  manualVat?: number;
}) {
  const baseRate = Math.max(0, Number(originalRate) || 0);
  const adjustment = Math.max(0, Number(rateAdjustment) || 0);

  let rate = baseRate;

  if (rateAdjustmentType === "amount") {
    rate = Math.max(0, baseRate - adjustment);
  }

  if (rateAdjustmentType === "percentage") {
    rate = Math.max(0, baseRate - baseRate * (adjustment / 100));
  }

  // Keep currency values at 2 decimal places.
  rate = Math.round((rate + Number.EPSILON) * 100) / 100;

  // VAT currently uses ORIGINAL RATE as its base.
  const vat = autoComputeVat
    ? Math.round((baseRate * 0.12 + Number.EPSILON) * 100) / 100
    : Math.max(0, Number(manualVat) || 0);

  return {
    rate,
    vat,
  };
}

/**
 * Prepare trip data with auto-defaults and computed fields before save
 */
export function prepareTripData(data: {
  date: Date;
  status?: string;
  dayOff?: number;
  shipmentNumber?: string;
  originalRate?: number;
  rateAdjustmentType?: "none" | "amount" | "percentage";
  rateAdjustment?: number;
  autoComputeVat?: boolean;
  rate?: number;
  vat?: number;
  trips?: number;
  crewSalary?: number;
  cashAdvance?: number;
  reimbursements?: number;
  note?: string;
  paid?: boolean;
  expenses?: number;
  billingType?: "subcontracted" | "direct";
}): Partial<ITrip> {
  const date = new Date(data.date);
  date.setHours(12, 0, 0, 0); // Normalize to noon to avoid timezone issues

  const status = normalizeStatus(data.status, date, data.dayOff ?? 0);

  const hasOriginalRate = data.originalRate !== undefined;

  const originalRate = hasOriginalRate
    ? Number(data.originalRate) || 0
    : Number(data.rate) || 0;

  const rateAdjustmentType = hasOriginalRate
    ? data.rateAdjustmentType || "none"
    : "none";

  const rateAdjustment = hasOriginalRate ? Number(data.rateAdjustment) || 0 : 0;

  const autoComputeVat = hasOriginalRate
    ? data.autoComputeVat !== false
    : false;

  const calculated = calculateRateAdjustment({
    originalRate,
    rateAdjustmentType,
    rateAdjustment,
    autoComputeVat,
    manualVat: Number(data.vat) || 0,
  });

  const rate = hasOriginalRate ? calculated.rate : Number(data.rate) || 0;
  const vat = hasOriginalRate ? calculated.vat : Number(data.vat) || 0;

  const trips = tripCountDefault(status, rate, data.trips);
  const crewSalary = crewSalaryDefault(status, rate, data.crewSalary);
  const cashAdvance = data.cashAdvance || 0;
  const reimbursements = data.reimbursements || 0;
  const expenses = data.expenses || 0;
  const paid = data.paid || false;
  const billingType =
    data.billingType === "direct" ? "direct" : "subcontracted";

  const computed = calculateTripFields({
    rate,
    vat,
    trips,
    crewSalary,
    cashAdvance,
    reimbursements,
    expenses,
    paid,
    billingType,
  });

  return {
    date,
    week: weekLabelForDate(date),
    status,
    shipmentNumber: data.shipmentNumber || "",
    originalRate,
    rateAdjustmentType,
    rateAdjustment,
    autoComputeVat,
    rate,
    vat,
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
    verificationStatus: trip.verificationStatus,
    originalRate: trip.originalRate,
    rateAdjustmentType: trip.rateAdjustmentType,
    rateAdjustment: trip.rateAdjustment,
    autoComputeVat: trip.autoComputeVat,
    rate: trip.rate,
    vat: trip.vat,
    trips: trip.trips,
    crewSalary: trip.crewSalary,
    cashAdvance: trip.cashAdvance,
    reimbursements: trip.reimbursements,
    expenses: trip.expenses,
    note: trip.note,
    collectionComment: trip.collectionComment || "",

    grossIncome: trip.grossIncome,
    netIncome: trip.netIncome,
    payable: trip.payable,
    paid: trip.paid,
  };
}
