export function cutoffSpanDays_(startDay: number, endDay: number): number {
  return ((endDay - startDay + 7) % 7) + 1;
}

export function currentCutoffBounds(
  today: Date,
  startDay: number = 1,
  endDay: number = 6,
): { start: Date; end: Date } {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);

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

export function previousRangeForPreset(
  preset: RangePreset,
  cutoffStart: number = 1,
  cutoffEnd: number = 6,
): { start: Date; end: Date } | null {
  const now = new Date();

  switch (preset) {
    case "CC": {
      const b = lastCutoffBounds(now, cutoffStart, cutoffEnd);
      return { start: b.start, end: b.end };
    }

    case "LC": {
      const b = lastCutoffBounds(now, cutoffStart, cutoffEnd);
      const start = new Date(b.start);
      start.setDate(start.getDate() - 7);

      const end = new Date(b.end);
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

export function shiftDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
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

export type RangePreset =
  | "ALL"
  | "CC"
  | "LC"
  | "TM"
  | "LM"
  | "MTD"
  | "YTD"
  | "CUSTOM";

export function getDateRangeForPreset(
  preset: RangePreset,
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
      const b = currentCutoffBounds(now, cutoffStart, cutoffEnd);
      return {
        start: toInputDate(b.start),
        end: toInputDate(b.end),
        label: "Current Cutoff",
      };
    }
    case "LC": {
      const b = lastCutoffBounds(now, cutoffStart, cutoffEnd);
      return {
        start: toInputDate(b.start),
        end: toInputDate(b.end),
        label: "Last Cutoff",
      };
    }
    case "TM": {
      return {
        start: toInputDate(monthStart(now)),
        end: toInputDate(monthEnd(now)),
        label: "This Month",
      };
    }
    case "LM": {
      return {
        start: toInputDate(prevMonthStart(now)),
        end: toInputDate(prevMonthEnd(now)),
        label: "Last Month",
      };
    }
    case "MTD": {
      return {
        start: toInputDate(monthStart(now)),
        end: toInputDate(todayEnd(now)),
        label: "Month to Date",
      };
    }
    case "YTD": {
      return {
        start: toInputDate(yearStart(now)),
        end: toInputDate(todayEnd(now)),
        label: "Year to Date",
      };
    }
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
