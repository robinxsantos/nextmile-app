import { useEffect, useState, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import FilterBar from "../components/shared/FilterBar";
import TripTable from "../components/shared/TripTable";
import ExpenseBreakdownModal from "../components/shared/ExpenseBreakdownModal";
import {
  exportMonthlyReport,
  exportClientMonthlyReport,
} from "../lib/exportHelpers";
import { Download, BarChart3, Columns3 } from "lucide-react";
import EmptyState from "../components/shared/EmptyState";
export default function ReportsPage() {
  const {
    reportRows,
    reportsMonth,
    setReportsMonth,
    fetchReports,
    initApp,
    selectedTruck,
    truckOptions,
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
    ["crewSalary", "Crew Salary"],
    ["cashAdvance", "Cash Adv."],
    ["reimbursements", "Cr. Reimb."],
    ["expenses", "Expenses"],
    ["note", "Note"],
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
    crewSalary: true,
    cashAdvance: true,
    reimbursements: true,
    expenses: true,
    note: true,
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

  useEffect(() => {
    initApp();
  }, [initApp]);

  useEffect(() => {
    const currentMonth = String(new Date().getMonth() + 1);
    setReportsMonth(currentMonth);
  }, [setReportsMonth]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports, reportsMonth, selectedTruck]);

  useEffect(() => {
    setExpensesMonth(reportsMonth);
  }, [reportsMonth, setExpensesMonth]);

  useEffect(() => {
    if (selectedTruck) fetchExpenses();
  }, [fetchExpenses, selectedTruck, reportsMonth]);

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

  const selectedTruckName = truckOptions.find(
    (t) => t._id === selectedTruck,
  )?.truckName;

  // Sorting state
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const pageTitle = selectedTruckName
    ? `${selectedTruckName} Reports`
    : "Reports";

  const handleDownloadReport = () => {
    const truckLabel = selectedTruckName || "All Trucks";
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
    const periodText =
      reportsMonth === "ALL"
        ? `WHOLE YEAR ${year}`
        : `${reportMonth.toUpperCase()} ${year}`;
    exportMonthlyReport(reportRows, truckLabel, periodText, expenseRows);
  };

  const handleClientReport = () => {
    const truckLabel = selectedTruckName || "All Trucks";

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

    const periodText =
      reportsMonth === "ALL"
        ? `WHOLE YEAR ${year}`
        : `${reportMonth.toUpperCase()} ${year}`;

    exportClientMonthlyReport(reportRows, truckLabel, periodText, expenseRows);
  };

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-[1.45rem] font-bold tracking-tight">
              {pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monthly report view using the same table columns.
            </p>
          </div>
        </div>
      </div>
      <div className="sticky top-0 z-40 bg-background">
        <FilterBar
          showRange={false}
          showTruck={false}
          showMonth
          monthValue={reportsMonth}
          onMonthChange={setReportsMonth}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadReport}
                className="h-10 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                Export Internal Report
              </button>

              <button
                onClick={handleClientReport}
                className="h-10 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                Export Client Report
              </button>
            </div>
          }
        />
      </div>
      <div className="border border-border rounded-lg bg-background p-3.5 flex flex-col mt-4">
        <div className="flex justify-between items-center mb-3 w-full">
          {/* LEFT SIDE */}
          <div>
            <h2 className="text-base font-bold tracking-tight">
              MONTHLY REPORTS
            </h2>
            <p className="text-sm text-muted-foreground">
              Same columns as the trip table, filtered by month.
            </p>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-2 ml-auto">
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setShowColumnsMenu((v) => !v)}
                className="h-10 px-3 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
              >
                <span>Columns</span>
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
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search shipment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <TripTable
          rows={reportRows}
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
