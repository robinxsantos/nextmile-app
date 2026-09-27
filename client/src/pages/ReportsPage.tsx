import { useEffect, useState, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import TripTable from "../components/shared/TripTable";
import ExpenseBreakdownModal from "../components/shared/ExpenseBreakdownModal";
import {
  exportMonthlyReport,
  exportClientMonthlyReport,
} from "../lib/exportHelpers";
import {
  Download,
  BarChart3,
  Columns3,
  Search,
  ChevronsUpDown,
  RotateCcw,
  Check,
  CalendarDays,
} from "lucide-react";
import EmptyState from "../components/shared/EmptyState";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";

import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

const MONTH_OPTIONS = [
  { value: "ALL", label: "Whole Year" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function ReportsPage() {
  const {
    reportRows,
    reportsMonth,
    setReportsMonth,
    fetchReports,
    initApp,
    selectedTruck,
    setSelectedTruck,
    truckOptions,
    truckRows,
    expenseRows,
    fetchExpenses,
    setExpensesMonth,
  } = useAppStore();
  const [expenseBreakdown, setExpenseBreakdown] = useState<{
    truckId: string;
    dateIso: string;
    dateText: string;
  } | null>(null);

  const COLUMN_OPTIONS = [
    ["truck", "Truck"],
    ["week", "Week"],
    ["date", "Date"],
    ["status", "Status"],
    ["shipmentNumber", "Shipment #"],
    ["rate", "Rate"],
    ["trips", "Trips"],
    ["grossIncome", "Gross"],
    ["netIncome", "Net"],
    ["payable", "Payable"],
  ] as const;

  type ColumnKey = (typeof COLUMN_OPTIONS)[number][0];

  const COLUMN_STORAGE_KEY = "reports-columns";

  const defaultVisibleColumns: Record<ColumnKey, boolean> = {
    truck: true,
    week: false,
    date: true,
    status: false,
    shipmentNumber: true,
    rate: true,
    trips: false,
    grossIncome: true,
    netIncome: true,
    payable: true,
  };

  const [visibleColumns, setVisibleColumns] = useState<
    Record<ColumnKey, boolean>
  >(() => {
    const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!saved) return defaultVisibleColumns;

    try {
      return {
        ...defaultVisibleColumns,
        ...JSON.parse(saved),
      };
    } catch {
      return defaultVisibleColumns;
    }
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [openTruck, setOpenTruck] = useState(false);
  const [openPeriod, setOpenPeriod] = useState(false);
  const [openPeriodType, setOpenPeriodType] = useState(false);
  const [openMonth, setOpenMonth] = useState(false);
  const [deductFuel, setDeductFuel] = useState(true);
  const [reportPeriodType, setReportPeriodType] = useState<
    "monthly" | "custom"
  >("monthly");

  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  useEffect(() => {
    initApp();
  }, [initApp]);

  useEffect(() => {
    const currentMonth = String(new Date().getMonth() + 1);
    setReportsMonth(currentMonth);
  }, [setReportsMonth]);

  useEffect(() => {
    if (reportPeriodType === "custom") {
      if (!customStartDate || !customEndDate) return;

      fetchReports(customStartDate, customEndDate);
      return;
    }

    fetchReports();
  }, [
    fetchReports,
    reportsMonth,
    selectedTruck,
    reportPeriodType,
    customStartDate,
    customEndDate,
  ]);

  useEffect(() => {
    setExpensesMonth(reportsMonth);
  }, [reportsMonth, setExpensesMonth]);

  useEffect(() => {
    if (!selectedTruck) return;

    if (reportPeriodType === "custom") {
      if (!customStartDate || !customEndDate) return;

      fetchExpenses(customStartDate, customEndDate);
      return;
    }

    fetchExpenses();
  }, [
    fetchExpenses,
    selectedTruck,
    reportsMonth,
    reportPeriodType,
    customStartDate,
    customEndDate,
  ]);

  useEffect(() => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowColumnsMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedTruckOption = truckOptions.find((t) => t._id === selectedTruck);

  const selectedTruckData = truckRows.find((t) => t._id === selectedTruck);
  const selectedCompanyName = selectedTruckData?.companyName ?? "";

  const selectedTruckName =
    selectedTruckData?.truckName ?? selectedTruckOption?.truckName;

  const selectedBillingType = selectedTruckData?.billingType ?? "subcontracted";

  const selectedBilledTo =
    selectedBillingType === "direct"
      ? (selectedTruckData?.client ?? "")
      : (selectedTruckData?.billedTo ?? "");

  const selectedClient = selectedTruckData?.client ?? "";

  // Sorting state
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageTitle = selectedTruckName
    ? `${selectedTruckName} Reports`
    : "Reports";

  const formatCustomPeriodDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getReportPeriodText = () => {
    if (reportPeriodType === "custom" && customStartDate && customEndDate) {
      return `${formatCustomPeriodDate(customStartDate)} to ${formatCustomPeriodDate(customEndDate)}`;
    }

    const monthNames: Record<string, string> = {
      ALL: "Whole Year",
      "1": "January",
      "2": "February",
      "3": "March",
      "4": "April",
      "5": "May",
      "6": "June",
      "7": "July",
      "8": "August",
      "9": "September",
      "10": "October",
      "11": "November",
      "12": "December",
    };

    const year = new Date().getFullYear();
    const reportMonth = monthNames[reportsMonth] || "Whole Year";

    return reportsMonth === "ALL"
      ? `Whole Year ${year}`
      : `Month of ${reportMonth.toUpperCase()} ${year}`;
  };

  const handleDownloadReport = () => {
    const truckLabel = selectedTruckName || "All Trucks";
    const periodText = getReportPeriodText();

    exportMonthlyReport(reportRows, truckLabel, periodText, expenseRows);
  };

  const handleClientReport = () => {
    const truckLabel = selectedTruckName || "All Trucks";
    const periodText = getReportPeriodText();

    exportClientMonthlyReport(
      reportRows,
      truckLabel,
      periodText,
      expenseRows,
      deductFuel,
      selectedClient,
      selectedBilledTo,
      selectedBillingType,
      selectedCompanyName,
    );
  };

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-[20px] font-bold tracking-[-0.03em]">
              {pageTitle}
            </h1>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-background overflow-hidden">
        <div className="p-3.5 border-b border-border flex justify-between items-center w-full">
          {/* LEFT SIDE */}
          <div>
            <h2 className="text-sm font-semibold">Monthly Reports</h2>
            <p className="text-xs text-muted-foreground">
              Same columns as the trip table, filtered by month.
            </p>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleDownloadReport}
              className="h-9 px-3 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Download size={14} />
              Internal Report
            </button>

            <button
              type="button"
              onClick={handleClientReport}
              className="h-9 px-3 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Download size={14} />
              Client Report
            </button>

            <label className="h-9 px-3 rounded-md border border-border bg-background flex items-center gap-2 text-xs font-medium cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={deductFuel}
                onChange={(e) => setDeductFuel(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Fuel Deduction
            </label>

            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setShowColumnsMenu((v) => !v)}
                className="h-10 px-3 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Columns3 size={18} />
              </button>

              {showColumnsMenu && (
                <div className="absolute right-0 mt-2 z-100 w-64 max-h-[320px] overflow-y-auto rounded-md border border-border bg-background p-2">
                  <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Show Columns
                  </div>

                  <div className="flex flex-col">
                    {COLUMN_OPTIONS.map(([key, label]) => {
                      const checked = visibleColumns[key as ColumnKey];

                      return (
                        <button
                          key={key}
                          onClick={() =>
                            setVisibleColumns((prev) => ({
                              ...prev,
                              [key]: !prev[key as ColumnKey],
                            }))
                          }
                          className="flex items-center px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
                        >
                          <span className="flex-1 pr-4 text-left">{label}</span>

                          <span
                            className={`relative inline-flex h-4 w-7 items-center rounded-full ${
                              checked ? "bg-foreground" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`h-3 w-3 rounded-full bg-white transition-transform ${
                                checked ? "translate-x-3.5" : "translate-x-0.5"
                              }`}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-background px-3.5 py-3">
          {/* SEARCH */}
          <div className="min-w-[180px] flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Search
            </label>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />

              <input
                type="text"
                placeholder="Search shipment number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* TRUCK */}
          <div className="min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Truck
            </label>

            <Popover open={openTruck} onOpenChange={setOpenTruck}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                >
                  <span className="truncate">
                    {selectedTruckName || "All Trucks"}
                  </span>

                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search truck..."
                    className="text-xs"
                  />

                  <CommandEmpty className="text-xs">
                    No truck found.
                  </CommandEmpty>

                  <CommandGroup>
                    <CommandItem
                      value="All Trucks"
                      className="text-xs"
                      onSelect={() => {
                        setSelectedTruck("");
                        setOpenTruck(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          !selectedTruck ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      All Trucks
                    </CommandItem>

                    {truckOptions.map((truck) => (
                      <CommandItem
                        key={truck._id}
                        value={truck.truckName}
                        className="text-xs"
                        onSelect={() => {
                          setSelectedTruck(truck._id);
                          setOpenTruck(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selectedTruck === truck._id
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />

                        {truck.truckName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* PERIOD TYPE */}
          {/* PERIOD */}
          <div className="min-w-[140px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Period
            </label>

            <Popover open={openPeriodType} onOpenChange={setOpenPeriodType}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                >
                  <span>
                    {reportPeriodType === "monthly" ? "Monthly" : "Custom"}
                  </span>

                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-[160px] p-0" align="start">
                <Command>
                  <CommandGroup>
                    <CommandItem
                      value="Monthly"
                      className="text-xs"
                      onSelect={() => {
                        setReportPeriodType("monthly");
                        setOpenPeriodType(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          reportPeriodType === "monthly"
                            ? "opacity-100"
                            : "opacity-0"
                        }`}
                      />
                      Monthly
                    </CommandItem>

                    <CommandItem
                      value="Custom"
                      className="text-xs"
                      onSelect={() => {
                        setReportPeriodType("custom");
                        setOpenPeriodType(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          reportPeriodType === "custom"
                            ? "opacity-100"
                            : "opacity-0"
                        }`}
                      />
                      Custom
                    </CommandItem>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {reportPeriodType === "monthly" && (
            <div className="w-[260px] shrink-0">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Month
              </label>

              <Popover open={openMonth} onOpenChange={setOpenMonth}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span className="truncate">
                      {MONTH_OPTIONS.find(
                        (month) => month.value === reportsMonth,
                      )?.label || "Select month"}
                    </span>

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-[180px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search month..."
                      className="text-xs"
                    />

                    <CommandEmpty className="text-xs">
                      No month found.
                    </CommandEmpty>

                    <CommandGroup>
                      {MONTH_OPTIONS.map((month) => (
                        <CommandItem
                          key={month.value}
                          value={month.label}
                          className="text-xs"
                          onSelect={() => {
                            setReportsMonth(month.value);
                            setOpenMonth(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              reportsMonth === month.value
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />

                          {month.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {reportPeriodType === "custom" && (
            <div className="w-[260px] shrink-0">
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <CalendarDays size={12} />
                Date Range
              </label>

              <Popover open={openPeriod} onOpenChange={setOpenPeriod}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span
                      className={
                        !customStartDate ? "text-muted-foreground" : ""
                      }
                    >
                      {customStartDate && customEndDate
                        ? `${format(
                            new Date(`${customStartDate}T00:00:00`),
                            "MMM d, yyyy",
                          )} - ${format(
                            new Date(`${customEndDate}T00:00:00`),
                            "MMM d, yyyy",
                          )}`
                        : "Select date range"}
                    </span>

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={
                      customStartDate
                        ? {
                            from: new Date(`${customStartDate}T00:00:00`),
                            to: customEndDate
                              ? new Date(`${customEndDate}T00:00:00`)
                              : undefined,
                          }
                        : undefined
                    }
                    onSelect={(range: DateRange | undefined) => {
                      if (!range?.from) {
                        setCustomStartDate("");
                        setCustomEndDate("");
                        return;
                      }

                      const start = range.from;
                      const end = range.to;

                      setCustomStartDate(format(start, "yyyy-MM-dd"));

                      const completeRange =
                        end && end.getTime() !== start.getTime();

                      if (completeRange) {
                        setCustomEndDate(format(end, "yyyy-MM-dd"));
                        setOpenPeriod(false);
                      } else {
                        setCustomEndDate("");
                      }
                    }}
                    numberOfMonths={2}
                    defaultMonth={
                      customStartDate
                        ? new Date(`${customStartDate}T00:00:00`)
                        : new Date()
                    }
                    showOutsideDays
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          {/* CLEAR FILTERS */}
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setReportPeriodType("monthly");
              setReportsMonth(String(new Date().getMonth() + 1));
              setCustomStartDate("");
              setCustomEndDate("");
            }}
            disabled={
              !searchQuery &&
              reportPeriodType === "monthly" &&
              reportsMonth === String(new Date().getMonth() + 1) &&
              !customStartDate &&
              !customEndDate
            }
            className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
          >
            <RotateCcw size={14} />
            Reset
          </button>

          {/* dito natin ilalagay later ang Period/actions */}
        </div>

        <TripTable
          rows={reportRows}
          expenseRows={expenseRows}
          expandableDetails
          totalsRows={reportRows}
          loading={false}
          showActions={false}
          searchQuery={searchQuery}
          reportMode
          showTruckColumn={!selectedTruck}
          visibleColumns={visibleColumns}
          onExpenseClick={(data) => setExpenseBreakdown(data)}
          selectedTruck={selectedTruck}
          emptyState={
            <EmptyState
              icon={BarChart3}
              title="No report data"
              description={
                selectedTruck
                  ? `No trip records found for ${selectedTruckName} in the selected period.`
                  : "Select a truck and month to generate a report."
              }
            />
          }
        />
      </div>

      {/* Expense Breakdown Modal */}
      <ExpenseBreakdownModal
        open={!!expenseBreakdown}
        onClose={() => setExpenseBreakdown(null)}
        truckId={expenseBreakdown?.truckId || ""}
        dateIso={expenseBreakdown?.dateIso || ""}
        dateText={expenseBreakdown?.dateText || ""}
      />
    </div>
  );
}
