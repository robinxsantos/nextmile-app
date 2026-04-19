export type RangePreset =
  | "ALL"
  | "CC"
  | "LC"
  | "TM"
  | "LM"
  | "MTD"
  | "YTD"
  | "CUSTOM";
export type CutoffType = "weekly" | "monthly";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function shiftMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function cutoffSpanDays_(startDay: number, endDay: number): number {
  return ((endDay - startDay + 7) % 7) + 1;
}

export function currentCutoffBounds(
  today: Date,
  startDay: number = 1,
  endDay: number = 6,
): { start: Date; end: Date } {
  const d = startOfDay(today);
  const currentDay = d.getDay();
  const spanDays = cutoffSpanDays_(startDay, endDay);

  let diffToStart = currentDay - startDay;
  if (diffToStart < 0) diffToStart += 7;

  const start = new Date(d);
  start.setDate(d.getDate() - diffToStart);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + (spanDays - 1));
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function lastCutoffBounds(
  today: Date,
  startDay: number = 1,
  endDay: number = 6,
): { start: Date; end: Date } {
  const current = currentCutoffBounds(today, startDay, endDay);
  const start = new Date(current.start);
  start.setDate(start.getDate() - 7);
  const end = new Date(current.end);
  end.setDate(end.getDate() - 7);
  return { start, end };
}

/**
 * Monthly payroll-style cutoff:
 * Example: 26th of last month -> 25th of current month
 * Assumes a cross-month range where startDay > endDay.
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

export function currentMonthlyCutoffBounds(
  today: Date,
  startDay: number = 26,
  endDay: number = 25,
): { start: Date; end: Date } {
  const d = startOfDay(today);
  const year = d.getFullYear();
  const month = d.getMonth();
  const currentDay = d.getDate();

  // Case 1: same-month window, like 1 -> 31 or 1 -> 15
  if (startDay <= endDay) {
    const start = startOfDay(
      new Date(year, month, clampDay(year, month, startDay)),
    );
    const end = endOfDay(new Date(year, month, clampDay(year, month, endDay)));
    return { start, end };
  }

  // Case 2: cross-month payroll window, like 26 -> 25
  if (currentDay >= startDay) {
    return {
      start: startOfDay(new Date(year, month, startDay)),
      end: endOfDay(new Date(year, month + 1, endDay)),
    };
  }

  return {
    start: startOfDay(new Date(year, month - 1, startDay)),
    end: endOfDay(new Date(year, month, endDay)),
  };
}

export function lastMonthlyCutoffBounds(
  today: Date,
  startDay: number = 26,
  endDay: number = 25,
): { start: Date; end: Date } {
  const d = startOfDay(today);
  const year = d.getFullYear();
  const month = d.getMonth();

  // Same-month range like 1 -> 31 or 1 -> 15
  // Previous cutoff should use the previous month and clamp to that month's length.
  if (startDay <= endDay) {
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;

    return {
      start: startOfDay(
        new Date(prevYear, prevMonth, clampDay(prevYear, prevMonth, startDay)),
      ),
      end: endOfDay(
        new Date(prevYear, prevMonth, clampDay(prevYear, prevMonth, endDay)),
      ),
    };
  }

  // Cross-month payroll range like 26 -> 25
  const current = currentMonthlyCutoffBounds(today, startDay, endDay);
  const start = new Date(current.start);
  start.setMonth(start.getMonth() - 1);

  const end = new Date(current.end);
  end.setMonth(end.getMonth() - 1);

  return { start, end };
}

export function previousRangeForPreset(
  preset: RangePreset,
  cutoffType: CutoffType = "weekly",
  cutoffStart: number = 1,
  cutoffEnd: number = 6,
): { start: Date; end: Date } | null {
  const now = new Date();

  switch (preset) {
    case "CC": {
      return cutoffType === "monthly"
        ? lastMonthlyCutoffBounds(now, cutoffStart, cutoffEnd)
        : lastCutoffBounds(now, cutoffStart, cutoffEnd);
    }
    case "LC": {
      if (cutoffType === "monthly") {
        const last = lastMonthlyCutoffBounds(now, cutoffStart, cutoffEnd);
        return {
          start: shiftMonths(last.start, -1),
          end: shiftMonths(last.end, -1),
        };
      }

      const last = lastCutoffBounds(now, cutoffStart, cutoffEnd);
      const start = new Date(last.start);
      start.setDate(start.getDate() - 7);
      const end = new Date(last.end);
      end.setDate(end.getDate() - 7);
      return { start, end };
    }
    case "TM":
      return {
        start: prevMonthStart(now),
        end: prevMonthEnd(now),
      };
    case "LM": {
      const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return {
        start: monthStart(d),
        end: monthEnd(d),
      };
    }
    case "MTD": {
      const thisMonthStart = monthStart(now);
      const daysSoFar = Math.floor(
        (todayEnd(now).getTime() - thisMonthStart.getTime()) / 86400000,
      );

      const prevMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const start = monthStart(prevMonthRef);
      const end = new Date(start);
      end.setDate(start.getDate() + daysSoFar);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "YTD": {
      const start = yearStart(new Date(now.getFullYear() - 1, 0, 1));
      const end = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
      );
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    default:
      return null;
  }
}

export function monthStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function monthEnd(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function prevMonthStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function prevMonthEnd(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function yearStart(date: Date): Date {
  const d = new Date(date.getFullYear(), 0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayEnd(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDateRangeForPreset(
  preset: RangePreset,
  cutoffType: CutoffType = "weekly",
  cutoffStart: number = 1,
  cutoffEnd: number = 6,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string; label: string } {
  const now = new Date();

  switch (preset) {
    case "ALL":
      return { start: "", end: "", label: "All Time" };

    case "CC": {
      const b =
        cutoffType === "monthly"
          ? currentMonthlyCutoffBounds(now, cutoffStart, cutoffEnd)
          : currentCutoffBounds(now, cutoffStart, cutoffEnd);

      return {
        start: toInputDate(b.start),
        end: toInputDate(b.end),
        label: "Current Cutoff",
      };
    }

    case "LC": {
      const b =
        cutoffType === "monthly"
          ? lastMonthlyCutoffBounds(now, cutoffStart, cutoffEnd)
          : lastCutoffBounds(now, cutoffStart, cutoffEnd);

      return {
        start: toInputDate(b.start),
        end: toInputDate(b.end),
        label: "Last Cutoff",
      };
    }

    case "TM":
      return {
        start: toInputDate(monthStart(now)),
        end: toInputDate(monthEnd(now)),
        label: "This Month",
      };

    case "LM":
      return {
        start: toInputDate(prevMonthStart(now)),
        end: toInputDate(prevMonthEnd(now)),
        label: "Last Month",
      };

    case "MTD":
      return {
        start: toInputDate(monthStart(now)),
        end: toInputDate(todayEnd(now)),
        label: "Month to Date",
      };

    case "YTD":
      return {
        start: toInputDate(yearStart(now)),
        end: toInputDate(todayEnd(now)),
        label: "Year to Date",
      };

    case "CUSTOM":
      return {
        start: customStart || "",
        end: customEnd || "",
        label: "Custom",
      };

    default:
      return { start: "", end: "", label: "All Time" };
  }
}
