/**
 * Core business logic calculations - ported from Code.gs
 */

export function weekLabelForDate(date: Date): string {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = firstDayOfMonth.getDay();
  const weekNo = Math.ceil((date.getDate() + offset) / 7);
  return `Week ${weekNo}`;
}

export function normalizeStatus(
  status: string | undefined,
  date: Date,
  dayOff: number = 0
): 'Working Day' | 'Day Off' | 'Holiday' {
  const allowed = ['Working Day', 'Day Off', 'Holiday'];
  const s = (status || '').trim();
  if (allowed.includes(s)) return s as 'Working Day' | 'Day Off' | 'Holiday';
  if (date && date.getDay() === dayOff) return 'Day Off';
  return 'Working Day';
}

export function isWorkingStatus(status: string): boolean {
  return (status || '').trim() === 'Working Day';
}

export function tripCountDefault(
  status: string,
  rate: number | undefined,
  trips: number | undefined
): number {
  if (isWorkingStatus(status) && rate && rate > 0 && (!trips || trips === 0)) {
    return 1;
  }
  return trips || 0;
}

export function crewSalaryDefault(
  status: string,
  rate: number | undefined,
  crewSalary: number | undefined
): number {
  if (isWorkingStatus(status) && rate && rate > 0 && (!crewSalary || crewSalary === 0)) {
    return 0;
  }
  return crewSalary || 0;
}

export function calculateTripFields(data: {
  rate: number;
  trips: number;
  crewSalary: number;
  cashAdvance: number;
  reimbursements: number;
  expenses: number;
  paid: boolean;
}): {
  grossIncome: number;
  netIncome: number;
  payable: number;
} {
  const grossIncome = data.rate * data.trips;
  const totalPayable = data.crewSalary - data.cashAdvance + data.reimbursements;
  const payable = data.paid ? 0 : totalPayable;
  const netIncome = grossIncome - data.crewSalary - data.reimbursements - data.expenses;

  return { grossIncome, netIncome, payable };
}

export function formatDateText(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayNameShort(n: number): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][n] || '';
}
