import { type ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../../lib/utils";

interface KpiCardProps {
  label: string;
  value: number;
  previousValue?: number;
  currentValue?: number;
  subtitle: string;
  icon: ReactNode;
  colorClass?: string;
  invertTrend?: boolean;
  format?: "currency" | "number"; // 👈 added
}

function getDelta(current: number | undefined, previous: number | undefined) {
  if (current === undefined || previous === undefined || previous === 0)
    return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function KpiCard({
  label,
  value,
  previousValue,
  currentValue,
  subtitle,
  icon,
  colorClass = "bg-blue-600/10 text-blue-600",
  invertTrend = false,
  format = "currency", // 👈 default
}: KpiCardProps) {
  const delta = getDelta(currentValue, previousValue);

  const absoluteChange =
    currentValue !== undefined && previousValue !== undefined
      ? currentValue - previousValue
      : null;

  const absSign =
    absoluteChange === null
      ? ""
      : absoluteChange > 0
        ? "+"
        : absoluteChange < 0
          ? "-"
          : "";

  const isPositive = delta !== null && delta > 0;
  const isNegative = delta !== null && delta < 0;
  const isNeutral = delta === null || delta === 0;

  const goodDirection = invertTrend ? isNegative : isPositive;
  const badDirection = invertTrend ? isPositive : isNegative;

  const displayDelta = delta === null ? null : Math.abs(delta);
  const displaySign =
    delta === null ? "" : delta > 0 ? "+" : delta < 0 ? "-" : "";

  return (
    <div className="p-4 rounded-lg border border-border bg-background flex flex-col justify-between gap-2">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[0.65rem] sm:text-[0.72rem] text-muted-foreground uppercase tracking-wider font-semibold mb-1 sm:mb-2 leading-none truncate">
            {label}
          </div>

          <div className="text-lg sm:text-[1.7rem] font-bold leading-none tracking-tight truncate">
            {format === "number"
              ? value.toLocaleString()
              : value.toLocaleString("en-PH", {
                  style: "currency",
                  currency: "PHP",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </div>
        </div>

        <div
          className={cn(
            "w-8 h-8 sm:w-[42px] sm:h-[42px] w-8 h-8 rounded-md grid place-items-center flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-[22px] sm:[&>svg]:h-[22px]",
            colorClass,
          )}
        >
          {icon}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
        <p className="text-xs sm:text-sm text-muted-foreground leading-tight truncate">
          {subtitle}
        </p>

        {delta !== null && !isNeutral && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-[0.65rem] sm:text-[0.68rem] font-semibold whitespace-nowrap flex-shrink-0 px-1.5 py-0.5 rounded-md w-fit",
              goodDirection &&
                "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
              badDirection && "text-red-500 dark:text-red-400 bg-red-500/10",
            )}
          >
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>
              {displaySign}
              {displayDelta?.toFixed(1) ?? "0.0"}%
              {absoluteChange !== null && (
                <>
                  {" "}
                  ({absSign}
                  {format === "currency"
                    ? Math.abs(absoluteChange).toLocaleString("en-PH", {
                        style: "currency",
                        currency: "PHP",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })
                    : Math.abs(absoluteChange).toLocaleString()}
                  )
                </>
              )}
            </span>
          </div>
        )}

        {isNeutral && previousValue !== undefined && previousValue > 0 && (
          <div className="flex items-center gap-0.5 text-[0.65rem] sm:text-[0.68rem] font-semibold text-muted-foreground whitespace-nowrap flex-shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 w-fit">
            <Minus size={11} />
            <span>0%</span>
          </div>
        )}
      </div>
    </div>
  );
}
