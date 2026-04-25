import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAppStore, type TripRow } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import KpiCard from "../components/shared/KpiCard";
import FilterBar from "../components/shared/FilterBar";
import TripModal from "../components/shared/TripModal";
import TripTable from "../components/shared/TripTable";
import ErrorState from "../components/shared/ErrorState";
import { exportTripsCsv, exportPayslip } from "../lib/exportHelpers";
import {
  DollarSign,
  CheckCircle2,
  BarChart3,
  ArrowUpDown,
  Plus,
  Search,
  Download,
  FileText,
  AlertTriangle,
  CheckCheck,
  XCircle,
  Trash2,
  Columns3,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Bar,
  BarChart,
  Legend,
} from "recharts";
import Modal from "../components/shared/Modal";
import Pagination from "../components/shared/Pagination";
import { usePagination } from "../hooks/usePagination";
import ExpenseBreakdownModal from "../components/shared/ExpenseBreakdownModal";
import { AnimatePresence, motion } from "framer-motion";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

export default function DashboardPage() {
  const {
    tripRows,
    kpis,
    previousKpis,
    chartData,
    loading,
    error,
    selectedTruck,
    truckOptions,
    initApp,
    fetchDashboard,
    deleteTrip,
    toggleTripPaid,
    searchQuery,
    setSearchQuery,
    startDate,
    endDate,
    rangePreset,
    selectedTripIds,
    setSelectedTripIds,
    bulkTogglePaid,
    bulkDeleteTrips,
    quickEditTrip,
  } = useAppStore();
  const { isAdmin } = useAuthStore();
  const admin = isAdmin();

  const [tripModal, setTripModal] = useState(false);
  const [editRow, setEditRow] = useState<TripRow | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<TripRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<TripRow | null>(null);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  const [showTruckWarning, setShowTruckWarning] = useState(false);
  const [expenseBreakdown, setExpenseBreakdown] = useState<{
    truckId: string;
    dateIso: string;
    dateText: string;
  } | null>(null);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const COLUMN_STORAGE_KEY = "dashboard-columns";

  const defaultVisibleColumns: Record<ColumnKey, boolean> = {
    truck: true,
    week: true,
    date: true,
    status: false,
    shipmentNumber: true,
    rate: true,
    trips: true,
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

  const searchInputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    onNewTrip: () => handleAddTrip(),
    onSearch: () => searchInputRef.current?.focus(),
  });

  useEffect(() => {
    initApp();
  }, [initApp]);

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

  const rangeLabels: Record<string, string> = {
    ALL: "Selected",
    CC: "This Week's",
    LC: "Previous Cutoff's",
    TM: "This Month's",
    LM: "Last Month's",
    MTD: "MTD",
    YTD: "YTD",
    CUSTOM: "Custom",
  };
  const kpiPrefix = rangeLabels[rangePreset] || "Selected";
  const pageTitle = selectedTruckName
    ? `${selectedTruckName} Overview`
    : "Overview";

  const showTruckColumn = !selectedTruck || selectedTruck === "ALL";

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

  const filteredRows = useMemo(() => {
    let rows = tripRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) => r.shipmentNumber.toLowerCase().includes(q));
    }
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const aVal =
          (a as unknown as Record<string, number | string>)[sortField] ?? 0;
        const bVal =
          (b as unknown as Record<string, number | string>)[sortField] ?? 0;
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [tripRows, searchQuery, sortField, sortDirection]);

  const moneyFormat = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const getChange = (current: number, previous: number) => {
    if (!previous) return { percent: 0, isUp: true };

    const diff = current - previous;
    const percent = (diff / previous) * 100;

    return {
      percent: Math.abs(percent),
      isUp: diff >= 0,
    };
  };

  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    paginatedItems: paginatedRows,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
  } = usePagination(filteredRows, 20);

  const handleAddTrip = () => {
    if (!selectedTruck) {
      setShowTruckWarning(true);
      return;
    }
    setEditRow(null);
    setDuplicateFrom(null);
    setTripModal(true);
  };

  const handleDuplicate = (row: TripRow) => {
    setEditRow(null);
    setDuplicateFrom(row);
    setTripModal(true);
  };

  const handleExportCsv = () => exportTripsCsv(filteredRows);

  const handleExportPayslip = () => {
    const truckLabel = selectedTruckName || "All Trucks";
    exportPayslip(filteredRows, truckLabel, startDate, endDate);
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    await deleteTrip(deleteModal._id);
    setDeleteModal(null);
  };

  const handleBulkDelete = async () => {
    await bulkDeleteTrips(selectedTripIds);
    setBulkDeleteModal(false);
  };

  return (
    <div>
      {error && !loading && (
        <ErrorState message={error} onRetry={() => fetchDashboard()} />
      )}

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
        </div>

        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track revenue, costs, and payout summary across selected periods
              and trucks.
            </p>
          </div>
        </div>
      </div>

      <FilterBar
        showTruck={admin}
        allowedRangePresets={admin ? undefined : (["CC", "LC"] as const)}
        actions={
          <button
            onClick={handleAddTrip}
            className="h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Trip
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-4">
        {/* GROSS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {kpiPrefix} Gross
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {moneyFormat.format(kpis.gross)}
            </div>

            {(() => {
              const current = kpis.gross;
              const previous = previousKpis.gross;

              if (!previous || previous === 0) return null;

              const diff = current - previous;
              const percent = (diff / previous) * 100;
              const isUp = diff >= 0;

              return (
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium",
                      isUp
                        ? "bg-green-500/10 text-green-600"
                        : "bg-red-500/10 text-red-500",
                    )}
                  >
                    {isUp ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {isUp ? "+" : "-"}
                    {Math.abs(percent).toFixed(1)}%
                    <span className="opacity-70">
                      ({isUp ? "+" : "-"}
                      {moneyFormat.format(Math.abs(diff))})
                    </span>
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    vs last period
                  </span>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* NET */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {kpiPrefix} Net
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {moneyFormat.format(kpis.net)}
            </div>

            {(() => {
              const current = kpis.net;
              const previous = previousKpis.net;

              if (!previous || previous === 0) return null;

              const diff = current - previous;
              const percent = (diff / previous) * 100;
              const isUp = diff >= 0;

              return (
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium",
                      isUp
                        ? "bg-green-500/10 text-green-600"
                        : "bg-red-500/10 text-red-500",
                    )}
                  >
                    {isUp ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {isUp ? "+" : "-"}
                    {Math.abs(percent).toFixed(1)}%
                    <span className="opacity-70">
                      ({isUp ? "+" : "-"}
                      {moneyFormat.format(Math.abs(diff))})
                    </span>
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    vs last period
                  </span>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* PAYABLE */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {kpiPrefix} Payable
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {moneyFormat.format(kpis.payable)}
            </div>

            {(() => {
              const current = kpis.payable;
              const previous = previousKpis.payable;

              if (!previous || previous === 0) return null;

              const diff = current - previous;
              const percent = (diff / previous) * 100;
              const isUp = diff >= 0;

              return (
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium",
                      isUp
                        ? "bg-green-500/10 text-green-600"
                        : "bg-red-500/10 text-red-500",
                    )}
                  >
                    {isUp ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {isUp ? "+" : "-"}
                    {Math.abs(percent).toFixed(1)}%
                    <span className="opacity-70">
                      ({isUp ? "+" : "-"}
                      {moneyFormat.format(Math.abs(diff))})
                    </span>
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    vs last period
                  </span>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* CASH OUTFLOW */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {kpiPrefix} Cash Outflow
            </CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">
              {moneyFormat.format(kpis.cashOutflow)}
            </div>

            {(() => {
              const current = kpis.cashOutflow;
              const previous = previousKpis.cashOutflow;

              if (!previous || previous === 0) return null;

              const diff = current - previous;
              const percent = (diff / previous) * 100;

              // ✅ SIGN = based on actual math
              const sign = diff > 0 ? "+" : "-";

              // ✅ COLOR LOGIC (INVERTED for expenses)
              const isGood = diff <= 0;

              return (
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium",
                      isGood
                        ? "bg-green-500/10 text-green-600"
                        : "bg-red-500/10 text-red-500",
                    )}
                  >
                    {diff > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {sign}
                    {Math.abs(percent).toFixed(1)}%
                    <span className="opacity-70">
                      ({sign}
                      {moneyFormat.format(Math.abs(diff))})
                    </span>
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    vs last period
                  </span>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* AREA CHART */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Gross vs Net Income
            </CardTitle>
            <span className="text-xs text-muted-foreground">Trend</span>
          </CardHeader>

          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="label"
                  fontSize={12}
                  stroke="#9ca3af"
                  tick={{ fill: "#9ca3af" }}
                />

                <YAxis
                  fontSize={12}
                  stroke="#9ca3af"
                  tick={{ fill: "#9ca3af" }}
                />

                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: unknown, name: string) => {
                    if (typeof value !== "number") return [value ?? "", name];

                    const label =
                      name === "gross"
                        ? "Gross Income"
                        : name === "net"
                          ? "Net Income"
                          : name;

                    return [moneyFormat.format(value), label];
                  }}
                />

                <Legend
                  wrapperStyle={{
                    color: "hsl(var(--foreground))",
                    fontSize: "12px",
                  }}
                />

                <Area
                  type="linear"
                  dataKey="gross"
                  name="Gross Income"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fill="#2563eb22"
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-out"
                />

                <Area
                  type="linear"
                  dataKey="net"
                  name="Net Income"
                  stroke="#14b8a6"
                  strokeWidth={3}
                  fill="#14b8a622"
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* BAR CHART */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Trips</CardTitle>
            <span className="text-xs text-muted-foreground">Volume</span>
          </CardHeader>

          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 20 }}>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="label"
                  fontSize={12}
                  stroke="#9ca3af"
                  tick={{ fill: "#9ca3af" }}
                />

                <YAxis
                  fontSize={12}
                  stroke="#9ca3af"
                  tick={{ fill: "#9ca3af" }}
                />

                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: unknown) =>
                    typeof value === "number"
                      ? value.toLocaleString()
                      : (value ?? "")
                  }
                />

                <Bar
                  dataKey="trips"
                  name="Trips"
                  fill="#ff9319"
                  radius={6}
                  activeBar={{ fill: "hsl(var(--foreground))" }}
                  label={{
                    position: "top",
                    fontSize: 12,
                    fill: "#9ca3af",
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="border rounded-lg bg-background p-3.5 overflow-visible">
        <div className="flex flex-col gap-3 mb-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">Trip Records</h2>
            <p className="text-sm text-muted-foreground">
              Filter, edit, export, and generate payslips from the selected set.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex-grow min-w-[240px] relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search Shipment Number... ( / )"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[44px] rounded-md border border-border bg-background text-sm pl-9 pr-3.5 focus:outline-none focus:border-ring transition-colors"
              />
            </div>
            <button
              onClick={handleExportCsv}
              className="h-10 px-3 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Download size={16} /> CSV
            </button>
            <button
              onClick={handleExportPayslip}
              className="h-10 px-3 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
            >
              <FileText size={16} /> Payslip
            </button>
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setShowColumnsMenu((v) => !v)}
                className={`min-h-[44px] w-[44px] rounded-[14px] border flex items-center justify-center transition-colors
                  ${
                    showColumnsMenu
                      ? "bg-muted"
                      : "bg-background hover:bg-muted text-muted-foreground"
                  }`}
                title="Show / Hide Columns"
              >
                <Columns3 size={18} />
              </button>
              {showColumnsMenu && (
                <div className="absolute right-0 mt-2 z-50 w-64 max-h-[320px] overflow-y-auto rounded-md border border-border bg-background p-2">
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

        <TripTable
          rows={paginatedRows}
          totalsRows={filteredRows}
          loading={loading}
          showActions
          selectable
          selectedIds={selectedTripIds}
          onSelectionChange={setSelectedTripIds}
          onTogglePaid={(id) => toggleTripPaid(id)}
          onEdit={(r) => {
            setEditRow(r);
            setDuplicateFrom(null);
            setTripModal(true);
          }}
          onDelete={(r) => setDeleteModal(r)}
          onDuplicate={handleDuplicate}
          onExpenseClick={(data) => setExpenseBreakdown(data)}
          selectedTruck={selectedTruck}
          showTruckColumn={showTruckColumn}
          visibleColumns={visibleColumns}
          onQuickEdit={quickEditTrip}
          sortable
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
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

      <AnimatePresence>
        {selectedTripIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg"
          >
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-[0_8px_32px_rgba(37,99,235,0.18)] dark:shadow-[0_8px_32px_rgba(37,99,235,0.25)] px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-2">
              <span className="text-sm font-semibold whitespace-nowrap">
                {selectedTripIds.length} trip
                {selectedTripIds.length !== 1 ? "s" : ""} selected
              </span>
              <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulkTogglePaid(selectedTripIds, true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors"
                >
                  <CheckCheck size={15} /> Paid
                </button>
                <button
                  onClick={() => bulkTogglePaid(selectedTripIds, false)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  <XCircle size={15} /> Unpaid
                </button>
                <button
                  onClick={() => setBulkDeleteModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={15} /> Delete
                </button>
                <button
                  onClick={() => setSelectedTripIds([])}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TripModal
        open={tripModal}
        onClose={() => {
          setTripModal(false);
          setEditRow(null);
          setDuplicateFrom(null);
        }}
        editRow={editRow}
        duplicateFrom={duplicateFrom}
      />

      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title={`Delete Trip for - ${deleteModal?.truckName || selectedTruckName || "Selected Truck"}`}
        footer={
          <>
            <button
              onClick={() => setDeleteModal(null)}
              className="px-4 py-2.5 rounded-[14px] border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-6 py-2.5 rounded-[14px] bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </>
        }
      >
        <p>Are you sure you want to delete this trip?</p>
        <p className="font-bold mt-1">
          {deleteModal?.dateText} / {deleteModal?.shipmentNumber}
        </p>
      </Modal>

      <Modal
        open={bulkDeleteModal}
        onClose={() => setBulkDeleteModal(false)}
        title="Delete selected trips?"
        footer={
          <>
            <button
              onClick={() => setBulkDeleteModal(false)}
              className="px-4 py-2.5 rounded-[14px] border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-6 py-2.5 rounded-[14px] bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              Delete {selectedTripIds.length} Trip
              {selectedTripIds.length !== 1 ? "s" : ""}
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to delete{" "}
          <strong>{selectedTripIds.length}</strong> selected trip
          {selectedTripIds.length !== 1 ? "s" : ""}?
        </p>
        <p className="text-sm text-slate-500 mt-1">
          This action cannot be undone.
        </p>
      </Modal>

      <ExpenseBreakdownModal
        open={!!expenseBreakdown}
        onClose={() => setExpenseBreakdown(null)}
        truckId={expenseBreakdown?.truckId || ""}
        dateIso={expenseBreakdown?.dateIso || ""}
        dateText={expenseBreakdown?.dateText || ""}
      />

      <Modal
        open={showTruckWarning}
        onClose={() => setShowTruckWarning(false)}
        title=""
      >
        <div className="text-center py-4">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-500/10 grid place-items-center text-amber-500">
            <AlertTriangle size={28} />
          </div>
          <div className="font-bold text-lg mb-1">
            Please select a truck first!
          </div>
          <p className="text-sm text-slate-500">
            Choose a truck from the filter bar to add a trip.
          </p>
        </div>
      </Modal>
    </div>
  );
}
