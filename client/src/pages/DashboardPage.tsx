import { useEffect, useState, useMemo } from "react";
import api from "../api/client";
import { useAppStore, type TripRow } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import FilterBar from "../components/shared/FilterBar";
import TripModal from "../components/shared/TripModal";
import TripTable from "../components/shared/TripTable";
import EmptyState from "../components/shared/EmptyState";
import ErrorState from "../components/shared/ErrorState";
import {
  PhilippinePeso,
  CheckCircle2,
  BarChart3,
  ArrowUpDown,
  Route,
  HandCoins,
  Clock3,
  Info,
  Search,
  CheckCheck,
  XCircle,
  Trash2,
  Columns3,
  TrendingUp,
  TrendingDown,
  Receipt,
  ListFilter,
  CircleCheck,
  CircleHelp,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
  Bar,
  BarChart,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import ExpenseBreakdownModal from "../components/shared/ExpenseBreakdownModal";
import { AnimatePresence, motion } from "framer-motion";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Sparkline from "../components/shared/Sparkline";

const grossNetChartConfig = {
  gross: {
    label: "Gross Income",
    color: "#f97316",
  },
  net: {
    label: "Net Income",
    color: "#14b8a6",
  },
} satisfies ChartConfig;

const tripsChartConfig = {
  trips: {
    label: "Trips",
    color: "#f97316",
  },
} satisfies ChartConfig;

const COLUMN_OPTIONS = [
  ["truck", "Truck"],
  ["week", "Week"],
  ["date", "Date"],
  ["status", "Status"],
  ["shipmentNumber", "Shipment #"],
  ["rate", "Rate"],
  ["vat", "VAT"],
  ["trips", "Trips"],
  ["grossIncome", "Gross"],
  ["netIncome", "Net"],
  ["payable", "Payable"],
] as const;

type ColumnKey = (typeof COLUMN_OPTIONS)[number][0];

type DashboardCollection = {
  _id: string;
  totalAmount: number;
  trips: {
    _id: string;
  }[];
};

export default function DashboardPage() {
  const {
    tripRows,
    expenseRows,
    kpis,
    previousKpis,
    chartData,
    loading,
    error,
    selectedTruck,
    truckOptions,
    truckRows,
    initApp,
    fetchDashboard,
    fetchExpenses,
    deleteTrip,
    toggleTripPaid,
    searchQuery,
    setSearchQuery,
    rangePreset,
    selectedTripIds,
    setSelectedTripIds,
    bulkTogglePaid,
    bulkDeleteTrips,
    quickEditTrip,
    deleteExpense,
  } = useAppStore();
  const { user } = useAuthStore();

  const canManageDashboard = user?.role === "admin" || user?.role === "manager";

  const [tripModal, setTripModal] = useState(false);
  const [editRow, setEditRow] = useState<TripRow | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<TripRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<TripRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [expenseBreakdown, setExpenseBreakdown] = useState<{
    truckId: string;
    dateIso: string;
    dateText: string;
  } | null>(null);
  const COLUMN_STORAGE_KEY = "dashboard-columns";
  const [verificationFilter, setVerificationFilter] = useState<
    "ALL" | "Verified" | "Pending" | "For Confirmation"
  >("ALL");
  const [dashboardCollections, setDashboardCollections] = useState<
    DashboardCollection[]
  >([]);
  const [collectionTrips, setCollectionTrips] = useState<TripRow[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  const defaultVisibleColumns: Record<ColumnKey, boolean> = {
    truck: true,
    week: false,
    date: true,
    status: false,
    shipmentNumber: true,
    rate: true,
    vat: true,
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

  useEffect(() => {
    const load = async () => {
      await initApp();

      const state = useAppStore.getState();

      await fetchExpenses(state.startDate, state.endDate);
      await fetchDashboard();
    };

    load();
  }, [initApp, fetchExpenses, fetchDashboard, selectedTruck]);

  useEffect(() => {
    let cancelled = false;

    const fetchCollectionStats = async () => {
      setCollectionsLoading(true);

      // Clear previous truck immediately.
      setCollectionTrips([]);
      setDashboardCollections([]);

      try {
        const params: { truck?: string } = {};

        if (selectedTruck) {
          params.truck = selectedTruck;
        }

        const [tripsResponse, collectionsResponse] = await Promise.all([
          api.get("/trips", { params }),
          api.get("/collections", { params }),
        ]);

        // Ignore stale response from previous truck.
        if (cancelled) return;

        setCollectionTrips(tripsResponse.data.rows || []);
        setDashboardCollections(collectionsResponse.data.rows || []);
      } catch (error) {
        if (cancelled) return;

        console.error("Failed to load collection stats:", error);

        setCollectionTrips([]);
        setDashboardCollections([]);
      } finally {
        if (!cancelled) {
          setCollectionsLoading(false);
        }
      }
    };

    fetchCollectionStats();

    return () => {
      cancelled = true;
    };
  }, [selectedTruck]);

  useEffect(() => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const selectedTruckName = truckOptions.find(
    (t) => t._id === selectedTruck,
  )?.truckName;

  const selectedTruckData = truckRows.find(
    (truck) => truck._id === selectedTruck,
  );

  const selectedTruckBillingType =
    selectedTruckData?.billingType ?? "subcontracted";

  const isDirectTruck = selectedTruckBillingType === "direct";

  const getChartMode = () => {
    if (rangePreset === "TM") return "WEEKLY";
    if (rangePreset === "YTD") return "MONTHLY"; // 🔥 FIX
    if (rangePreset === "ALL") return "MONTHLY"; // 🔥 FIX
    return "WEEKLY";
  };

  const showTruckColumn = !selectedTruck || selectedTruck === "ALL";

  const moneyFormat = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const collectionStats = useMemo(() => {
    const workingTrips = collectionTrips.filter(
      (trip) => trip.status === "Working Day",
    );

    const collectedTripIds = new Set(
      dashboardCollections.flatMap((collection) =>
        collection.trips.map((trip) => trip._id),
      ),
    );

    const receivableValue = (trip: TripRow) => {
      const rate = Number(trip.rate || 0);
      const vat = Number(trip.vat || 0);

      return isDirectTruck ? rate + vat : rate;
    };

    // Subcontracted = Rate
    // Direct = Rate + VAT
    const totalReceivables = workingTrips.reduce(
      (sum, trip) => sum + receivableValue(trip),
      0,
    );

    // Actual recorded collection amount
    const collected = dashboardCollections.reduce(
      (sum, collection) => sum + Number(collection.totalAmount || 0),
      0,
    );

    // Same basis as Total Receivables
    const outstanding = workingTrips
      .filter((trip) => !collectedTripIds.has(trip._id))
      .reduce((sum, trip) => sum + receivableValue(trip), 0);

    return {
      totalReceivables,
      collected,
      outstanding,
    };
  }, [collectionTrips, dashboardCollections, isDirectTruck]);

  const handleDuplicate = (row: TripRow) => {
    setEditRow(null);
    setDuplicateFrom(row);
    setTripModal(true);
  };

  const handleTogglePaid = async (id: string) => {
    try {
      await toggleTripPaid(id);
    } catch (err) {
      console.error("Toggle failed", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;

    const trip = deleteModal;

    setDeleting(true);

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
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);

    try {
      await bulkDeleteTrips(selectedTripIds);
      setBulkDeleteModal(false);
    } catch (err) {
      console.error("Bulk delete failed", err);
    } finally {
      setBulkDeleting(false);
    }
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

      <div className="sticky top-16 z-30 bg-background">
        <FilterBar
          showTruck={false}
          allowedRangePresets={
            canManageDashboard ? undefined : (["CC", "LC"] as const)
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_2.45fr_0.85fr]">
        {/* LEFT: FINANCIAL SUMMARY */}
        <div className="grid h-[600px] grid-rows-5 gap-3">
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
              invert: true,
            },
            {
              label: "Crew Payments",
              value: kpis.cashOutflow,
              prev: previousKpis.cashOutflow,
              icon: ArrowUpDown,
              invert: true,
            },
          ].map((item) => {
            const isCutoff = rangePreset === "CC" || rangePreset === "LC";

            const sparkSource = isCutoff
              ? [
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
                ]
              : groupedChartData;

            const diff = item.value - item.prev;

            const percent =
              item.prev === 0 ? 100 : item.prev ? (diff / item.prev) * 100 : 0;

            const isUp = diff >= 0;
            const sign = diff === 0 ? "" : diff > 0 ? "+" : "-";
            const isGood = item.invert ? diff <= 0 : diff >= 0;

            const Icon = item.icon;

            const sparkData = sparkSource.map((d: any) => {
              switch (item.label) {
                case "Gross Income":
                  return d.gross;
                case "Net Income":
                  return d.net;
                case "Expenses":
                  return d.expenses;
                case "Payable":
                  return d.payable;
                case "Crew Payments":
                  return d.cashOutflow;
                default:
                  return 0;
              }
            });

            const sparkLabels = sparkSource.map((d: any) => d.label);

            return (
              <Card key={item.label} size="sm">
                <CardHeader className="grid grid-cols-[1fr_auto] items-start">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>

                    <CardTitle>{item.label}</CardTitle>
                  </div>

                  <CardAction>
                    <span className="text-sm font-semibold tracking-tight tabular-nums">
                      ₱{moneyFormat.format(item.value)}
                    </span>
                  </CardAction>
                </CardHeader>

                <CardContent>
                  <div className="-translate-y-2 grid grid-cols-[1fr_100px] items-end gap-3">
                    <div className="min-w-0">
                      {item.prev !== undefined && (
                        <div
                          className={cn(
                            "flex items-center gap-1 text-[11px] font-medium tabular-nums",
                            isGood
                              ? "text-green-600 dark:text-green-400"
                              : "text-destructive",
                          )}
                        >
                          {diff === 0 ? (
                            <span className="size-1.5 rounded-full bg-current opacity-60" />
                          ) : isUp ? (
                            <TrendingUp className="size-3" />
                          ) : (
                            <TrendingDown className="size-3" />
                          )}

                          {item.label === "Payable" ? (
                            <span>
                              {sign}₱{moneyFormat.format(Math.abs(diff))}
                            </span>
                          ) : (
                            <>
                              <span>
                                {sign}
                                {Math.abs(percent).toFixed(1)}%
                              </span>

                              <span className="text-muted-foreground">
                                ({sign}₱{moneyFormat.format(Math.abs(diff))})
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      <p className="mt-1 text-xs text-muted-foreground">
                        vs last period
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <Sparkline
                        data={sparkData}
                        labels={sparkLabels}
                        invert={item.invert}
                        current={item.value}
                        previous={item.prev}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* CENTER: CHARTS */}
        <div className="grid h-[600px] grid-rows-2 gap-3">
          {/* AREA CHART */}
          <Card size="sm" className="min-h-0 min-w-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {chartMode === "WEEKLY"
                  ? "Weekly Gross vs Net Income"
                  : "Monthly Gross vs Net Income"}
              </CardTitle>
              <span className="text-xs text-muted-foreground">Trend</span>
            </CardHeader>

            <CardContent className="min-h-0">
              <ChartContainer
                config={grossNetChartConfig}
                initialDimension={{ width: 600, height: 220 }}
                className="h-full min-h-[220px] w-full min-w-0"
              >
                <AreaChart
                  key={JSON.stringify(groupedChartData)} // ✅ FORCE RE-ANIMATE
                  data={groupedChartData}
                  margin={{ left: 20, top: 20, right: 20 }}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                  <XAxis dataKey="label" fontSize={12} fontWeight={500} />
                  <YAxis
                    fontSize={12}
                    fontWeight={500}
                    tickFormatter={(value) =>
                      Number(value).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    }
                  />

                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="line"
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.label || ""
                        }
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
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
                        stopColor="var(--color-gross)"
                        stopOpacity={0.25}
                      />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
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
                        stopColor="var(--color-net)"
                        stopOpacity={0.25}
                      />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <Area
                    type="monotone"
                    dataKey="gross"
                    stroke="var(--color-gross)"
                    strokeWidth={2}
                    fill="url(#grossGradient)"
                    isAnimationActive
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                  />

                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="var(--color-net)"
                    strokeWidth={2}
                    fill="url(#netGradient)"
                    isAnimationActive
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* BAR CHART */}
          <Card size="sm" className="min-h-0 min-w-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {chartMode === "WEEKLY" ? "Weekly Trips" : "Monthly Trips"}
              </CardTitle>
              <span className="text-xs text-muted-foreground">Volume</span>
            </CardHeader>

            <CardContent className="min-h-0">
              <ChartContainer
                config={tripsChartConfig}
                initialDimension={{ width: 600, height: 220 }}
                className="h-full min-h-[220px] w-full min-w-0"
              >
                <BarChart
                  key={JSON.stringify(groupedChartData)} // ✅ FORCE RE-ANIMATE
                  data={groupedChartData}
                  margin={{ top: 20, left: 20, right: 20 }}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                  <XAxis dataKey="label" fontSize={12} fontWeight={500} />
                  <YAxis fontSize={12} fontWeight={500} />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideIndicator
                        formatter={(value) => (
                          <div className="flex min-w-[90px] items-center justify-between gap-4">
                            <span className="text-muted-foreground">Trips</span>

                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {Number(value).toLocaleString("en-PH")}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="trips"
                    fill="var(--color-trips)"
                    radius={6}
                    // ✅ ANIMATION
                    isAnimationActive
                    animationDuration={700}
                    animationEasing="ease-in-out"
                    animationBegin={100}
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
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
        {/* RIGHT: COLLECTION KPIS */}
        <div className="grid h-[600px] grid-rows-3 gap-3">
          {[
            {
              label: "Total Receivables",
              value: collectionStats.totalReceivables,
              icon: HandCoins,
              tooltip:
                "Total value of all working trips. Direct trucks include VAT; subcontracted trucks use Rate only.",
            },
            {
              label: "Collected",
              value: collectionStats.collected,
              icon: PhilippinePeso,
              tooltip:
                "Actual amount received from recorded collections, including the selected Rate/VAT billing and any Add or Less adjustments.",
            },
            {
              label: "Uncollected",
              value: collectionStats.outstanding,
              icon: Clock3,
              tooltip:
                "Value of working trips not yet included in a collection. Direct trucks include VAT; subcontracted trucks use Rate only.",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} size="sm">
                <CardHeader className="grid grid-cols-[1fr_auto] items-start">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CardTitle>{item.label}</CardTitle>

                      <UiTooltip>
                        <TooltipTrigger asChild>
                          <Info className="size-3.5 cursor-help text-muted-foreground" />
                        </TooltipTrigger>

                        <TooltipContent className="max-w-[260px]">
                          {item.tooltip}
                        </TooltipContent>
                      </UiTooltip>
                    </div>
                  </div>

                  <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">
                    {collectionsLoading
                      ? "—"
                      : `₱${moneyFormat.format(item.value)}`}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card size="sm" className="mt-4 !gap-0">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Trip Records</CardTitle>
              <CardDescription>
                View trip records from selected date range.
              </CardDescription>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
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
                      setVisibleColumns((prev) => ({
                        ...prev,
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
        </CardHeader>

        <CardContent className="border-b py-4">
          <div className="flex flex-wrap items-end gap-2">
            {/* SEARCH */}
            <div className="min-w-[220px] flex-1">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Search
              </label>

              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>

                <InputGroupInput
                  placeholder="Search shipment number..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </InputGroup>
            </div>

            {/* VERIFICATION */}
            <div className="w-[180px] shrink-0">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Shipment Verification
              </label>

              <Select
                value={verificationFilter}
                onValueChange={(value) =>
                  setVerificationFilter(
                    value as
                      | "ALL"
                      | "Verified"
                      | "Pending"
                      | "For Confirmation",
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ALL">
                    <ListFilter className="size-4 text-foreground" />
                    All
                  </SelectItem>

                  <SelectItem value="Verified">
                    <CircleCheck className="size-4 text-foreground" />
                    Verified
                  </SelectItem>

                  <SelectItem value="Pending">
                    <Clock3 className="size-4 text-foreground" />
                    Pending
                  </SelectItem>

                  <SelectItem value="For Confirmation">
                    <CircleHelp className="size-4 text-foreground" />
                    For Confirmation
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>

        <TripTable
          rows={tripRows}
          expenseRows={expenseRows}
          expandableDetails
          totalsRows={tripRows}
          searchQuery={searchQuery}
          loading={loading}
          verificationFilter={verificationFilter}
          showActions
          selectable={canManageDashboard}
          selectedIds={canManageDashboard ? selectedTripIds : []}
          onSelectionChange={
            canManageDashboard ? setSelectedTripIds : undefined
          }
          onTogglePaid={canManageDashboard ? handleTogglePaid : undefined}
          onEdit={(r) => {
            setEditRow(r);
            setDuplicateFrom(null);
            setTripModal(true);
          }}
          onDelete={(r) => setDeleteModal(r)}
          onDuplicate={canManageDashboard ? handleDuplicate : undefined}
          onExpenseClick={(data) => setExpenseBreakdown(data)}
          canEditRow={canManageDashboard ? undefined : (r) => !r.paid}
          canDeleteRow={canManageDashboard ? undefined : (r) => !r.paid}
          selectedTruck={selectedTruck}
          showTruckColumn={showTruckColumn}
          visibleColumns={visibleColumns}
          onQuickEdit={canManageDashboard ? quickEditTrip : undefined}
          onVerificationChange={
            canManageDashboard
              ? async (id, status) => {
                  await quickEditTrip(id, "verificationStatus", status);
                }
              : undefined
          }
          emptyState={
            <EmptyState
              icon={Route}
              title="No Trips Found!"
              description={
                selectedTruck
                  ? `No trips recorded for ${selectedTruckName} on the selected date range.`
                  : "Select a truck to view trip records."
              }
            />
          }
        />
      </Card>

      <AnimatePresence>
        {selectedTripIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2"
          >
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row">
              <span className="whitespace-nowrap text-sm font-medium text-foreground">
                {selectedTripIds.length} trip
                {selectedTripIds.length !== 1 ? "s" : ""} selected
              </span>

              <div className="hidden h-6 w-px bg-border sm:block" />

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkTogglePaid(selectedTripIds, true)}
                  className="border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 dark:text-green-400"
                >
                  <CheckCheck className="size-4" data-icon="inline-start" />
                  Settled
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkTogglePaid(selectedTripIds, false)}
                  className="border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 dark:text-amber-400"
                >
                  <XCircle className="size-4" data-icon="inline-start" />
                  Unsettled
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDeleteModal(true)}
                  className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="size-4" data-icon="inline-start" />
                  Delete
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTripIds([])}
                >
                  Clear
                </Button>
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

      <>
        {/* DELETE SINGLE */}
        <Dialog open={!!deleteModal} onOpenChange={() => setDeleteModal(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>
                Delete Trip for -{" "}
                {deleteModal?.truckName ||
                  selectedTruckName ||
                  "Selected Truck"}
              </DialogTitle>

              <DialogDescription>
                Are you sure you want to delete this trip?
              </DialogDescription>
            </DialogHeader>

            <p className="text-sm font-medium">
              {deleteModal?.dateText} / {deleteModal?.shipmentNumber}
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteModal(null)}>
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 />
                {deleting ? "Deleting..." : "Delete Trip"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* BULK DELETE */}
        <Dialog open={bulkDeleteModal} onOpenChange={setBulkDeleteModal}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete selected trips?</DialogTitle>

              <DialogDescription>
                Are you sure you want to delete{" "}
                <strong>{selectedTripIds.length}</strong> selected trip
                {selectedTripIds.length !== 1 ? "s" : ""}?
              </DialogDescription>
            </DialogHeader>

            <p className="text-sm text-muted-foreground">
              This action cannot be undone.
            </p>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setBulkDeleteModal(false)}
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                <Trash2 />
                {bulkDeleting
                  ? "Deleting..."
                  : `Delete ${selectedTripIds.length} Trip${
                      selectedTripIds.length !== 1 ? "s" : ""
                    }`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ExpenseBreakdownModal
          open={!!expenseBreakdown}
          onClose={() => setExpenseBreakdown(null)}
          truckId={expenseBreakdown?.truckId || ""}
          dateIso={expenseBreakdown?.dateIso || ""}
          dateText={expenseBreakdown?.dateText || ""}
        />
      </>
    </div>
  );
}
