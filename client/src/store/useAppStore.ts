import { create } from "zustand";
import { toast } from "sonner";
import axios from "axios";
import api from "../api/client";
import { type RangePreset, getDateRangeForPreset } from "../lib/dateHelpers";

/** Extract a user-friendly error message from an unknown caught value. */
function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function getTruckId(
  truck: string | { _id: string; truckName: string } | null | undefined,
): string {
  if (!truck) return "";
  return typeof truck === "string" ? truck : truck._id;
}

function applyReimbursedParkingAdjustments(
  trips: TripRow[],
  expenses: ExpenseRow[],
): TripRow[] {
  const reimbursedByKey = new Map<string, number>();

  for (const expense of expenses) {
    if (!expense.reimbursed) continue;
    if (
      !REIMBURSABLE_CATEGORIES.has(
        (expense.category || "").trim().toUpperCase(),
      )
    )
      continue;

    const key = `${getTruckId(expense.truck)}|${expense.dateIso}`;
    reimbursedByKey.set(
      key,
      (reimbursedByKey.get(key) || 0) + Number(expense.amount || 0),
    );
  }

  if (reimbursedByKey.size === 0) return trips;

  return trips.map((trip) => {
    const key = `${getTruckId(trip.truck)}|${trip.dateIso}`;
    const reimbursement = reimbursedByKey.get(key) || 0;
    if (!reimbursement) return trip;

    return {
      ...trip,
      // netIncome is left unchanged here to avoid double counting.
      reportNetIncome:
        trip.reportNetIncome !== undefined
          ? trip.reportNetIncome + reimbursement
          : trip.reportNetIncome,
    };
  });
}

function sumKpisFromTrips(
  rows: TripRow[],
): Pick<KPIs, "gross" | "net" | "trips"> {
  return rows.reduce(
    (acc, row) => ({
      gross: acc.gross + Number(row.grossIncome || 0),
      net: acc.net + Number(row.netIncome || 0),
      trips: acc.trips + Number(row.trips || 0),
    }),
    { gross: 0, net: 0, trips: 0 },
  );
}

export interface TruckOption {
  _id: string;
  truckName: string;
  cutoffType: "weekly" | "monthly";
  cutoffStart: number;
  cutoffEnd: number;
  payday: number;
  dayOff: number;
}

export interface TripRow {
  _id: string;
  truck: string | { _id: string; truckName: string };
  truckName: string;
  createdBy?: string | null;
  date: string;
  dateIso: string;
  dateText: string;
  week: string;
  status: string;
  shipmentNumber: string;
  rate: number;
  trips: number;
  crewSalary: number;
  cashAdvance: number;
  reimbursements: number;
  expenses: number;
  note: string;
  expenseBreakdown?: string;
  hasExpenses?: boolean;
  grossIncome: number;
  netIncome: number;
  payable: number;
  paid: boolean;
  reportPayable?: number;
  reportNetIncome?: number;
}

export interface ExpenseRow {
  _id: string;
  truck: string | { _id: string; truckName: string };
  truckName: string;
  date: string;
  dateIso: string;
  dateText: string;
  category: string;
  amount: number;
  description: string;
  reimbursed: boolean;
}

export interface TruckRow {
  _id: string;
  truckName: string;
  status: string;
  cutoffType: "weekly" | "monthly";
  client?: string;
  lastChangeOil?: number | null;
  notes?: string;
  cutoffStart: number;
  cutoffEnd: number;
  payday: number;
  dayOff: number;
  cutoffStartText: string;
  cutoffEndText: string;
  paydayText: string;
  dayOffText: string;
  dateAdded: string;
}

export interface KPIs {
  gross: number;
  net: number;
  trips: number;
  payable: number;
  cashOutflow: number;
  expenses: number;
}

export interface ChartPoint {
  label: string;
  gross: number;
  net: number;
  trips: number;
}

interface AppState {
  // UI
  sidebarCollapsed: boolean;
  theme: "light" | "dark";
  loading: boolean;
  initialized: boolean;
  error: string | null;

  // Data
  truckOptions: TruckOption[];
  tripRows: TripRow[];
  rawTripRows: TripRow[];
  expenseRows: ExpenseRow[];
  truckRows: TruckRow[];
  rawReportRows: TripRow[];
  kpis: KPIs;
  previousKpis: KPIs;
  chartData: ChartPoint[];
  reportRows: TripRow[];
  truckStats: {
    total: number;
    active: number;
    inactive: number;
    sheets: number;
  };

  // Bulk selection
  selectedTripIds: string[];

  // Expense categories
  expenseCategories: string[];

  // Filters
  selectedTruck: string;
  rangePreset: RangePreset;
  startDate: string;
  endDate: string;
  expensesMonth: string;
  reportsMonth: string;
  searchQuery: string;

  // Actions
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
  setError: (error: string | null) => void;
  setSelectedTruck: (id: string) => void;
  setRangePreset: (preset: RangePreset) => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setExpensesMonth: (month: string) => void;
  setReportsMonth: (month: string) => void;
  setSearchQuery: (q: string) => void;

  // Bulk actions
  setSelectedTripIds: (ids: string[]) => void;
  bulkTogglePaid: (ids: string[], paid: boolean) => Promise<void>;
  bulkDeleteTrips: (ids: string[]) => Promise<void>;

  // Expense categories
  fetchExpenseCategories: () => Promise<void>;

  // Data fetching
  initApp: () => Promise<void>;
  fetchDashboard: () => Promise<void>;
  fetchExpenses: () => Promise<void>;
  fetchTrucks: () => Promise<void>;
  fetchReports: () => Promise<void>;
  recomputeParkingReimbursements: () => void;

  // Duplicate / last trip
  getLastTrip: (truckId: string) => Promise<TripRow | null>;

  // CRUD
  quickEditTrip: (
    id: string,
    field: string,
    value: number | string,
  ) => Promise<void>;
  addTrip: (data: Record<string, unknown>) => Promise<void>;
  updateTrip: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  toggleTripPaid: (id: string) => Promise<void>;
  addExpense: (data: Record<string, unknown>) => Promise<void>;
  updateExpense: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  toggleExpenseReimbursed: (id: string) => Promise<void>;
  addTruck: (data: Record<string, unknown>) => Promise<void>;
  updateTruck: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteTruck: (id: string) => Promise<void>;
}

const getStoredTheme = (): "light" | "dark" => {
  try {
    const saved = localStorage.getItem("nm_theme");
    if (saved === "dark" || saved === "light") return saved;
    return "light";
  } catch {
    return "light";
  }
};

const REIMBURSABLE_CATEGORIES = new Set(["FUEL", "TOLL", "PARKING"]);

export const useAppStore = create<AppState>((set, get) => ({
  // UI
  sidebarCollapsed: localStorage.getItem("nm_sidebar") === "1",
  theme: getStoredTheme(),
  loading: false,
  initialized: false,
  error: null,

  // Data
  truckOptions: [],
  tripRows: [],
  rawTripRows: [],
  expenseRows: [],
  truckRows: [],
  rawReportRows: [],
  kpis: { gross: 0, net: 0, trips: 0, payable: 0, cashOutflow: 0, expenses: 0 },
  previousKpis: {
    gross: 0,
    net: 0,
    trips: 0,
    payable: 0,
    cashOutflow: 0,
    expenses: 0,
  },
  chartData: [],
  reportRows: [],
  truckStats: { total: 0, active: 0, inactive: 0, sheets: 0 },

  // Bulk selection
  selectedTripIds: [],

  // Expense categories
  expenseCategories: [],

  // Filters
  selectedTruck: "",
  rangePreset: "CC",
  startDate: "",
  endDate: "",
  expensesMonth: "ALL",
  reportsMonth: "ALL",
  searchQuery: "",

  // Actions
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    localStorage.setItem("nm_sidebar", next ? "1" : "0");
    set({ sidebarCollapsed: next });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    localStorage.setItem("nm_theme", next);
    set({ theme: next });
  },
  setTheme: (theme) => {
    localStorage.setItem("nm_theme", theme);
    set({ theme });
  },
  setError: (error) => set({ error }),
  setSelectedTruck: (id) => set({ selectedTruck: id }),
  setRangePreset: (preset) => set({ rangePreset: preset }),
  setStartDate: (date) => set({ startDate: date }),
  setEndDate: (date) => set({ endDate: date }),
  setExpensesMonth: (month) => set({ expensesMonth: month }),
  setReportsMonth: (month) => set({ reportsMonth: month }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  // Bulk actions
  setSelectedTripIds: (ids) => set({ selectedTripIds: ids }),
  bulkTogglePaid: async (ids, paid) => {
    const state = get();
    const originalRows = state.tripRows;

    // Optimistic update
    set({
      tripRows: state.tripRows.map((t) =>
        ids.includes(t._id)
          ? {
              ...t,
              paid,
              payable: paid
                ? 0
                : t.crewSalary - t.cashAdvance + t.reimbursements,
            }
          : t,
      ),
      selectedTripIds: [],
    });

    try {
      await api.patch("/trips/bulk-paid", { ids, paid });
      await get().fetchDashboard();
      toast.success(
        `${ids.length} trip(s) marked as ${paid ? "paid" : "unpaid"}`,
        { duration: 4000 },
      );
    } catch (err: unknown) {
      set({ tripRows: originalRows, selectedTripIds: ids });
      toast.error(getErrorMessage(err, "Failed to update paid status"));
    }
  },
  bulkDeleteTrips: async (ids) => {
    const state = get();
    const originalRows = state.tripRows;

    // Optimistic removal
    set({
      tripRows: state.tripRows.filter((t) => !ids.includes(t._id)),
      selectedTripIds: [],
    });

    try {
      await api.delete("/trips/bulk-delete", { data: { ids } });
      await get().fetchDashboard();
      toast.success(`${ids.length} trip(s) deleted`, { duration: 4000 });
    } catch (err: unknown) {
      set({ tripRows: originalRows, selectedTripIds: ids });
      toast.error(getErrorMessage(err, "Failed to delete trips"));
    }
  },

  // Expense categories
  fetchExpenseCategories: async () => {
    try {
      const state = get();
      const params: Record<string, string> = {};
      if (state.selectedTruck) params.truck = state.selectedTruck;
      const { data } = await api.get("/expenses/categories", { params });
      set({ expenseCategories: data.categories || [] });
    } catch (err) {
      console.error("Failed to fetch expense categories:", err);
    }
  },

  // Duplicate / last trip
  getLastTrip: async (truckId) => {
    try {
      const { data } = await api.get(`/trips/last?truck=${truckId}`);
      return data.trip || null;
    } catch (err) {
      console.error("Failed to fetch last trip:", err);
      return null;
    }
  },

  // Initialize: fetch trucks first, then dashboard
  initApp: async () => {
    if (get().initialized) return;
    set({ error: null });
    try {
      // Fetch trucks first to get options
      const trucksRes = await api.get("/trucks");
      const truckRows = trucksRes.data.rows || [];
      const activeTrucks = truckRows.filter(
        (t: TruckRow) => t.status === "Active",
      );

      set({
        truckRows,
        truckStats: {
          total: trucksRes.data.total || 0,
          active: trucksRes.data.active || 0,
          inactive: trucksRes.data.inactive || 0,
          sheets: trucksRes.data.sheets || 0,
        },
      });

      // Build truck options for dashboard from the trucks list
      const truckOptions: TruckOption[] = activeTrucks.map((t: TruckRow) => ({
        _id: t._id,
        truckName: t.truckName,
        cutoffType: t.cutoffType,
        cutoffStart: t.cutoffStart,
        cutoffEnd: t.cutoffEnd,
        payday: t.payday,
        dayOff: t.dayOff,
      }));
      set({ truckOptions });

      // Check if user is admin (from auth store in localStorage)
      const storedUser = localStorage.getItem("nm_user");
      const isAdmin = storedUser
        ? JSON.parse(storedUser).role === "admin"
        : true;

      // For employees with assigned truck, force-select it and show all trips
      if (!isAdmin && storedUser) {
        const userObj = JSON.parse(storedUser);
        const assignedTruck =
          typeof userObj.truck === "object" && userObj.truck
            ? userObj.truck._id
            : userObj.truck;
        if (
          assignedTruck &&
          truckOptions.find((t) => t._id === assignedTruck)
        ) {
          set({
            selectedTruck: assignedTruck,
            rangePreset: "CC" as RangePreset,
            startDate: "",
            endDate: "",
          });
        }
      } else if (!get().selectedTruck && truckOptions.length > 0) {
        // Admin: auto-select first truck if none selected
        set({ selectedTruck: truckOptions[0]._id });
      }

      set({ initialized: true, error: null });

      // Now fetch dashboard data
      await get().fetchDashboard();
      await get().fetchExpenses();
    } catch (err: unknown) {
      console.error("Failed to init app:", err);
      const msg = getErrorMessage(err, "Failed to initialize app");
      set({ initialized: true, error: msg });
      toast.error(msg);
    }
  },

  // Data fetching
  fetchDashboard: async () => {
    const state = get();
    set({ loading: true, error: null });
    try {
      const truckConfig = state.truckOptions.find(
        (t) => t._id === state.selectedTruck,
      );
      const range = getDateRangeForPreset(
        state.rangePreset,
        truckConfig?.cutoffType ?? "weekly",
        truckConfig?.cutoffStart ?? 1,
        truckConfig?.cutoffEnd ?? 6,
        state.startDate,
        state.endDate,
      );

      const params: Record<string, string> = {};
      if (state.selectedTruck) params.truck = state.selectedTruck;
      if (range.start) params.start = range.start;
      if (range.end) params.end = range.end;

      params.rangePreset = state.rangePreset;

      const { data } = await api.get("/dashboard", { params });

      // Update truck options from response if available
      const newTruckOptions =
        data.truckOptions && data.truckOptions.length > 0
          ? data.truckOptions
          : state.truckOptions;

      const rawTripRows = data.rows || [];
      const adjustedTripRows = applyReimbursedParkingAdjustments(
        rawTripRows,
        state.expenseRows,
      );

      set({
        rawTripRows,
        tripRows: adjustedTripRows,
        kpis: data.kpis || {
          gross: 0,
          net: 0,
          trips: 0,
          payable: 0,
          cashOutflow: 0,
          expenses: 0,
        },
        previousKpis: data.previousKpis || {
          gross: 0,
          net: 0,
          trips: 0,
          payable: 0,
          cashOutflow: 0,
          expenses: 0,
        },
        chartData: data.chartData || [],
        truckOptions: newTruckOptions,
        startDate: range.start,
        endDate: range.end,
        error: null,
      });
    } catch (err: unknown) {
      console.error("Failed to fetch dashboard:", err);
      const msg = getErrorMessage(err, "Failed to load dashboard data");
      set({ error: msg });
      toast.error(msg);
    } finally {
      set({ loading: false });
    }
  },

  fetchExpenses: async () => {
    const state = get();
    try {
      const params: Record<string, string> = {};
      if (state.selectedTruck) params.truck = state.selectedTruck;
      if (state.expensesMonth !== "ALL") params.month = state.expensesMonth;

      const { data } = await api.get("/expenses", { params });
      set({ expenseRows: data.rows || [] });
      get().recomputeParkingReimbursements();
    } catch (err: unknown) {
      console.error("Failed to fetch expenses:", err);
      toast.error(getErrorMessage(err, "Failed to load expenses"));
    }
  },

  fetchTrucks: async () => {
    try {
      const { data } = await api.get("/trucks");
      const truckRows = data.rows || [];
      const activeTrucks = truckRows.filter(
        (t: TruckRow) => t.status === "Active",
      );

      set({
        truckRows,
        truckStats: {
          total: data.total || 0,
          active: data.active || 0,
          inactive: data.inactive || 0,
          sheets: data.sheets || 0,
        },
        truckOptions: activeTrucks.map((t: TruckRow) => ({
          _id: t._id,
          truckName: t.truckName,
          cutoffType: t.cutoffType,
          cutoffStart: t.cutoffStart,
          cutoffEnd: t.cutoffEnd,
          payday: t.payday,
          dayOff: t.dayOff,
        })),
      });
    } catch (err: unknown) {
      console.error("Failed to fetch trucks:", err);
      toast.error(getErrorMessage(err, "Failed to load trucks"));
    }
  },

  fetchReports: async () => {
    const state = get();
    try {
      const params: Record<string, string> = {};
      if (state.selectedTruck) params.truck = state.selectedTruck;
      if (state.reportsMonth !== "ALL") params.month = state.reportsMonth;

      const { data } = await api.get("/dashboard/reports", { params });
      const rawReportRows = data.rows || [];
      set({
        rawReportRows,
        reportRows: applyReimbursedParkingAdjustments(
          rawReportRows,
          state.expenseRows,
        ),
      });
    } catch (err: unknown) {
      console.error("Failed to fetch reports:", err);
      toast.error(getErrorMessage(err, "Failed to load reports"));
    }
  },

  recomputeParkingReimbursements: () => {
    const state = get();
    const adjustedTripRows = applyReimbursedParkingAdjustments(
      state.rawTripRows.length ? state.rawTripRows : state.tripRows,
      state.expenseRows,
    );
    const adjustedReportRows = applyReimbursedParkingAdjustments(
      state.rawReportRows.length ? state.rawReportRows : state.reportRows,
      state.expenseRows,
    );
    const tripTotals = sumKpisFromTrips(adjustedTripRows);

    set({
      tripRows: adjustedTripRows,
      reportRows: adjustedReportRows,
      kpis: {
        ...state.kpis,
        gross: tripTotals.gross,
        net: tripTotals.net,
        trips: tripTotals.trips,
      },
    });
  },

  // Quick Edit
  quickEditTrip: async (id, field, value) => {
    try {
      await api.patch(`/trips/${id}/quick-edit`, { field, value });
      await get().fetchDashboard();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update field"));
      throw err;
    }
  },

  // CRUD - Trips
  addTrip: async (tripData) => {
    try {
      await api.post("/trips", tripData);
      toast.success("Trip created successfully", { duration: 4000 });
      await get().fetchDashboard();
      await get().fetchExpenses();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to create trip"));
      throw err;
    }
  },
  updateTrip: async (id, tripData) => {
    try {
      await api.put(`/trips/${id}`, tripData);
      toast.success("Trip updated successfully", { duration: 4000 });
      await get().fetchDashboard();
      await get().fetchExpenses();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update trip"));
      throw err;
    }
  },
  deleteTrip: async (id) => {
    const state = get();
    const originalRows = state.tripRows;

    // Optimistic removal
    set({ tripRows: state.tripRows.filter((t) => t._id !== id) });

    try {
      await api.delete(`/trips/${id}`);
      await get().fetchDashboard();
      toast.success("Trip deleted", { duration: 4000 });
    } catch (err: unknown) {
      // Revert on error
      set({ tripRows: originalRows });
      toast.error(getErrorMessage(err, "Failed to delete trip"));
    }
  },
  toggleTripPaid: async (id) => {
    const state = get();
    const trip = state.tripRows.find((t) => t._id === id);
    if (!trip) return;

    const wasPaid = trip.paid;
    const originalPayable = trip.payable;
    const totalPayable =
      trip.crewSalary - trip.cashAdvance + trip.reimbursements;

    // Optimistic update
    set({
      tripRows: state.tripRows.map((t) =>
        t._id === id
          ? { ...t, paid: !wasPaid, payable: wasPaid ? totalPayable : 0 }
          : t,
      ),
    });

    try {
      await api.patch(`/trips/${id}/toggle-paid`);
      await get().fetchDashboard();

      toast.success(wasPaid ? "Marked as unpaid" : "Marked as paid", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            await api.patch(`/trips/${id}/toggle-paid`);
            await get().fetchDashboard();
            toast.success("Undone", { duration: 2000 });
          },
        },
      });
    } catch (err: unknown) {
      // Revert on error
      set({
        tripRows: get().tripRows.map((t) =>
          t._id === id ? { ...t, paid: wasPaid, payable: originalPayable } : t,
        ),
      });
      toast.error(getErrorMessage(err, "Failed to update paid status"));
    }
  },

  // CRUD - Expenses
  addExpense: async (expenseData) => {
    try {
      await api.post("/expenses", expenseData);
      toast.success("Expense saved successfully", { duration: 4000 });
      await get().fetchExpenses();
      await get().fetchDashboard();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save expense"));
      throw err;
    }
  },
  updateExpense: async (id, expenseData) => {
    try {
      await api.put(`/expenses/${id}`, expenseData);
      toast.success("Expense updated successfully", { duration: 4000 });
      await get().fetchExpenses();
      await get().fetchDashboard();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update expense"));
      throw err;
    }
  },
  deleteExpense: async (id) => {
    const state = get();
    const originalRows = state.expenseRows;

    // Optimistic removal
    set({ expenseRows: state.expenseRows.filter((e) => e._id !== id) });

    try {
      await api.delete(`/expenses/${id}`);
      await get().fetchExpenses();
      await get().fetchDashboard();
      toast.success("Expense deleted", { duration: 4000 });
    } catch (err: unknown) {
      // Revert on error
      set({ expenseRows: originalRows });
      toast.error(getErrorMessage(err, "Failed to delete expense"));
    }
  },

  // Toggle expense reimbursed
  toggleExpenseReimbursed: async (id) => {
    const state = get();
    const originalRows = state.expenseRows;

    // Optimistic toggle
    set({
      expenseRows: state.expenseRows.map((e) =>
        e._id === id ? { ...e, reimbursed: !e.reimbursed } : e,
      ),
    });
    get().recomputeParkingReimbursements();

    try {
      await api.patch(`/expenses/${id}/toggle-reimbursed`);
      await get().fetchExpenses();
      await get().fetchDashboard();
      get().recomputeParkingReimbursements();
      const expense = originalRows.find((e) => e._id === id);
      toast.success(
        expense?.reimbursed
          ? "Marked as not reimbursed"
          : "Marked as reimbursed",
        { duration: 3000 },
      );
    } catch (err: unknown) {
      set({ expenseRows: originalRows });
      get().recomputeParkingReimbursements();
      toast.error(getErrorMessage(err, "Failed to toggle reimbursed"));
    }
  },

  // CRUD - Trucks
  addTruck: async (truckData) => {
    try {
      await api.post("/trucks", truckData);
      toast.success("Truck saved successfully", { duration: 4000 });
      await get().fetchTrucks();
      await get().fetchDashboard();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save truck"));
      throw err;
    }
  },
  updateTruck: async (id, truckData) => {
    try {
      await api.put(`/trucks/${id}`, truckData);
      toast.success("Truck updated successfully", { duration: 4000 });
      await get().fetchTrucks();
      await get().fetchDashboard();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update truck"));
      throw err;
    }
  },
  deleteTruck: async (id) => {
    const state = get();
    const originalTruckRows = state.truckRows;
    const originalTruckOptions = state.truckOptions;
    const originalSelectedTruck = state.selectedTruck;

    // Optimistic removal
    const newTruckRows = state.truckRows.filter((t) => t._id !== id);
    const newTruckOptions = state.truckOptions.filter((t) => t._id !== id);
    const newSelectedTruck =
      state.selectedTruck === id
        ? newTruckOptions.length > 0
          ? newTruckOptions[0]._id
          : ""
        : state.selectedTruck;

    set({
      truckRows: newTruckRows,
      truckOptions: newTruckOptions,
      selectedTruck: newSelectedTruck,
    });

    try {
      await api.delete(`/trucks/${id}`);
      await get().fetchTrucks();
      await get().fetchDashboard();
      toast.success("Truck deleted", { duration: 4000 });
    } catch (err: unknown) {
      // Revert on error
      set({
        truckRows: originalTruckRows,
        truckOptions: originalTruckOptions,
        selectedTruck: originalSelectedTruck,
      });
      toast.error(getErrorMessage(err, "Failed to delete truck"));
    }
  },
}));
