import { useEffect, useState } from "react";
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
  RotateCcw,
  CalendarDays,
} from "lucide-react";
import EmptyState from "../components/shared/EmptyState";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [openPeriod, setOpenPeriod] = useState(false);
  const [deductFuel, setDeductFuel] = useState(true);
  const [showRateAdjustment, setShowRateAdjustment] = useState(false);
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

    exportMonthlyReport(
      reportRows,
      truckLabel,
      periodText,
      expenseRows,
      false,
      false,
      "",
      "",
      "subcontracted",
      "",
      showRateAdjustment,
    );
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
      showRateAdjustment,
    );
  };

  return (
    <div>
      <div className="sticky top-14 z-30 bg-background py-2">
        <div className="flex flex-wrap items-center justify-center gap-0">
          {/* PERIOD TYPE */}
          <Select
            value={reportPeriodType}
            onValueChange={(value) =>
              setReportPeriodType(value as "monthly" | "custom")
            }
          >
            <SelectTrigger className="w-[180px] rounded-r-none">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {/* MONTH */}
          {reportPeriodType === "monthly" && (
            <Select value={reportsMonth} onValueChange={setReportsMonth}>
              <SelectTrigger className="w-[290px] rounded-l-none border-l-0">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>

              <SelectContent>
                {MONTH_OPTIONS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* CUSTOM DATE RANGE */}
          {reportPeriodType === "custom" && (
            <Popover open={openPeriod} onOpenChange={setOpenPeriod}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-[290px] justify-start rounded-l-none border-l-0 font-normal"
                >
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" />

                  <span
                    className={`truncate ${
                      !customStartDate ? "text-muted-foreground" : ""
                    }`}
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
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-auto p-0" align="start">
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
          )}

          {/* RESET */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-2"
            aria-label="Reset report period"
            onClick={() => {
              setReportPeriodType("monthly");
              setReportsMonth(String(new Date().getMonth() + 1));
              setCustomStartDate("");
              setCustomEndDate("");
            }}
            disabled={
              reportPeriodType === "monthly" &&
              reportsMonth === String(new Date().getMonth() + 1) &&
              !customStartDate &&
              !customEndDate
            }
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
      <Card size="sm" className="mt-4 !gap-0">
        <CardHeader className="border-b">
          <div>
            <CardTitle>Reports</CardTitle>

            <CardDescription>
              Trip report for the selected reporting period.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="border-b py-4">
          <div className="flex flex-wrap items-end gap-2">
            {/* SEARCH */}
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>

              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>

                <InputGroupInput
                  placeholder="Search shipment number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </div>

            {/* REPORT ACTIONS */}
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadReport}
            >
              <Download />
              Internal Report
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleClientReport}
            >
              <Download />
              Client Report
            </Button>

            {/* FUEL DEDUCTION */}
            <div className="flex h-9 items-center gap-2 px-2">
              <Checkbox
                id="deduct-fuel"
                checked={deductFuel}
                onCheckedChange={(checked) => setDeductFuel(checked === true)}
              />

              <Label
                htmlFor="deduct-fuel"
                className="cursor-pointer whitespace-nowrap text-xs"
              >
                Fuel Deduction
              </Label>
            </div>

            {/* RATE ADJUSTMENT */}
            <div className="flex h-9 items-center gap-2 px-2">
              <Checkbox
                id="show-rate-adjustment"
                checked={showRateAdjustment}
                onCheckedChange={(checked) =>
                  setShowRateAdjustment(checked === true)
                }
              />

              <Label
                htmlFor="show-rate-adjustment"
                className="cursor-pointer whitespace-nowrap text-xs"
              >
                Rate Adjustment
              </Label>
            </div>

            {/* COLUMNS */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Show or hide columns"
                >
                  <Columns3 />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>

                <DropdownMenuSeparator />

                {COLUMN_OPTIONS.map(([key, label]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visibleColumns[key]}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((current) => ({
                        ...current,
                        [key]: checked === true,
                      }))
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>

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
      </Card>

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
