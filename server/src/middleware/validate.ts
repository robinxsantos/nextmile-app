import { Request, Response, NextFunction } from "express";

export function validateTripData(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const {
    truckId,
    date,
    status,
    rate,
    trips,
    crewSalary,
    cashAdvance,
    reimbursements,
  } = req.body;

  const errors: string[] = [];

  if (!truckId) errors.push("Truck is required");
  if (!date) errors.push("Date is required");
  if (!status) errors.push("Status is required");

  if (status === "Working Day") {
    if (rate !== undefined && rate !== null && rate < 0) {
      errors.push("Rate must be a non-negative number for working days");
    }
    if (trips !== undefined && trips < 0) {
      errors.push("Trips must be a non-negative number");
    }
  }

  if (crewSalary !== undefined && crewSalary < 0) {
    errors.push("Crew salary must be non-negative");
  }
  if (cashAdvance !== undefined && cashAdvance < 0) {
    errors.push("Cash advance must be non-negative");
  }
  if (reimbursements !== undefined && reimbursements < 0) {
    errors.push("Reimbursements must be non-negative");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join(". ") });
    return;
  }

  // Sanitize string inputs
  if (req.body.shipmentNumber) {
    req.body.shipmentNumber = sanitizeString(req.body.shipmentNumber);
  }
  if (req.body.note) {
    req.body.note = sanitizeString(req.body.note);
  }

  next();
}

export function validateTripUpdate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { date, status, rate, trips, crewSalary, cashAdvance, reimbursements } =
    req.body;

  const errors: string[] = [];

  if (!date) errors.push("Date is required");
  if (!status) errors.push("Status is required");

  if (status === "Working Day") {
    if (rate !== undefined && rate !== null && rate < 0) {
      errors.push("Rate must be a non-negative number for working days");
    }
    if (trips !== undefined && trips < 0) {
      errors.push("Trips must be a non-negative number");
    }
  }

  if (crewSalary !== undefined && crewSalary < 0) {
    errors.push("Crew salary must be non-negative");
  }
  if (cashAdvance !== undefined && cashAdvance < 0) {
    errors.push("Cash advance must be non-negative");
  }
  if (reimbursements !== undefined && reimbursements < 0) {
    errors.push("Reimbursements must be non-negative");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join(". ") });
    return;
  }

  // Sanitize string inputs
  if (req.body.shipmentNumber) {
    req.body.shipmentNumber = sanitizeString(req.body.shipmentNumber);
  }
  if (req.body.note) {
    req.body.note = sanitizeString(req.body.note);
  }

  next();
}

export function validateExpenseData(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { truckId, date, category, amount } = req.body;

  const errors: string[] = [];

  if (!truckId) errors.push("Truck is required");
  if (!date) errors.push("Date is required");
  if (!category || !category.trim()) errors.push("Category is required");
  if (amount === undefined || amount === null || amount <= 0) {
    errors.push("Amount must be a positive number");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join(". ") });
    return;
  }

  // Sanitize string inputs
  if (req.body.category) {
    req.body.category = sanitizeString(req.body.category);
  }
  if (req.body.description) {
    req.body.description = sanitizeString(req.body.description);
  }

  next();
}

export function validateExpenseUpdate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { category, amount } = req.body;

  const errors: string[] = [];

  if (category !== undefined && !category.trim()) {
    errors.push("Category cannot be empty");
  }
  if (amount !== undefined && amount <= 0) {
    errors.push("Amount must be a positive number");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join(". ") });
    return;
  }

  // Sanitize string inputs
  if (req.body.category) {
    req.body.category = sanitizeString(req.body.category);
  }
  if (req.body.description) {
    req.body.description = sanitizeString(req.body.description);
  }

  next();
}

export function validateTruckData(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const {
    truckName,
    status,
    cutoffType = "weekly",
    cutoffStart,
    cutoffEnd,
    payday,
    dayOff,
  } = req.body;

  const errors: string[] = [];

  if (!truckName || !truckName.trim()) errors.push("Truck name is required");
  if (status && !["Active", "Inactive"].includes(status)) {
    errors.push("Status must be Active or Inactive");
  }
  if (!["weekly", "monthly"].includes(cutoffType)) {
    errors.push("Cutoff type must be weekly or monthly");
  }

  const isMonthly = cutoffType === "monthly";
  const minValue = isMonthly ? 1 : 0;
  const maxValue = isMonthly ? 31 : 6;

  const startNum = cutoffStart !== undefined ? Number(cutoffStart) : undefined;
  const endNum = cutoffEnd !== undefined ? Number(cutoffEnd) : undefined;
  const paydayNum = payday !== undefined ? Number(payday) : undefined;
  const dayOffNum = dayOff !== undefined ? Number(dayOff) : undefined;

  if (
    startNum !== undefined &&
    (!Number.isFinite(startNum) || startNum < minValue || startNum > maxValue)
  ) {
    errors.push(
      isMonthly
        ? "Monthly cutoff start must be between 1-31"
        : "Cutoff start must be between 0-6",
    );
  }

  if (
    endNum !== undefined &&
    (!Number.isFinite(endNum) || endNum < minValue || endNum > maxValue)
  ) {
    errors.push(
      isMonthly
        ? "Monthly cutoff end must be between 1-31"
        : "Cutoff end must be between 0-6",
    );
  }

  if (
    paydayNum !== undefined &&
    (!Number.isFinite(paydayNum) ||
      paydayNum < minValue ||
      paydayNum > maxValue)
  ) {
    errors.push(
      isMonthly
        ? "Salary day must be between 1-31"
        : "Payday must be between 0-6",
    );
  }

  if (
    dayOffNum !== undefined &&
    (!Number.isFinite(dayOffNum) || dayOffNum < 0 || dayOffNum > 6)
  ) {
    errors.push("Day off must be between 0-6");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join(". ") });
    return;
  }

  if (req.body.truckName) {
    req.body.truckName = sanitizeString(req.body.truckName);
  }
  if (req.body.client) {
    req.body.client = sanitizeString(req.body.client);
  }
  if (req.body.notes) {
    req.body.notes = sanitizeString(req.body.notes);
  }

  next();
}

// Sanitization helper
export function sanitizeString(str: string): string {
  return str.trim().slice(0, 500); // Max 500 chars
}
