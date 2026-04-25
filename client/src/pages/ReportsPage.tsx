import { useEffect, useState, useMemo, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import FilterBar from "../components/shared/FilterBar";
import TripTable from "../components/shared/TripTable";
import ExpenseBreakdownModal from "../components/shared/ExpenseBreakdownModal";
import { exportMonthlyReport } from "../lib/exportHelpers";
import { Download, BarChart3 } from "lucide-react";
import Pagination from "../components/shared/Pagination";
import { usePagination } from "../hooks/usePagination";
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

  const selectedTruckName = truckOptions.find(
    (t) => t._id === selectedTruck,
  )?.truckName;

  // Sorting state
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback(
    (field: string) => {
      setSortDirection((prev) =>
        sortField === field ? (prev === "asc" ? "desc" : "asc") : "asc",
      );
      setSortField(field);
    },
    [sortField],
  );

  const sortedRows = useMemo(() => {
    if (!sortField) return reportRows;
    return [...reportRows].sort((a, b) => {
      const aVal =
        (a as unknown as Record<string, number | string>)[sortField] ?? 0;
      const bVal =
        (b as unknown as Record<string, number | string>)[sortField] ?? 0;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [reportRows, sortField, sortDirection]);

  const {
    paginatedItems: paginatedReports,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
  } = usePagination(sortedRows, 20);

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

      <FilterBar
        showRange={false}
        showTruck={false}
        showMonth
        monthValue={reportsMonth}
        onMonthChange={setReportsMonth}
        actions={
          <button
            onClick={handleDownloadReport}
            className="h-10 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
          >
            <Download size={16} /> Download Report
          </button>
        }
      />

      <div className="border border-border rounded-lg bg-background p-3.5 flex flex-col">
        <div className="mb-3">
          <h2 className="text-base font-bold tracking-tight">
            MONTHLY REPORTS
          </h2>
          <p className="text-sm text-muted-foreground">
            Same columns as the trip table, filtered by month.
          </p>
        </div>
        <TripTable
          rows={paginatedReports}
          totalsRows={sortedRows}
          loading={false}
          showActions={false}
          reportMode
          showTruckColumn={!selectedTruck}
          sortable
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
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
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
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
