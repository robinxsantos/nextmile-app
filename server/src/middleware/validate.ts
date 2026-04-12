import { Request, Response, NextFunction } from 'express';

export function validateTripData(req: Request, res: Response, next: NextFunction) {
  const { truckId, date, status, rate, trips, crewSalary, cashAdvance, reimbursements } = req.body;

  const errors: string[] = [];

  if (!truckId) errors.push('Truck is required');
  if (!date) errors.push('Date is required');
  if (!status) errors.push('Status is required');

  if (status === 'Working Day') {
    if (rate !== undefined && rate !== null && rate < 0) {
      errors.push('Rate must be a non-negative number for working days');
    }
    if (trips !== undefined && trips < 0) {
      errors.push('Trips must be a non-negative number');
    }
  }

  if (crewSalary !== undefined && crewSalary < 0) {
    errors.push('Crew salary must be non-negative');
  }
  if (cashAdvance !== undefined && cashAdvance < 0) {
    errors.push('Cash advance must be non-negative');
  }
  if (reimbursements !== undefined && reimbursements < 0) {
    errors.push('Reimbursements must be non-negative');
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('. ') });
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

export function validateTripUpdate(req: Request, res: Response, next: NextFunction) {
  const { date, status, rate, trips, crewSalary, cashAdvance, reimbursements } = req.body;

  const errors: string[] = [];

  if (!date) errors.push('Date is required');
  if (!status) errors.push('Status is required');

  if (status === 'Working Day') {
    if (rate !== undefined && rate !== null && rate < 0) {
      errors.push('Rate must be a non-negative number for working days');
    }
    if (trips !== undefined && trips < 0) {
      errors.push('Trips must be a non-negative number');
    }
  }

  if (crewSalary !== undefined && crewSalary < 0) {
    errors.push('Crew salary must be non-negative');
  }
  if (cashAdvance !== undefined && cashAdvance < 0) {
    errors.push('Cash advance must be non-negative');
  }
  if (reimbursements !== undefined && reimbursements < 0) {
    errors.push('Reimbursements must be non-negative');
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('. ') });
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

export function validateExpenseData(req: Request, res: Response, next: NextFunction) {
  const { truckId, date, category, amount } = req.body;

  const errors: string[] = [];

  if (!truckId) errors.push('Truck is required');
  if (!date) errors.push('Date is required');
  if (!category || !category.trim()) errors.push('Category is required');
  if (amount === undefined || amount === null || amount <= 0) {
    errors.push('Amount must be a positive number');
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('. ') });
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

export function validateExpenseUpdate(req: Request, res: Response, next: NextFunction) {
  const { category, amount } = req.body;

  const errors: string[] = [];

  if (category !== undefined && !category.trim()) {
    errors.push('Category cannot be empty');
  }
  if (amount !== undefined && amount <= 0) {
    errors.push('Amount must be a positive number');
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('. ') });
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

export function validateTruckData(req: Request, res: Response, next: NextFunction) {
  const { truckName, status, cutoffStart, cutoffEnd, payday, dayOff } = req.body;

  const errors: string[] = [];

  if (!truckName || !truckName.trim()) errors.push('Truck name is required');
  if (status && !['Active', 'Inactive'].includes(status)) {
    errors.push('Status must be Active or Inactive');
  }

  if (cutoffStart !== undefined && (cutoffStart < 0 || cutoffStart > 6)) {
    errors.push('Cutoff start must be between 0-6');
  }
  if (cutoffEnd !== undefined && (cutoffEnd < 0 || cutoffEnd > 6)) {
    errors.push('Cutoff end must be between 0-6');
  }
  if (payday !== undefined && (payday < 0 || payday > 6)) {
    errors.push('Payday must be between 0-6');
  }
  if (dayOff !== undefined && (dayOff < 0 || dayOff > 6)) {
    errors.push('Day off must be between 0-6');
  }

  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('. ') });
    return;
  }

  // Sanitize string inputs
  if (req.body.truckName) {
    req.body.truckName = sanitizeString(req.body.truckName);
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
