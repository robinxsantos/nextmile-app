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
  PhilippinePeso,
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
  Receipt,
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
  const [verificationFilter, setVerificationFilter] = useState<
    "ALL" | "Verified" | "Pending" | "For Confirmation"
  >("ALL");

  const defaultVisibleColumns: Record<ColumnKey, boolean> = {
    truck: true,
    week: false,
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
    if (verificationFilter !== "ALL") {
      rows = rows.filter(
        (r) =>
          (r.verificationStatus || "For Confirmation") === verificationFilter,
      );
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
  }, [tripRows, searchQuery, verificationFilter, sortField, sortDirection]);

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

      <div className="sticky top-0 z-40 bg-background">
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
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        {/* 🔴 LEFT: KPI SUMMARY (reuses your original logic) */}
        <div className="lg:col-span-1">
          <Card className="p-5 min-h-[600px] flex flex-col justify-start">
            <div className="mb-2">
              <h2 className="text-base font-semibold">Financial Summary</h2>
              <p className="text-sm text-muted-foreground">
                Overview vs last period
              </p>
            </div>

            <div className="space-y-2">
              {[
                {
                  label: "Gross Income",
                  value: kpis.gross,
                  prev: previousKpis.gross,
                  icon: PhilippinePeso,
                },
                {
                  label: "Expenses",
                  value: kpis.expenses,
                  prev: previousKpis.expenses,
                  icon: Receipt,
                  invert: true,
                },
                {
                  label: "Net Income",
                  value: kpis.net,
                  prev: previousKpis.net,
                  icon: CheckCircle2,
                },
                {
                  label: "Payable",
                  value: kpis.payable,
                  prev: previousKpis.payable,
                  icon: BarChart3,
                },
                {
                  label: "Cash Outflow",
                  value: kpis.cashOutflow,
                  prev: previousKpis.cashOutflow,
                  icon: ArrowUpDown,
                  invert: true,
                },
              ].map((item, idx) => {
                const diff = item.value - item.prev;
                const percent =
                  item.prev === 0
                    ? 100
                    : item.prev
                      ? (diff / item.prev) * 100
                      : 0;

                const isUp = diff >= 0;
                const sign = diff === 0 ? "" : diff > 0 ? "+" : "-";
                const isGood = item.invert ? diff <= 0 : diff >= 0;

                const Icon = item.icon;

                return (
                  <div key={item.label}>
                    <div className="grid grid-cols-[1fr_auto] items-start py-4">
                      {/* LEFT */}
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">
                            vs last period
                          </p>
                        </div>
                      </div>

                      {/* RIGHT */}
                      <div className="flex flex-col items-end justify-start pt-[2px]">
                        {/* TOTAL */}
                        <span className="text-base font-bold leading-tight">
                          ₱{moneyFormat.format(item.value)}
                        </span>

                        {/* CHANGE (PILL) */}
                        {item.prev !== undefined &&
                          (item.label === "Payable" ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium mt-1",
                                isGood
                                  ? "bg-green-500/10 text-green-600"
                                  : "bg-red-500/10 text-red-500",
                              )}
                            >
                              {diff === 0 ? (
                                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                              ) : isUp ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {sign}₱{moneyFormat.format(Math.abs(diff))}
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium mt-1",
                                isGood
                                  ? "bg-green-500/10 text-green-600"
                                  : "bg-red-500/10 text-red-500",
                              )}
                            >
                              {diff === 0 ? (
                                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                              ) : isUp ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {sign}
                              {Math.abs(percent).toFixed(1)}%
                              <span>
                                ({sign}₱{moneyFormat.format(Math.abs(diff))})
                              </span>
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* DIVIDER */}
                    {idx !== 4 && (
                      <div className="border-t border-dashed border-border" />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* 🔵 RIGHT: CHARTS (unchanged) */}
        <div className="lg:col-span-2 h-[600px]">
          <div className="flex flex-col gap-4 h-full">
            {/* AREA CHART */}
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Monthly Gross vs Net Income
                </CardTitle>
                <span className="text-xs text-muted-foreground">Trend</span>
              </CardHeader>

              <CardContent className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ left: 20 }}>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis
                      fontSize={12}
                      tickFormatter={(value) =>
                        Number(value).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      }
                    />

                    <Tooltip
                      formatter={(value: unknown, name: string) => {
                        if (typeof value !== "number")
                          return [value ?? "", name];

                        const label =
                          name === "gross"
                            ? "Gross Income"
                            : name === "net"
                              ? "Net Income"
                              : name;

                        return [
                          "₱" +
                            new Intl.NumberFormat("en-PH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(value),
                          label,
                        ];
                      }}
                    />
                    <Area
                      type="linear"
                      dataKey="gross"
                      stroke="#2563eb"
                      fill="#2563eb22"
                    />
                    <Area
                      type="linear"
                      dataKey="net"
                      stroke="#14b8a6"
                      fill="#14b8a622"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* BAR CHART */}
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Monthly Trips
                </CardTitle>
                <span className="text-xs text-muted-foreground">Volume</span>
              </CardHeader>

              <CardContent className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, left: 20 }}>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar
                      dataKey="trips"
                      name="Trips"
                      fill="#ff9319"
                      radius={6}
                      label={{
                        position: "top",
                        offset: 8,
                        fontSize: 12,
                        fill: "#9ca3af",
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="border rounded-lg bg-background p-3.5 overflow-visible mt-4">
        <div className="flex flex-col gap-3 mb-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">Trip Records</h2>
            <p className="text-sm text-muted-foreground">
              Filter, edit, export, and generate payslips from the selected set.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex items-center gap-1 border border-border rounded-md p-1 h-[44px]">
              {["ALL", "Verified", "Pending", "For Confirmation"].map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setVerificationFilter(status as any)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-md transition-colors",

                      verificationFilter === status &&
                        status === "Verified" &&
                        "bg-green-500/80 text-white",

                      verificationFilter === status &&
                        status === "Pending" &&
                        "bg-orange-500 text-white",

                      verificationFilter === status &&
                        status === "For Confirmation" &&
                        "bg-gray-500 text-white",

                      verificationFilter === status &&
                        status === "ALL" &&
                        "bg-foreground text-background",

                      verificationFilter !== status &&
                        "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {status === "ALL" ? "All" : status}
                  </button>
                ),
              )}
            </div>
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
          onVerificationChange={async (id, status) => {
            await quickEditTrip(id, "verificationStatus", status);
          }}
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
        title={`Delete Trip for - ${
          deleteModal?.truckName || selectedTruckName || "Selected Truck"
        }`}
        footer={
          <>
            <button
              onClick={() => setDeleteModal(null)}
              className="px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleDelete}
              className="px-6 py-2.5 rounded-md bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete
        </p>

        <p className="font-semibold mt-1">
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
