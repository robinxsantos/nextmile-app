import { useEffect, useState, useMemo, useRef } from "react";
import { useAppStore, type TripRow } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
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
import ExpenseBreakdownModal from "../components/shared/ExpenseBreakdownModal";
import { AnimatePresence, motion } from "framer-motion";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Sparkline({ data, labels }: { data: number[]; labels: string[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);

  const normalized = data.map((v, i) => ({
    value: max === min ? 50 : ((v - min) / (max - min)) * 100,
    raw: v,
    label: labels[i],
  }));

  const isUp = data[data.length - 1] >= data[0];

  const gradientId = isUp ? "sparkUp" : "sparkDown";

  return (
    <AreaChart width={90} height={32} data={normalized}>
      <defs>
        <linearGradient id="sparkUp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
        </linearGradient>

        <linearGradient id="sparkDown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
        </linearGradient>
      </defs>

      <Area
        type="monotone"
        dataKey="value"
        stroke={isUp ? "#22c55e" : "#ef4444"}
        strokeWidth={2}
        fill={`url(#${gradientId})`}
        dot={false}
      />

      <Tooltip
        formatter={(_, __, props: any) => [
          `₱${props.payload.raw.toLocaleString()}`,
        ]}
        labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
        contentStyle={{
          fontSize: "11px",
          padding: "6px 8px",
          borderRadius: "6px",

          // ✅ WHITE STYLE
          backgroundColor: "#ffffff",
          color: "#111827", // dark text

          border: "1px solid #e5e7eb", // light border
          boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
        }}
        labelStyle={{
          color: "#111827",
          fontWeight: 600,
        }}
      />
    </AreaChart>
  );
}
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
    addExpense,
    deleteExpense,
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

  const getChartMode = () => {
    if (rangePreset === "TM") return "WEEKLY";
    if (rangePreset === "YTD") return "MONTHLY"; // 🔥 FIX
    if (rangePreset === "ALL") return "MONTHLY"; // 🔥 FIX
    return "WEEKLY";
  };
  const pageTitle = selectedTruckName
    ? `${selectedTruckName} Overview`
    : "Overview";

  const showTruckColumn = !selectedTruck || selectedTruck === "ALL";

  const moneyFormat = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleExportCsv = () => exportTripsCsv(tripRows);

  const handleExportPayslip = () => {
    const truckLabel = selectedTruckName || "All Trucks";
    exportPayslip(tripRows, truckLabel, startDate, endDate);
  };

  const handleTogglePaid = async (id: string) => {
    const trip = tripRows.find((r) => r._id === id);
    if (!trip) return;

    const willBePaid = !trip.paid;

    try {
      const latestExpenses = useAppStore.getState().expenseRows;

      const existing = latestExpenses.find((e) => e.tripId === trip._id);

      // 🔴 UNPAID FIRST → delete expense
      if (!willBePaid) {
        if (existing) {
          await deleteExpense(existing._id);
        }
      }

      // 🔥 ALWAYS TOGGLE FIRST (SOURCE OF TRUTH)
      await toggleTripPaid(id);

      // 🟢 AFTER TOGGLE → create expense if needed
      if (willBePaid && !existing && trip.reimbursements > 0) {
        await addExpense({
          truckId:
            typeof trip.truck === "string"
              ? trip.truck
              : trip.truck && typeof trip.truck === "object"
                ? trip.truck._id
                : selectedTruck,
          date: trip.dateIso,
          category: "REIMBURSEMENT",
          amount: trip.reimbursements,
          description: `Crew reimbursement (${trip.shipmentNumber || "Trip"})`,
          tripId: trip._id,
        });
      }

      // 🔥 FINAL SYNC (single refresh only)
      await fetchDashboard();
    } catch (err) {
      console.error("Toggle failed", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;

    const trip = deleteModal;

    try {
      // 🔍 hanapin related expense
      const latestExpenses = useAppStore.getState().expenseRows;

      const existing = latestExpenses.find((e) => e.tripId === trip._id);

      // 🔥 delete expense first (if exists)
      if (existing) {
        await deleteExpense(existing._id);
      }

      // 🔥 then delete trip
      await deleteTrip(trip._id);

      setDeleteModal(null);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleBulkDelete = async () => {
    await bulkDeleteTrips(selectedTripIds);
    setBulkDeleteModal(false);
  };

  const chartMode = getChartMode();

  const groupedChartData = useMemo(() => {
    if (chartMode === "WEEKLY") {
      const weeks: Record<string, any> = {};

      chartData.forEach((item) => {
        const date = new Date(item.dateIso);

        const getMondayIndex = (d: Date) => (d.getDay() + 6) % 7;

        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - getMondayIndex(date));

        const firstDayOfMonth = new Date(
          date.getFullYear(),
          date.getMonth(),
          1,
        );
        const lastDayOfMonth = new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          0,
        );

        const start =
          startOfWeek < firstDayOfMonth ? firstDayOfMonth : startOfWeek;

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const end = endOfWeek > lastDayOfMonth ? lastDayOfMonth : endOfWeek;

        const format = (d: Date) =>
          d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        const label = `${format(start)}–${format(end)}`;

        const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;

        if (!weeks[key]) {
          weeks[key] = {
            label,
            gross: 0,
            net: 0,
            trips: 0,

            expenses: 0,
            payable: 0,
            cashOutflow: 0,
          };
        }

        weeks[key].gross += item.gross || 0;
        weeks[key].net += item.net || 0;
        weeks[key].trips += item.trips || 0;
        weeks[key].expenses += item.expenses || 0;
        weeks[key].payable += item.payable || 0;
        weeks[key].cashOutflow += item.cashOutflow || 0;
      });

      return Object.values(weeks);
    }

    // 🔥 MONTHLY MODE
    const months: Record<string, any> = {};

    chartData.forEach((item) => {
      const date = new Date(item.dateIso);

      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const label = date.toLocaleDateString("en-US", {
        month: "short",
      });

      if (!months[key]) {
        months[key] = {
          label,
          gross: 0,
          net: 0,
          trips: 0,

          expenses: 0,
          payable: 0,
          cashOutflow: 0,
        };
      }

      months[key].gross += item.gross || 0;
      months[key].net += item.net || 0;
      months[key].trips += item.trips || 0;
      months[key].expenses += item.expenses || 0;
      months[key].payable += item.payable || 0;
      months[key].cashOutflow += item.cashOutflow || 0;
    });

    return Object.values(months);
  }, [chartData, chartMode]);

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
                const isCutoff = rangePreset === "CC" || rangePreset === "LC";

                let sparkSource;

                if (isCutoff) {
                  // 🔥 cutoff = comparison only (2 points)
                  sparkSource = [
                    {
                      label: "Previous",
                      gross: previousKpis.gross,
                      net: previousKpis.net,
                      expenses: previousKpis.expenses,
                      payable: previousKpis.payable,
                      cashOutflow: previousKpis.cashOutflow,
                    },
                    {
                      label: "Current",
                      gross: kpis.gross,
                      net: kpis.net,
                      expenses: kpis.expenses,
                      payable: kpis.payable,
                      cashOutflow: kpis.cashOutflow,
                    },
                  ];
                } else {
                  // 🔥 TM / YTD / ALL → follow chart behavior
                  sparkSource = groupedChartData;
                }
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
                    <div className="grid grid-cols-[1fr_1fr_auto] items-center py-4 gap-3">
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

                      {/* MIDDLE — SPARKLINE */}
                      <div className="hidden md:flex justify-center items-center">
                        {/* MIDDLE — SPARKLINE */}
                        <div className="hidden md:flex justify-center items-center">
                          <Sparkline
                            data={sparkSource.map((d: any) => {
                              switch (item.label) {
                                case "Gross Income":
                                  return d.gross;
                                case "Net Income":
                                  return d.net;
                                case "Expenses":
                                  return d.expenses;
                                case "Payable":
                                  return d.payable;
                                case "Cash Outflow":
                                  return d.cashOutflow;
                                default:
                                  return 0;
                              }
                            })}
                            labels={sparkSource.map((d: any) => d.label)}
                          />
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
                  {chartMode === "WEEKLY"
                    ? "Weekly Gross vs Net Income"
                    : "Monthly Gross vs Net Income"}
                </CardTitle>
                <span className="text-xs text-muted-foreground">Trend</span>
              </CardHeader>

              <CardContent className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={groupedChartData}
                    margin={{ left: 20, top: 20, right: 20 }}
                  >
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
                      formatter={(value: number, name: string) => {
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
                      contentStyle={{
                        fontSize: "12px",
                        padding: "8px 10px",
                        borderRadius: "8px",

                        // ✅ WHITE STYLE
                        backgroundColor: "#ffffff",
                        color: "#111827",

                        border: "1px solid #e5e7eb",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
                      }}
                      labelStyle={{
                        color: "#111827",
                        fontWeight: 600,
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: "12px",
                      }}
                    />
                    <defs>
                      <linearGradient
                        id="grossGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#2563eb"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="#2563eb"
                          stopOpacity={0}
                        />
                      </linearGradient>

                      <linearGradient
                        id="netGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#14b8a6"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="#14b8a6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <Area
                      type="monotone"
                      dataKey="gross"
                      stroke="#2563eb"
                      strokeWidth={2}
                      fill="url(#grossGradient)"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />

                    <Area
                      type="monotone"
                      dataKey="net"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      fill="url(#netGradient)"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* BAR CHART */}
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {chartMode === "WEEKLY" ? "Weekly Trips" : "Monthly Trips"}
                </CardTitle>
                <span className="text-xs text-muted-foreground">Volume</span>
              </CardHeader>

              <CardContent className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={groupedChartData}
                    margin={{ top: 20, left: 20, right: 20 }}
                  >
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip
                      formatter={(value: number) => [
                        "₱" +
                          new Intl.NumberFormat("en-PH", {
                            minimumFractionDigits: 0,
                          }).format(value),
                      ]}
                      contentStyle={{
                        fontSize: "12px",
                        padding: "8px 10px",
                        borderRadius: "8px",

                        // ✅ SAME STYLE
                        backgroundColor: "#ffffff",
                        color: "#111827",

                        border: "1px solid #e5e7eb",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
                      }}
                      labelStyle={{
                        color: "#111827",
                        fontWeight: 600,
                      }}
                    />
                    <Bar
                      dataKey="trips"
                      fill="#ff9319"
                      radius={6}
                      label={(props: any) => {
                        const { x, y, width, value } = props;

                        return (
                          <text
                            x={x + width / 2}
                            y={y - 6}
                            textAnchor="middle"
                            fontSize={12}
                            fill="#9ca3af"
                          >
                            {value}
                          </text>
                        );
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

        <TripTable
          rows={tripRows}
          totalsRows={tripRows}
          loading={loading}
          verificationFilter={verificationFilter}
          searchQuery={searchQuery}
          showActions
          selectable
          selectedIds={selectedTripIds}
          onSelectionChange={setSelectedTripIds}
          onTogglePaid={(id) => handleTogglePaid(id)}
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
