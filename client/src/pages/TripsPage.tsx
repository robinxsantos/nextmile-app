import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore, type TripRow } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import FilterBar from "../components/shared/FilterBar";
import TripModal from "../components/shared/TripModal";
import TripTable from "../components/shared/TripTable";
import Modal from "../components/shared/Modal";
import { exportTripsCsv, exportPayslip } from "../lib/exportHelpers";
import { defaultColumnLabels } from "@/lib/columnLabels";
import {
  Plus,
  Search,
  Download,
  FileText,
  AlertTriangle,
  CheckCheck,
  XCircle,
  Trash2,
  Route,
  Columns3,
} from "lucide-react";
import ExpenseBreakdownModal from "../components/shared/ExpenseBreakdownModal";
import { AnimatePresence, motion } from "framer-motion";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import EmptyState from "../components/shared/EmptyState";
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

export default function TripsPage() {
  const {
    tripRows,
    loading,
    selectedTruck,
    truckOptions,
    initApp,
    deleteTrip,
    toggleTripPaid,
    addExpense, // 🔥 ADD THIS
    deleteExpense, // 🔥 ADD THIS
    fetchDashboard,
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

  const [driverStatus, setDriverStatus] = useState<"ALL" | "UNPAID" | "PAID">(
    "ALL",
  );
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
  const COLUMN_STORAGE_KEY = "trips-columns";
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

  const dropdownRef = useRef<HTMLDivElement>(null);

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
  const pageTitle = selectedTruckName ? `${selectedTruckName} Trips` : "Trips";
  const showTruckColumn = !selectedTruck || selectedTruck === "ALL";

  const handleTogglePaid = async (id: string) => {
    const trip = tripRows.find((r) => r._id === id);
    if (!trip) return;

    const willBePaid = !trip.paid;

    try {
      const latestExpenses = useAppStore.getState().expenseRows;

      const existing = latestExpenses.find((e) => e.tripId === trip._id);

      // 🔴 UNPAID
      if (!willBePaid) {
        if (existing) {
          await deleteExpense(existing._id);
        }
      }

      // 🔥 TOGGLE FIRST
      await toggleTripPaid(id);

      // 🟢 PAID
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

      await fetchDashboard();
    } catch (err) {
      console.error(err);
    }
  };

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

  const getRangeLabel = useCallback((): string => {
    const RANGE_LABELS: Record<string, string> = {
      ALL: "All Time",
      CC: "Current Cutoff",
      LC: "Last Cutoff",
      TM: "This Month",
      LM: "Last Month",
      MTD: "Month to Date",
      YTD: "Year to Date",
      CUSTOM: "Custom Range",
    };
    const label = RANGE_LABELS[rangePreset] || "All Time";
    if (startDate && endDate) {
      const fmtStart = new Date(startDate + "T00:00:00").toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      );
      const fmtEnd = new Date(endDate + "T00:00:00").toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      );
      return `${label} (${fmtStart} – ${fmtEnd})`;
    }
    return label;
  }, [rangePreset, startDate, endDate]);

  const handleExportCsv = () => {
    const truckLabel =
      truckOptions.find((t) => t._id === selectedTruck)?.truckName ||
      "All Trucks";
    const rangeLabel = getRangeLabel();
    const filename = `NEXTMILE_${truckLabel.replace(/\s+/g, "_")}_${rangeLabel.replace(/[^a-zA-Z0-9-]/g, "_")}.csv`;
    exportTripsCsv(tripRows, filename);
  };

  const handleExportPayslip = () => {
    const truckLabel =
      truckOptions.find((t) => t._id === selectedTruck)?.truckName ||
      "All Trucks";
    exportPayslip(tripRows, truckLabel, startDate, endDate);
  };

  const handleBulkDelete = async () => {
    await bulkDeleteTrips(selectedTripIds);
    setBulkDeleteModal(false);
  };

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage trips, filter records, and add new entries.
            </p>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-40 bg-background">
        <FilterBar
          showTruck={admin}
          showRange
          showMonth={false}
          allowedRangePresets={admin ? undefined : (["CC", "LC"] as const)}
          actions={
            <button
              onClick={handleAddTrip}
              className="h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
            >
              <Plus size={18} /> Add Trip
            </button>
          }
        />
      </div>

      <div className="border border-border rounded-lg bg-background p-3.5 overflow-visible mt-4">
        <div className="flex flex-col gap-3 mb-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">Trip Records</h2>
            <p className="text-sm text-muted-foreground">
              {admin
                ? "Filter, edit, export, and generate payslips."
                : "View trips and add new entries."}
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
                      "h-full px-3 text-xs rounded-md flex items-center transition-colors",

                      verificationFilter === status &&
                        (status === "Verified"
                          ? "bg-green-500/80 text-white"
                          : status === "Pending"
                            ? "bg-orange-500 text-white"
                            : status === "For Confirmation"
                              ? "bg-gray-500 text-white"
                              : "bg-foreground text-background"),

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
            {!admin && (
              <div className="flex rounded-[14px] border border-slate-200 dark:border-slate-700 overflow-hidden">
                {(["ALL", "UNPAID", "PAID"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setDriverStatus(s)}
                    className={`min-h-[44px] px-3.5 text-xs font-semibold transition-colors ${
                      driverStatus === s
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {s === "ALL" ? "All" : s === "UNPAID" ? "Unpaid" : "Paid"}
                  </button>
                ))}
              </div>
            )}
            {admin && (
              <>
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
              </>
            )}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setShowColumnsMenu((v) => !v)}
                className={cn(
                  "h-10 w-10 rounded-md border border-border flex items-center justify-center transition-colors",
                  showColumnsMenu
                    ? "bg-muted"
                    : "bg-background hover:bg-muted text-muted-foreground",
                )}
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
          searchQuery={searchQuery}
          loading={loading}
          verificationFilter={verificationFilter}
          showActions
          selectable={admin}
          selectedIds={admin ? selectedTripIds : []}
          onSelectionChange={admin ? setSelectedTripIds : undefined}
          onTogglePaid={admin ? handleTogglePaid : undefined}
          onEdit={(r) => {
            setEditRow(r);
            setDuplicateFrom(null);
            setTripModal(true);
          }}
          onDelete={(r) => setDeleteModal(r)}
          onDuplicate={admin ? handleDuplicate : undefined}
          onExpenseClick={(data) => setExpenseBreakdown(data)}
          canEditRow={admin ? undefined : (r) => !r.paid}
          canDeleteRow={admin ? undefined : (r) => !r.paid}
          selectedTruck={selectedTruck}
          showTruckColumn={showTruckColumn}
          visibleColumns={visibleColumns}
          onQuickEdit={admin ? quickEditTrip : undefined}
          // ✅ ADD THIS
          onVerificationChange={
            admin
              ? async (id, status) => {
                  await quickEditTrip(id, "verificationStatus", status);
                }
              : undefined
          }
          emptyState={
            <EmptyState
              icon={Route}
              title="No trips found"
              description={
                selectedTruck
                  ? `No trips recorded for ${selectedTruckName}. Add your first trip to get started!`
                  : "Select a truck and add your first trip to start tracking."
              }
              action={
                selectedTruck ? (
                  <button
                    onClick={handleAddTrip}
                    className="px-4 py-2.5 rounded-[14px] bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-[0_10px_20px_rgba(37,99,235,0.18)] hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-1.5"
                  >
                    <Plus size={16} /> Add Trip
                  </button>
                ) : undefined
              }
            />
          }
        />
      </div>

      <AnimatePresence>
        {admin && selectedTripIds.length > 0 && (
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
              onClick={async () => {
                if (!deleteModal) return;

                const trip = deleteModal;

                try {
                  // 🔍 hanapin related expense
                  const latestExpenses = useAppStore.getState().expenseRows;

                  const existing = latestExpenses.find(
                    (e) => e.tripId === trip._id,
                  );

                  // 🔥 delete expense first
                  if (existing) {
                    await deleteExpense(existing._id);
                  }

                  // 🔥 delete trip
                  await deleteTrip(trip._id);

                  setDeleteModal(null);
                } catch (err) {
                  console.error("Delete failed", err);
                }
              }}
              className="px-6 py-2.5 rounded-md bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition"
            >
              Delete
            </button>
          </>
        }
      >
        <p>Are you sure you want to delete</p>
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
            Choose a truck from the Dashboard filter bar to add a trip.
          </p>
        </div>
      </Modal>
    </div>
  );
}
