import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine class names (shadcn standard)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format to Philippine Peso with cents
 */
export function peso(n: number | undefined | null): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(n || 0));
}

/**
 * Peso or dash if zero
 */
export function pesoOrDash(n: number | undefined | null): string {
  const value = Number(n || 0);
  return value === 0 ? "—" : peso(value);
}

/**
 * Peso without decimals (for KPIs)
 */
export function pesoCompact(n: number | undefined | null): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n || 0)));
}

/**
 * Human readable date
 */
export function formatDateText(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Convert to input[type="date"] format
 */
export function toInputDate(date: Date | string): string {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Truncate long text
 */
export function truncateText(text: string, maxLen: number = 35): string {
  const s = (text || "").trim();
  return s.length <= maxLen ? s : s.slice(0, maxLen - 1) + "…";
}

/**
 * Day names
 */
export function dayNameShort(n: number): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n] || "";
}

export function dayNameLong(n: number): string {
  return (
    [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][n] || ""
  );
}
