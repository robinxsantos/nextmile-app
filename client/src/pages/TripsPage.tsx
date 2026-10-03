import { useEffect, useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import { useAppStore, type TripRow } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import TripModal from "../components/shared/TripModal";
import TripTable from "../components/shared/TripTable";
import { exportTripsCsv, exportPayslip } from "../lib/exportHelpers";
import FilterBar from "../components/shared/FilterBar";
import {
  Plus,
  Search,
  Download,
  Upload,
  FileText,
  FileDown,
  AlertTriangle,
  CheckCheck,
  XCircle,
  Trash2,
  ListFilter,
  CircleHelp,
  Clock3,
  Route,
  Columns3,
  CircleCheck,
  CopyCheck,
} from "lucide-react";
import ExpenseBreakdownModal from "../components/shared/ExpenseBreakdownModal";
import { AnimatePresence, motion } from "framer-motion";
import EmptyState from "../components/shared/EmptyState";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";

const RANGE_LABELS: Record<string, string> = {
  ALL: "All Time",
  CC: "This Cutoff",
  LC: "Previous Cutoff",
  TM: "This Month",
  LM: "Last Month",
  MTD: "Month to Date",
  YTD: "Year to Date",
  CUSTOM: "Custom Range",
};

const COLUMN_OPTIONS = [
  ["truck", "Truck"],
  ["week", "Week"],
  ["date", "Date"],
  ["status", "Status"],
  ["shipmentNumber", "Shipment #"],
  ["rate", "Adjusted Rate"],
  ["trips", "Trips"],
  ["grossIncome", "Gross"],
  ["netIncome", "Net"],
  ["payable", "Payable"],
] as const;

type ColumnKey = (typeof COLUMN_OPTIONS)[number][0];

export default function TripsPage() {
  const {
    tripRows,
    expenseRows,
    loading,
    selectedTruck,
    truckOptions,
    initApp,
    deleteTrip,
    toggleTripPaid,
    fetchDashboard,
    fetchExpenses,
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
    importTrips,
    previewImportTrips,
  } = useAppStore();
  const { user } = useAuthStore();

  const canManageTrips = user?.role === "admin" || user?.role === "manager";
  const [tripModal, setTripModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<"add" | "update" | "upsert">(
    "add",
  );
  const [importProgress, setImportProgress] = useState(0);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    total: number;
    newTrips: number;
    duplicates: number;
    invalid: number;
  } | null>(null);
  const [editRow, setEditRow] = useState<TripRow | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<TripRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<TripRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showTruckWarning, setShowTruckWarning] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [expenseBreakdown, setExpenseBreakdown] = useState<{
    truckId: string;
    dateIso: string;
    dateText: string;
  } | null>(null);
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
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      await initApp();
      await fetchExpenses(startDate, endDate);
      await fetchDashboard();
    };

    load();
  }, [
    initApp,
    fetchExpenses,
    fetchDashboard,
    selectedTruck,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const selectedTruckName = truckOptions.find(
    (t) => t._id === selectedTruck,
  )?.truckName;
  const showTruckColumn = !selectedTruck || selectedTruck === "ALL";

  const handleTogglePaid = async (id: string) => {
    try {
      await toggleTripPaid(id);
      await fetchExpenses();
    } catch (err) {
      console.error("Toggle failed", err);
    }
  };

  const handleAddTrip = () => {
    if (!selectedTruck || selectedTruck === "ALL") {
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

  const handleDelete = async () => {
    if (!deleteModal) return;

    setDeleting(true);

    try {
      await deleteTrip(deleteModal._id);
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

  const downloadCsvTemplate = () => {
    const csv = [
      "Date,Shipment Number,Original Rate,Rate Adjustment Type,Rate Adjustment,Auto-Compute VAT,Crew Salary,Cash Advance,Reimbursement Category,Reimbursements",
      "2026-08-01,1307001,3900,Amount,500,Yes,1900,500,PARKING/PASSWAY,250",
      "2026-08-02,1307002,3900,Percentage,10,Yes,1900,,,",
      "2026-08-03,1307003,3900,,,No,1900,,,",
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "Trips_Import_Template.csv";

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  const processCsvFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a CSV file.");
      return;
    }

    setSelectedCsvFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete: async (results) => {
        const rows = results.data as any[];

        if (rows.length === 0) {
          toast.error("CSV file is empty.");
          return;
        }

        const first = rows[0];

        const requiredColumns = [
          "Date",
          "Shipment Number",
          "Original Rate",
          "Auto-Compute VAT",
          "Crew Salary",
        ];

        const missing = requiredColumns.filter((c) => !(c in first));

        if (missing.length > 0) {
          toast.error(`Missing required column(s): ${missing.join(", ")}`);
          return;
        }

        setCsvRows(rows);

        if (!selectedTruck || selectedTruck === "ALL") {
          toast.error("Please select a specific truck before importing trips.");
          return;
        }

        const preview = await previewImportTrips(selectedTruck, rows);
        setPreviewResult(preview);
      },
    });
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    processCsvFile(file);
  };

  const handleImportCsv = () => {
    setConfirmImport(true);
  };

  return (
    <div>
      <div className="sticky top-16 z-30 bg-background">
        <FilterBar
          showTruck={false}
          allowedRangePresets={
            canManageTrips ? undefined : (["CC", "LC"] as const)
          }
          actions={
            <Button onClick={handleAddTrip}>
              <Plus data-icon="inline-start" />
              Add Trip
            </Button>
          }
        />
      </div>

      <Card size="sm" className="mt-4 !gap-0">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Trip Records</CardTitle>

              <CardDescription>
                {canManageTrips
                  ? "Filter, edit, export, and generate payslips."
                  : "View trips and add new entries."}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canManageTrips && (
                <>
                  <Button variant="outline" onClick={handleExportCsv}>
                    <Download data-icon="inline-start" />
                    Export CSV
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!selectedTruck || selectedTruck === "ALL") {
                        setShowTruckWarning(true);
                        return;
                      }

                      setImportModal(true);
                    }}
                  >
                    <Upload data-icon="inline-start" />
                    Import CSV
                  </Button>

                  <Button variant="outline" onClick={handleExportPayslip}>
                    <FileText data-icon="inline-start" />
                    Payslip
                  </Button>
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
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
            {canManageTrips && (
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
            )}
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
          selectable={canManageTrips}
          selectedIds={canManageTrips ? selectedTripIds : []}
          onSelectionChange={canManageTrips ? setSelectedTripIds : undefined}
          onTogglePaid={canManageTrips ? handleTogglePaid : undefined}
          onEdit={(r) => {
            setEditRow(r);
            setDuplicateFrom(null);
            setTripModal(true);
          }}
          onDelete={(r) => setDeleteModal(r)}
          onDuplicate={canManageTrips ? handleDuplicate : undefined}
          onExpenseClick={(data) => setExpenseBreakdown(data)}
          canEditRow={canManageTrips ? undefined : (r) => !r.paid}
          canDeleteRow={canManageTrips ? undefined : (r) => !r.paid}
          selectedTruck={selectedTruck}
          showTruckColumn={showTruckColumn}
          visibleColumns={visibleColumns}
          onQuickEdit={canManageTrips ? quickEditTrip : undefined}
          onVerificationChange={
            canManageTrips
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
                selectedTruck && selectedTruck !== "ALL"
                  ? `No trips recorded for ${selectedTruckName} on the selected date range.`
                  : "No trips recorded on the selected date range."
              }
              action={
                selectedTruck && selectedTruck !== "ALL" ? (
                  <Button onClick={handleAddTrip}>
                    <Plus data-icon="inline-start" />
                    Add Trip
                  </Button>
                ) : undefined
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

        {/* TRUCK WARNING */}
        <Dialog open={showTruckWarning} onOpenChange={setShowTruckWarning}>
          <DialogContent className="sm:max-w-[400px] text-center">
            <DialogHeader className="items-center text-center">
              <div className="mb-1 grid size-10 place-items-center rounded-full bg-amber-500/10 text-amber-500">
                <AlertTriangle className="size-5" />
              </div>

              <DialogTitle className="text-sm">
                Please select a specific truck first!
              </DialogTitle>

              <DialogDescription>
                Choose a specific truck to continue.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="sm:justify-center">
              <Button
                variant="outline"
                onClick={() => setShowTruckWarning(false)}
              >
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={importModal}
          onOpenChange={(open) => {
            setImportModal(open);

            if (!open) {
              setCsvRows([]);
              setPreviewResult(null);
              setSelectedCsvFile(null);

              if (csvInputRef.current) {
                csvInputRef.current.value = "";
              }
            }
          }}
        >
          <DialogContent className="sm:max-w-[1250px] max-h-[90vh] gap-3 overflow-y-auto">
            <DialogHeader className="!gap-1">
              <DialogTitle className="text-base">
                Import Trips from CSV
              </DialogTitle>

              <DialogDescription className="text-xs">
                Upload a CSV file to import trips. Use the template to ensure
                the correct column format.
              </DialogDescription>
            </DialogHeader>

            <div>
              <div className="rounded-lg border border-dashed p-4">
                <div className="grid gap-2 lg:grid-cols-2">
                  {/* LEFT: FILE */}
                  <div className="rounded-lg border p-3">
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                      id="trip-csv-upload"
                    />

                    <Button
                      variant="outline"
                      asChild
                      className={cn(
                        "h-[54px] w-full border-dashed",
                        isDraggingCsv && "border-foreground bg-muted",
                      )}
                    >
                      <label
                        htmlFor="trip-csv-upload"
                        className="flex cursor-pointer items-center justify-center gap-2"
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setIsDraggingCsv(true);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingCsv(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setIsDraggingCsv(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingCsv(false);

                          const file = e.dataTransfer.files?.[0];
                          if (!file) return;

                          processCsvFile(file);
                        }}
                      >
                        <Upload data-icon="inline-start" />

                        <span>
                          {isDraggingCsv
                            ? "Drag CSV here"
                            : "Choose or Drag a CSV file"}
                        </span>
                      </label>
                    </Button>

                    {selectedCsvFile && (
                      <div className="mt-2 flex items-center gap-2 rounded-md bg-muted/30 px-3 py-1.5">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">
                            {selectedCsvFile.name}
                          </p>

                          <p className="text-[11px] text-muted-foreground">
                            {(selectedCsvFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove selected CSV"
                          onClick={() => {
                            setSelectedCsvFile(null);
                            setCsvRows([]);
                            setPreviewResult(null);

                            if (csvInputRef.current) {
                              csvInputRef.current.value = "";
                            }
                          }}
                        >
                          <XCircle />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* RIGHT */}
                  <div className="grid gap-2">
                    {/* TEMPLATE */}
                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-foreground">
                          <FileDown className="size-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-medium">Use Template</p>

                          <p className="text-xs text-muted-foreground">
                            Download the CSV template with the required column
                            format.
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={downloadCsvTemplate}
                        className="shrink-0"
                      >
                        <FileDown data-icon="inline-start" />
                        Download Template
                      </Button>
                    </div>

                    {/* IMPORT MODE */}
                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-foreground">
                          <Route className="size-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-medium">Import Mode</p>

                          <p className="text-xs text-muted-foreground">
                            Choose how existing trips should be handled.
                          </p>
                        </div>
                      </div>

                      <Select
                        value={importMode}
                        onValueChange={(value) =>
                          setImportMode(value as "add" | "update" | "upsert")
                        }
                      >
                        <SelectTrigger className="w-[190px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="add">Add New Only</SelectItem>
                          <SelectItem value="update">
                            Update Existing Only
                          </SelectItem>
                          <SelectItem value="upsert">
                            Add New + Update Existing
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                {csvRows.length > 0 && (
                  <div className="mt-2">
                    {previewResult && (
                      <div className="mb-2 flex items-center gap-3 rounded-lg border px-3 py-2">
                        <div className="min-w-[220px] border-r pr-3">
                          <p className="text-sm font-semibold">
                            {previewResult.total}{" "}
                            {previewResult.total === 1 ? "Trip" : "Trips"} Found
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Review the data below before importing.
                          </p>
                        </div>

                        <div className="grid flex-1 grid-cols-3 gap-3">
                          <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-1.5 text-green-600 dark:text-green-400">
                            <CircleCheck className="size-4" />

                            <div>
                              <div className="text-sm font-semibold">
                                {previewResult.newTrips}
                              </div>
                              <div className="text-[11px]">New Trips</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-amber-600 dark:text-amber-400">
                            <CopyCheck className="size-4" />

                            <div>
                              <div className="text-sm font-semibold">
                                {previewResult.duplicates}
                              </div>
                              <div className="text-[11px]">
                                {importMode === "add"
                                  ? "Duplicates"
                                  : importMode === "update"
                                    ? "Trips to Update"
                                    : "Will Update"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-destructive">
                            <AlertTriangle className="size-4" />

                            <div>
                              <div className="text-sm font-semibold">
                                {previewResult.invalid}
                              </div>
                              <div className="text-[11px]">Invalid Rows</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-md border [&>div]:max-h-[300px] [&>div]:overflow-auto">
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow className="sticky top-0 z-20 bg-background hover:bg-muted">
                            <TableHead className="whitespace-nowrap text-xs">
                              Date
                            </TableHead>

                            <TableHead className="whitespace-nowrap text-xs">
                              Shipment No.
                            </TableHead>

                            <TableHead className="whitespace-nowrap text-right text-xs">
                              Original Rate
                            </TableHead>

                            <TableHead className="whitespace-nowrap text-right text-xs">
                              Adjustment
                            </TableHead>

                            <TableHead className="whitespace-nowrap text-right text-xs">
                              VAT
                            </TableHead>

                            <TableHead className="whitespace-nowrap text-right text-xs">
                              Rate
                            </TableHead>

                            <TableHead className="whitespace-nowrap text-right text-xs">
                              Crew Salary
                            </TableHead>

                            <TableHead className="whitespace-nowrap text-right text-xs">
                              Cash Adv.
                            </TableHead>

                            <TableHead className="whitespace-nowrap text-xs">
                              Reimb. Category
                            </TableHead>

                            <TableHead className="whitespace-nowrap text-right text-xs">
                              Reimb. Amount
                            </TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {csvRows.map((row, index) => {
                            const dateValue = row["Date"] || row["DATE"] || "";
                            const shipmentValue =
                              row["Shipment Number"] ||
                              row["Shipment"] ||
                              row["SHIPMENT NUMBER"] ||
                              "";

                            const originalRateValue =
                              row["Original Rate"] ??
                              row["ORIGINAL RATE"] ??
                              "";

                            const adjustmentTypeValue = String(
                              row["Rate Adjustment Type"] ??
                                row["RATE ADJUSTMENT TYPE"] ??
                                "",
                            )
                              .trim()
                              .toLowerCase();

                            const adjustmentValue =
                              row["Rate Adjustment"] ??
                              row["RATE ADJUSTMENT"] ??
                              "";

                            const autoVatValue = String(
                              row["Auto-Compute VAT"] ??
                                row["AUTO-COMPUTE VAT"] ??
                                "",
                            )
                              .trim()
                              .toLowerCase();

                            const crewSalaryValue =
                              row["Crew Salary"] ?? row["CREW SALARY"] ?? "";

                            const parsedDate = new Date(dateValue);

                            const validDate =
                              Boolean(dateValue) &&
                              !Number.isNaN(parsedDate.getTime());

                            const validShipment =
                              String(shipmentValue).trim().length > 0;

                            const originalRate = Number(originalRateValue);
                            const adjustment = Number(adjustmentValue || 0);

                            const validOriginalRate =
                              String(originalRateValue).trim() !== "" &&
                              Number.isFinite(originalRate) &&
                              originalRate > 0;

                            const validAdjustmentType =
                              adjustmentTypeValue === "" ||
                              adjustmentTypeValue === "amount" ||
                              adjustmentTypeValue === "percentage";

                            const validAdjustment =
                              Number.isFinite(adjustment) &&
                              adjustment >= 0 &&
                              (adjustmentTypeValue === ""
                                ? adjustment === 0
                                : adjustmentTypeValue === "amount"
                                  ? adjustment <= originalRate
                                  : adjustment < 100);

                            const validAutoVat =
                              autoVatValue === "yes" || autoVatValue === "no";

                            const computedVat =
                              validAutoVat &&
                              autoVatValue === "yes" &&
                              validOriginalRate
                                ? Math.round(
                                    (originalRate * 0.12 + Number.EPSILON) *
                                      100,
                                  ) / 100
                                : 0;

                            const validCrewSalary =
                              String(crewSalaryValue).trim() !== "" &&
                              Number.isFinite(Number(crewSalaryValue)) &&
                              Number(crewSalaryValue) > 0;

                            const isInvalidRow =
                              !validDate ||
                              !validShipment ||
                              !validOriginalRate ||
                              !validAdjustmentType ||
                              !validAdjustment ||
                              !validAutoVat ||
                              !validCrewSalary;

                            let computedRate = originalRate;

                            if (
                              validOriginalRate &&
                              validAdjustmentType &&
                              validAdjustment
                            ) {
                              if (adjustmentTypeValue === "amount") {
                                computedRate = originalRate - adjustment;
                              }

                              if (adjustmentTypeValue === "percentage") {
                                computedRate =
                                  originalRate -
                                  originalRate * (adjustment / 100);
                              }
                            }

                            computedRate =
                              Math.round(
                                (computedRate + Number.EPSILON) * 100,
                              ) / 100;

                            return (
                              <TableRow
                                key={index}
                                className={cn(
                                  isInvalidRow &&
                                    "bg-destructive/5 hover:bg-destructive/10 dark:bg-destructive/10 dark:hover:bg-destructive/15",
                                )}
                              >
                                {/* DATE */}
                                <TableCell className="whitespace-nowrap">
                                  {validDate ? (
                                    parsedDate.toLocaleDateString("en-US", {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  ) : (
                                    <span className="font-medium text-red-500">
                                      *Required
                                    </span>
                                  )}
                                </TableCell>

                                {/* SHIPMENT */}
                                <TableCell className="whitespace-nowrap">
                                  {validShipment ? (
                                    shipmentValue
                                  ) : (
                                    <span className="font-medium text-red-500">
                                      *Required
                                    </span>
                                  )}
                                </TableCell>

                                {/* ORIGINAL RATE */}
                                <TableCell className="whitespace-nowrap text-right tabular-nums">
                                  {validOriginalRate ? (
                                    originalRate.toLocaleString("en-PH", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })
                                  ) : (
                                    <span className="font-medium text-red-500">
                                      *Required
                                    </span>
                                  )}
                                </TableCell>

                                {/* ADJUSTMENT */}
                                <TableCell className="whitespace-nowrap text-right tabular-nums">
                                  {!validAdjustmentType || !validAdjustment ? (
                                    <span className="font-medium text-red-500">
                                      *Invalid
                                    </span>
                                  ) : adjustmentTypeValue === "" ? (
                                    "—"
                                  ) : adjustmentTypeValue === "amount" ? (
                                    `₱${adjustment.toLocaleString("en-PH", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                  ) : (
                                    `${adjustment}%`
                                  )}
                                </TableCell>

                                {/* VAT */}
                                <TableCell className="whitespace-nowrap text-right tabular-nums">
                                  {validAutoVat ? (
                                    `₱${computedVat.toLocaleString("en-PH", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                  ) : (
                                    <span className="font-medium text-red-500">
                                      *Required
                                    </span>
                                  )}
                                </TableCell>

                                {/* COMPUTED RATE */}
                                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                                  {validOriginalRate &&
                                  validAdjustmentType &&
                                  validAdjustment
                                    ? computedRate.toLocaleString("en-PH", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })
                                    : "—"}
                                </TableCell>

                                {/* CREW SALARY */}
                                <TableCell className="whitespace-nowrap text-right tabular-nums">
                                  {validCrewSalary ? (
                                    crewSalaryValue
                                  ) : (
                                    <span className="font-medium text-red-500">
                                      *Required
                                    </span>
                                  )}
                                </TableCell>

                                {/* CASH ADVANCE — OPTIONAL */}
                                <TableCell className="whitespace-nowrap text-right tabular-nums">
                                  {row["Cash Advance"] ||
                                    row["CASH ADVANCE"] ||
                                    "—"}
                                </TableCell>

                                {/* REIMBURSEMENT CATEGORY — OPTIONAL */}
                                <TableCell className="whitespace-nowrap">
                                  {row["Reimbursement Category"] ||
                                    row["REIMBURSEMENT CATEGORY"] ||
                                    "—"}
                                </TableCell>

                                {/* REIMBURSEMENTS — OPTIONAL */}
                                <TableCell className="whitespace-nowrap text-right tabular-nums">
                                  {row["Reimbursements"] ||
                                    row["REIMBURSEMENTS"] ||
                                    "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(previewResult?.invalid ?? 0) > 0 && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  Required fields are missing or contain invalid values.
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setImportModal(false);
                  setCsvRows([]);
                  setPreviewResult(null);
                  setSelectedCsvFile(null);

                  if (csvInputRef.current) {
                    csvInputRef.current.value = "";
                  }
                }}
              >
                Cancel
              </Button>

              <Button
                onClick={handleImportCsv}
                disabled={
                  csvRows.length === 0 ||
                  (previewResult?.invalid ?? 0) > 0 ||
                  (importMode === "add"
                    ? (previewResult?.newTrips ?? 0) === 0
                    : importMode === "update"
                      ? (previewResult?.duplicates ?? 0) === 0
                      : (previewResult?.newTrips ?? 0) === 0 &&
                        (previewResult?.duplicates ?? 0) === 0)
                }
              >
                {(previewResult?.invalid ?? 0) > 0
                  ? "Invalid CSV Data"
                  : importMode === "update"
                    ? `Update ${previewResult?.duplicates ?? 0} Trip${
                        previewResult?.duplicates === 1 ? "" : "s"
                      }`
                    : importMode === "upsert"
                      ? `Process ${
                          (previewResult?.newTrips ?? 0) +
                          (previewResult?.duplicates ?? 0)
                        } Trip${
                          (previewResult?.newTrips ?? 0) +
                            (previewResult?.duplicates ?? 0) ===
                          1
                            ? ""
                            : "s"
                        }`
                      : (previewResult?.newTrips ?? 0) === 0 &&
                          (previewResult?.duplicates ?? 0) > 0
                        ? "Already Imported"
                        : `Import ${previewResult?.newTrips ?? 0} Trip${
                            previewResult?.newTrips === 1 ? "" : "s"
                          }`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={confirmImport} onOpenChange={setConfirmImport}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Import Trips?</DialogTitle>

              <DialogDescription className="sr-only">
                Review and confirm the CSV trip import.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <p className="text-sm">
                  You're about to process{" "}
                  <span className="font-medium">
                    {csvRows.length} trip{csvRows.length === 1 ? "" : "s"}
                  </span>
                  .
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Import mode:{" "}
                  <span className="text-sm font-medium text-foreground">
                    {importMode === "add"
                      ? "Add New Only"
                      : importMode === "update"
                        ? "Update Existing Only"
                        : "Add New + Update Existing"}
                  </span>
                </p>
              </div>

              <div className="space-y-1.5 rounded-md border bg-muted/20 px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <CircleCheck className="size-4 text-green-600 dark:text-green-400" />
                  <span>CSV parsed successfully</span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <CircleCheck className="size-4 text-green-600 dark:text-green-400" />
                  <span>Required columns validated</span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <CircleCheck className="size-4 text-green-600 dark:text-green-400" />
                  <span>Ready for import</span>
                </div>
              </div>
            </div>

            {importing && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Importing trips...</span>
                  <span className="tabular-nums">{importProgress}%</span>
                </div>

                <Progress value={importProgress} />
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                disabled={importing}
                onClick={() => setConfirmImport(false)}
              >
                Cancel
              </Button>

              <Button
                disabled={
                  importing ||
                  (previewResult?.invalid ?? 0) > 0 ||
                  (importMode === "add"
                    ? (previewResult?.newTrips ?? 0) === 0
                    : importMode === "update"
                      ? (previewResult?.duplicates ?? 0) === 0
                      : (previewResult?.newTrips ?? 0) === 0 &&
                        (previewResult?.duplicates ?? 0) === 0)
                }
                onClick={async () => {
                  if (!selectedTruck || selectedTruck === "ALL") {
                    toast.error(
                      "Please select a specific truck before importing trips.",
                    );
                    return;
                  }

                  setImporting(true);
                  setImportProgress(10);

                  try {
                    const result = await importTrips(
                      selectedTruck,
                      csvRows,
                      importMode,
                    );
                    setImportProgress(100);

                    if (result.duplicates > 0) {
                      toast.success(
                        `Imported ${result.imported} trip${result.imported === 1 ? "" : "s"} • Skipped ${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"}`,
                      );
                    } else {
                      toast.success(
                        `Successfully imported ${result.imported} trip${result.imported === 1 ? "" : "s"}`,
                      );
                    }
                    await fetchDashboard();
                    await new Promise((resolve) => setTimeout(resolve, 800));
                    setConfirmImport(false);
                    setImportModal(false);
                    setCsvRows([]);
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setImporting(false);
                    setImportProgress(0);
                    setSelectedCsvFile(null);
                  }
                }}
              >
                {importing ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Importing...
                  </>
                ) : (previewResult?.invalid ?? 0) > 0 ? (
                  "Invalid CSV Data"
                ) : importMode === "update" ? (
                  `Update ${previewResult?.duplicates ?? 0} Trip${
                    previewResult?.duplicates === 1 ? "" : "s"
                  }`
                ) : importMode === "upsert" ? (
                  `Process ${
                    (previewResult?.newTrips ?? 0) +
                    (previewResult?.duplicates ?? 0)
                  } Trip${
                    (previewResult?.newTrips ?? 0) +
                      (previewResult?.duplicates ?? 0) ===
                    1
                      ? ""
                      : "s"
                  }`
                ) : (previewResult?.newTrips ?? 0) === 0 &&
                  (previewResult?.duplicates ?? 0) > 0 ? (
                  "Already Imported"
                ) : (
                  `Import ${previewResult?.newTrips ?? 0} Trip${
                    previewResult?.newTrips === 1 ? "" : "s"
                  }`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </div>
  );
}
