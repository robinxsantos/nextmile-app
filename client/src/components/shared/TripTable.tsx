import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  useReactTable,
  getSortedRowModel,
  getCoreRowModel,
  type ColumnDef,
  type SortingState,
  getPaginationRowModel,
  type PaginationState,
  getFilteredRowModel,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { type TripRow } from "../../store/useAppStore";
import { peso, cn } from "../../lib/utils";
import {
  Pencil,
  Trash2,
  Check,
  Copy,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
  Route,
  X,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  CheckCheck,
} from "lucide-react";
import EmptyState from "./EmptyState";
import { Skeleton, SkeletonTableRow } from "./Skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Pagination from "../shared/Pagination";

type ColumnKey =
  | "truck"
  | "week"
  | "date"
  | "status"
  | "shipmentNumber"
  | "verification"
  | "rate"
  | "trips"
  | "crewSalary"
  | "cashAdvance"
  | "reimbursements"
  | "expenses"
  | "note"
  | "grossIncome"
  | "netIncome"
  | "payable"
  | "paid"
  | "actions";

type VisibleColumns = Partial<Record<ColumnKey, boolean>>;

// Internal column descriptor — drives both header and cell rendering manually
type ColDesc = {
  key: ColumnKey;
  label: string;
  sortField?: string;
  className?: string;
};

export interface TripTableProps {
  rows: TripRow[];
  loading?: boolean;
  showActions?: boolean;
  onTogglePaid?: (id: string) => Promise<void>;
  onEdit?: (row: TripRow) => void;
  onDelete?: (row: TripRow) => void;
  onDuplicate?: (row: TripRow) => void;
  onExpenseClick?: (data: {
    truckId: string;
    dateIso: string;
    dateText: string;
  }) => void;
  selectedTruck?: string;
  reportMode?: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onQuickEdit?: (
    id: string,
    field: string,
    value: number | string,
  ) => Promise<void>;
  onVerificationChange?: (id: string, status: string) => Promise<void>;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string) => void;
  emptyState?: ReactNode;
  showTruckColumn?: boolean;
  visibleColumns?: VisibleColumns;
  totalsRows?: TripRow[];
  canEditRow?: (row: TripRow) => boolean;
  canDeleteRow?: (row: TripRow) => boolean;
  verificationFilter?: string;
  searchQuery?: string;
  isRefreshing?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "WORKING DAY")
    return "bg-green-500/10 text-green-500 border-green-500/20";
  if (s === "HOLIDAY")
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  return "bg-slate-400/10 text-slate-400 border-slate-400/20";
}

// ---------------------------------------------------------------------------
// EditableCell
// ---------------------------------------------------------------------------

function EditableCell({
  rowId,
  field,
  value,
  isNote,
  onSave,
}: {
  rowId: string;
  field: string;
  value: string | number;
  isNote?: boolean;
  onSave: (id: string, field: string, value: number | string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = useCallback(() => {
    setDraft(String(value));
    setEditing(true);
  }, [value]);

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft(String(value));
  }, [value]);

  const save = useCallback(async () => {
    const newVal = isNote ? draft : Number(draft) || 0;
    if (String(newVal) === String(value)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(rowId, field, newVal);
    } catch {
      // ignore
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, isNote, value, rowId, field, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        save();
      }
      if (e.key === "Escape") cancel();
    },
    [save, cancel],
  );

  if (saving) {
    return (
      <span className="inline-flex items-center justify-center">
        <Loader2 size={14} className="animate-spin text-blue-500" />
      </span>
    );
  }

  if (editing) {
    const sharedClass =
      "w-full text-xs text-center bg-white dark:bg-slate-800 border border-blue-400 rounded-md px-1.5 py-1 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all";
    return isNote ? (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={save}
        rows={2}
        className={cn(sharedClass, "resize-none text-left min-w-[100px]")}
      />
    ) : (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={save}
        className={cn(sharedClass, "min-w-[70px]")}
      />
    );
  }

  const numericValue = Number(value);
  let display: React.ReactNode;
  if (isNote) {
    display = value || "—";
  } else if (field === "trips") {
    display =
      numericValue === 0 ? (
        <span className="text-slate-300 dark:text-slate-600">—</span>
      ) : (
        numericValue
      );
  } else {
    display =
      numericValue === 0 ? (
        <span className="text-slate-300 dark:text-slate-600">—</span>
      ) : (
        peso(numericValue)
      );
  }

  return (
    <span
      onDoubleClick={startEdit}
      className="cursor-pointer hover:bg-muted rounded px-1 py-0.5 -mx-1 transition-colors"
      title="Double-click to edit"
    >
      {display}
    </span>
  );
}

// ---------------------------------------------------------------------------
// TripCard (mobile)
// ---------------------------------------------------------------------------

function TripCard({
  r,
  showActions,
  reportMode,
  onEdit,
  onDelete,
  onDuplicate,
  onExpenseClick,
  selectedTruck,
  selectable,
  selected,
  onSelectToggle,
  showTruckColumn,
}: {
  r: TripRow;
  showActions: boolean;
  reportMode: boolean;
  onTogglePaid?: (id: string) => Promise<void>;
  onEdit?: (row: TripRow) => void;
  onDelete?: (row: TripRow) => void;
  onDuplicate?: (row: TripRow) => void;
  onExpenseClick?: (data: {
    truckId: string;
    dateIso: string;
    dateText: string;
  }) => void;
  selectedTruck?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelectToggle?: (id: string) => void;
  showTruckColumn?: boolean;
}) {
  const netValue = reportMode
    ? (r.reportNetIncome ?? r.netIncome)
    : r.netIncome;
  const payableValue = reportMode ? (r.reportPayable ?? r.payable) : r.payable;
  const displayPayable = !reportMode && r.paid ? "₱0.00" : peso(payableValue);

  return (
    <div
      className={cn(
        "glass-card rounded-md border border-slate-200 dark:border-slate-700 p-4",
        selectable && selected && "ring-2 ring-blue-500/30 border-blue-400",
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start gap-2.5">
          {selectable && onSelectToggle && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onSelectToggle(r._id)}
              className="w-4 h-4 mt-0.5 rounded border-border text-blue-600 focus:ring-blue-500/20 cursor-pointer"
            />
          )}
          <div>
            <div className="font-bold text-sm">{r.dateText}</div>
            {showTruckColumn && r.truckName && (
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {r.truckName}
              </div>
            )}
            <div className="text-xs text-slate-500">{r.week}</div>
          </div>
        </div>
        <span
          className={cn(
            "inline-block px-2.5 py-1 rounded-full text-[10px] font-bold leading-none border whitespace-nowrap",
            statusBadge(r.status),
          )}
        >
          {r.status.toUpperCase()}
        </span>
      </div>

      <div className="text-orange-500 font-semibold text-sm mb-3">
        {r.shipmentNumber}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
        <div>
          <div className="text-slate-500">Gross</div>
          <div className="font-semibold">{peso(r.grossIncome)}</div>
        </div>
        <div>
          <div className="text-slate-500">Net</div>
          <div
            className={cn(
              "font-semibold",
              netValue < 0 ? "text-red-500" : "text-green-500",
            )}
          >
            {peso(netValue)}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Payable</div>
          <div className="font-semibold text-red-500">{displayPayable}</div>
        </div>
        <div>
          <div className="text-slate-500">Trips</div>
          <div className="font-semibold">{r.trips}</div>
        </div>
        <div>
          <div className="text-slate-500">Rate</div>
          <div className="font-semibold">{peso(r.rate)}</div>
        </div>
        <div>
          <div className="text-slate-500">Crew Salary</div>
          <div className="font-semibold">{peso(r.crewSalary)}</div>
        </div>
        <div>
          <div className="text-slate-500">Cash Adv.</div>
          <div className="font-semibold">{peso(r.cashAdvance)}</div>
        </div>
        <div>
          <div className="text-slate-500">Reimb.</div>
          <div className="font-semibold flex items-center gap-1">
            {r.paid && <CheckCheck size={14} className="text-green-500" />}
            {peso(r.reimbursements)}
          </div>
        </div>
        {r.expenses > 0 && (
          <div>
            <div className="text-slate-500">Expenses</div>
            <div className="font-semibold">{peso(Number(r.expenses || 0))}</div>
          </div>
        )}
        {r.note && (
          <div className="col-span-2">
            <div className="text-slate-500">Note</div>
            {onExpenseClick && (r.hasExpenses || r.expenses > 0) ? (
              <button
                onClick={() => {
                  const truckId =
                    typeof r.truck === "string"
                      ? r.truck
                      : r.truck &&
                          typeof r.truck === "object" &&
                          "_id" in r.truck
                        ? r.truck._id
                        : selectedTruck || "";
                  onExpenseClick({
                    truckId,
                    dateIso: r.dateIso,
                    dateText: r.dateText,
                  });
                }}
                className="font-semibold truncate text-blue-600 dark:text-blue-400 hover:underline cursor-pointer text-left"
              >
                {r.note}
              </button>
            ) : (
              <div className="font-semibold truncate">{r.note}</div>
            )}
          </div>
        )}
      </div>

      {showActions && (
        <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(r)}
              className="h-9 w-9 rounded-md inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-background text-slate-600 hover:bg-purple-500/10 hover:text-purple-600 transition-all"
              title="Duplicate"
            >
              <Copy size={14} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(r)}
              className="h-9 w-9 rounded-md inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-background text-slate-600 hover:bg-muted hover:text-blue-600 transition-all"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(r)}
              className="h-9 w-9 rounded-md inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-background text-slate-600 hover:bg-red-500/10 hover:text-red-500 transition-all"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TripTable
// ---------------------------------------------------------------------------

export default function TripTable({
  rows,
  loading = false,
  showActions = true,
  onTogglePaid,
  onEdit,
  onDelete,
  onDuplicate,
  onExpenseClick,
  selectedTruck = "",
  totalsRows,
  reportMode = false,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onQuickEdit,
  emptyState,
  showTruckColumn = false,
  visibleColumns = {},
  canEditRow,
  canDeleteRow,
  onVerificationChange,
  verificationFilter,
  searchQuery,
  isRefreshing = false,
}: TripTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "date", // must match your column key
      desc: true, // true = newest first
    },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const totalsSource = totalsRows ?? rows;

  const totals = useMemo(() => {
    return totalsSource.reduce(
      (acc, r) => {
        const reimbursements = Number(r.reimbursements || 0);
        const expenses = Number(r.expenses || 0);

        acc.rate += Number(r.rate || 0);
        acc.trips += Number(r.trips || 0);
        acc.crewSalary += Number(r.crewSalary || 0);
        acc.cashAdvance += Number(r.cashAdvance || 0);

        // keep original reimbursements total
        acc.reimbursements += reimbursements;

        // IF PAID → idagdag sa expenses
        const effectiveExpenses = expenses;

        acc.expenses += effectiveExpenses;

        acc.grossIncome += Number(r.grossIncome || 0);

        // NET calculation
        const baseNet = Number(
          reportMode ? (r.reportNetIncome ?? r.netIncome) : r.netIncome,
        );

        const adjustedNet = r.paid ? baseNet - reimbursements : baseNet;

        acc.netIncome += adjustedNet;

        acc.payable += Number(
          reportMode ? (r.reportPayable ?? r.payable) : r.payable,
        );

        return acc;
      },
      {
        rate: 0,
        trips: 0,
        crewSalary: 0,
        cashAdvance: 0,
        reimbursements: 0,
        expenses: 0,
        grossIncome: 0,
        netIncome: 0,
        payable: 0,
      },
    );
  }, [totalsSource, reportMode]);

  const show = (key: ColumnKey) => visibleColumns[key] !== false;
  const truckVisible = showTruckColumn && show("truck");

  const netValueFor = (r: TripRow) => {
    const gross = Number(r.grossIncome || 0);
    const salary = Number(r.crewSalary || 0);
    const expenses = Number(r.expenses || 0);

    return gross - salary - expenses;
  };
  const payableValueFor = (r: TripRow) =>
    reportMode ? (r.reportPayable ?? r.payable) : r.payable;
  const displayPayableFor = (r: TripRow) =>
    !reportMode && r.paid ? "₱0.00" : peso(payableValueFor(r));

  const renderMoneyCell = (value: number) => {
    const v = Number(value || 0);
    return v === 0 ? (
      <span className="text-slate-300 dark:text-slate-600">—</span>
    ) : (
      peso(v)
    );
  };

  // Build the ordered list of visible columns (metadata only — no render fns)
  const columns = useMemo<ColDesc[]>(() => {
    const cols: ColDesc[] = [];
    if (show("week")) cols.push({ key: "week", label: "Week" });
    if (show("date"))
      cols.push({ key: "date", label: "Date", sortField: "date" });
    if (truckVisible)
      cols.push({
        key: "truck",
        label: "Truck",
        className: "font-semibold text-blue-600 dark:text-blue-400",
      });
    if (show("status")) cols.push({ key: "status", label: "Status" });
    if (show("shipmentNumber"))
      cols.push({
        key: "shipmentNumber",
        label: "Shipment #",
        className: "font-semibold",
      });
    if (show("rate"))
      cols.push({ key: "rate", label: "Rate", sortField: "rate" });
    if (show("trips"))
      cols.push({ key: "trips", label: "Trips", sortField: "trips" });
    if (show("crewSalary"))
      cols.push({
        key: "crewSalary",
        label: "Crew Salary",
        sortField: "crewSalary",
      });
    if (show("cashAdvance"))
      cols.push({ key: "cashAdvance", label: "Cash Adv." });
    if (show("reimbursements"))
      cols.push({ key: "reimbursements", label: "Cr. Reimb." });
    if (show("expenses")) cols.push({ key: "expenses", label: "Expenses" });
    if (show("note"))
      cols.push({ key: "note", label: "Note", className: "max-w-[120px]" });
    if (show("grossIncome"))
      cols.push({
        key: "grossIncome",
        label: "Gross",
        sortField: "grossIncome",
      });
    if (show("netIncome"))
      cols.push({ key: "netIncome", label: "Net", sortField: "netIncome" });
    if (show("payable"))
      cols.push({ key: "payable", label: "Payable", sortField: "payable" });
    cols.push({ key: "paid", label: "Paid" });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truckVisible, visibleColumns]);

  // Minimal TanStack column defs — accessorKey only, no cell/header renderers
  // We render everything manually in JSX below to avoid hook-context issues
  const tanstackCols = useMemo<ColumnDef<TripRow>[]>(() => {
    return [
      ...columns.map((col) => ({
        id: col.key,
        accessorFn: (row: TripRow) => {
          switch (col.key) {
            case "date":
              return new Date(row.dateIso).getTime();

            case "status":
              return row.status;

            case "paid":
              return row.paid;

            case "rate":
              return row.rate;

            case "trips":
              return row.trips;

            case "crewSalary":
              return row.crewSalary;

            case "grossIncome":
              return row.grossIncome;

            case "netIncome":
              return row.netIncome;

            case "payable":
              return row.payable;

            case "shipmentNumber":
              return row.shipmentNumber || "";

            case "truck":
              return row.truckName || "";

            case "week":
              return row.week || "";

            default:
              return "";
          }
        },
        enableSorting: ["paid"].includes(col.key) || !!col.sortField,
        ...(col.key === "paid"
          ? {
              sortingFn: (a: any, b: any) => {
                const aVal = a?.original?.paid ?? false;
                const bVal = b?.original?.paid ?? false;

                if (aVal === bVal) return 0;
                return aVal ? -1 : 1;
              },
            }
          : {}),
      })),

      // ✅ HIDDEN COLUMN FOR FILTERING ONLY
      {
        id: "verificationFilter",
        accessorFn: (row: TripRow) =>
          row.verificationStatus || "For Confirmation",
      },
      {
        id: "search",
        accessorFn: (row: TripRow) => `${row.shipmentNumber}`.toLowerCase(),
      },
    ];
  }, [columns]);

  const table = useReactTable({
    data: rows,
    columns: tanstackCols,
    state: {
      sorting,
      pagination,
      columnFilters,
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters, // ✅ ADD
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // ✅ ADD
    getRowId: (row) => row._id,
  });

  useEffect(() => {
    if (!verificationFilter || verificationFilter === "ALL") {
      table.getColumn("verificationFilter")?.setFilterValue(undefined);
    } else {
      table.getColumn("verificationFilter")?.setFilterValue(verificationFilter);
    }
  }, [verificationFilter, table]);
  useEffect(() => {
    if (!searchQuery) {
      table.setGlobalFilter(undefined);
    } else {
      table.setGlobalFilter(searchQuery.toLowerCase());
    }
  }, [searchQuery, table]);

  const allSelected =
    rows.length > 0 && rows.every((r) => selectedIds.includes(r._id));
  const someSelected = rows.some((r) => selectedIds.includes(r._id));

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(
        selectedIds.filter((id) => !rows.some((r) => r._id === id)),
      );
    } else {
      const visibleIds = rows.map((r) => r._id);
      onSelectionChange([...new Set([...selectedIds, ...visibleIds])]);
    }
  };

  const handleSelectRow = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  // Render a single cell's content given a column key and row
  const renderCell = (key: ColumnKey, r: TripRow): ReactNode => {
    switch (key) {
      case "week":
        return r.week;

      case "date":
        return r.dateText;

      case "truck":
        return r.truckName || "—";

      case "status":
        return (
          <span
            className={cn(
              "inline-block px-2.5 py-1 rounded-full text-[10px] font-bold leading-none border whitespace-nowrap",
              statusBadge(r.status),
            )}
          >
            {r.status.toUpperCase()}
          </span>
        );

      case "shipmentNumber": {
        const status = r.verificationStatus || "For Confirmation";

        const getIcon = () => {
          if (status === "Verified")
            return <CheckCircle size={14} className="text-green-500" />;
          if (status === "Pending")
            return <AlertCircle size={14} className="text-orange-500" />;
          return <HelpCircle size={14} className="text-gray-400" />;
        };

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 w-full cursor-pointer rounded px-1 py-0.5 hover:brightness-50",
                          status === "Verified" && "text-green-500",
                          status === "Pending" && "text-orange-500",
                          status === "For Confirmation" && "text-gray-500",
                        )}
                      >
                        {r.shipmentNumber ? (
                          <>
                            {getIcon()}
                            {r.shipmentNumber}
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      align="center"
                      className="min-w-[180px]"
                    >
                      <DropdownMenuItem
                        onClick={() =>
                          onVerificationChange?.(r._id, "Verified")
                        }
                      >
                        <CheckCircle
                          size={14}
                          className="mr-2 text-green-500"
                        />
                        Verified
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => onVerificationChange?.(r._id, "Pending")}
                      >
                        <AlertCircle
                          size={14}
                          className="mr-2 text-orange-500"
                        />
                        Pending
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() =>
                          onVerificationChange?.(r._id, "For Confirmation")
                        }
                      >
                        <HelpCircle size={14} className="mr-2 text-gray-500" />
                        For Confirmation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TooltipTrigger>

              <TooltipContent>
                {status === "Verified"
                  ? "Shipment Number is verified"
                  : status === "Pending"
                    ? "Shipment Number is pending"
                    : "Shipment Number needs confirmation"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      case "rate":
        return onQuickEdit ? (
          <EditableCell
            rowId={r._id}
            field="rate"
            value={r.rate}
            onSave={onQuickEdit}
          />
        ) : (
          renderMoneyCell(r.rate)
        );

      case "trips": {
        const v = Number(r.trips ?? 0);
        return onQuickEdit ? (
          <EditableCell
            rowId={r._id}
            field="trips"
            value={r.trips}
            onSave={onQuickEdit}
          />
        ) : v === 0 ? (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        ) : (
          v
        );
      }

      case "crewSalary":
        return onQuickEdit ? (
          <EditableCell
            rowId={r._id}
            field="crewSalary"
            value={r.crewSalary}
            onSave={onQuickEdit}
          />
        ) : (
          renderMoneyCell(r.crewSalary)
        );

      case "cashAdvance":
        return renderMoneyCell(r.cashAdvance);

      case "reimbursements": {
        const value = Number(r.reimbursements || 0);

        if (value === 0) {
          return <span className="text-slate-300 dark:text-slate-600">—</span>;
        }

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center gap-1.5">
                  {r.paid && (
                    <CheckCheck size={14} className="text-green-500" />
                  )}
                  <span className={cn(r.paid && "text-slate-400 line-through")}>
                    {peso(value)}
                  </span>
                </div>
              </TooltipTrigger>

              {r.paid && (
                <TooltipContent>
                  Reimbursement PAID (Added to Expenses)
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      }

      case "expenses": {
        const base = Number(r.expenses || 0);

        return renderMoneyCell(base);
      }

      case "note":
        return onExpenseClick && (r.hasExpenses || r.expenses > 0 || r.note) ? (
          <button
            onClick={() => {
              if (r.hasExpenses || r.expenses > 0) {
                const truckId =
                  typeof r.truck === "string"
                    ? r.truck
                    : r.truck && typeof r.truck === "object" && "_id" in r.truck
                      ? r.truck._id
                      : selectedTruck;
                onExpenseClick({
                  truckId,
                  dateIso: r.dateIso,
                  dateText: r.dateText,
                });
              }
            }}
            className={cn(
              "text-left text-xs truncate block max-w-[120px]",
              r.hasExpenses || r.expenses > 0
                ? "text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                : "text-slate-500 cursor-default",
            )}
            title={r.note}
          >
            {r.note || "—"}
          </button>
        ) : (
          <span
            className={
              r.note ? "truncate block max-w-[120px]" : "text-slate-300"
            }
            title={r.note}
          >
            {r.note || "—"}
          </span>
        );

      case "grossIncome":
        return peso(r.grossIncome);

      case "netIncome": {
        const netValue = netValueFor(r);
        return (
          <span
            className={cn(
              "font-semibold",
              netValue < 0 ? "text-red-500" : "text-green-500",
            )}
          >
            {peso(netValue)}
          </span>
        );
      }

      case "payable":
        return (
          <span className="text-red-500 font-semibold">
            {displayPayableFor(r)}
          </span>
        );

      case "paid": {
        const isLoading = loadingId === r._id;
        const effectivePaid = isLoading ? !r.paid : r.paid;

        return (
          <button
            disabled={isLoading}
            onClick={async () => {
              if (isLoading) return;
              setLoadingId(r._id);

              try {
                await onTogglePaid?.(r._id);
              } finally {
                setLoadingId(null);
              }
            }}
            className={cn(
              "group px-3 py-1.5 rounded-md inline-flex cursor-pointer items-center gap-1.5 text-xs border transition-all",
              effectivePaid
                ? "bg-green-500/10 border-green-500/20 text-green-600 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500"
                : "bg-muted border-border text-slate-400 hover:bg-green-500/10 hover:border-green-500/20 hover:text-green-500",
            )}
          >
            <span className="relative flex items-center justify-center w-[110px] min-h-[16px]">
              <span className="absolute inset-0 flex items-center justify-center gap-1.5 group-hover:opacity-0 group-hover:invisible transition-all">
                {isLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : effectivePaid ? (
                  <>
                    <Check size={12} />
                    Paid
                  </>
                ) : (
                  <>
                    <X size={12} />
                    Unpaid
                  </>
                )}
              </span>

              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 group-hover:visible transition-all",
                  effectivePaid ? "text-red-500" : "text-green-500",
                )}
              >
                {effectivePaid ? (
                  <>
                    <X size={12} />
                    Mark as Unpaid
                  </>
                ) : (
                  <>
                    <Check size={12} />
                    Mark as Paid
                  </>
                )}
              </span>
            </span>
          </button>
        );
      }

      default:
        return null;
    }
  };

  const getTotalForColumn = (key: ColumnKey): ReactNode => {
    switch (key) {
      case "rate":
        return peso(totals.rate);
      case "trips":
        return totals.trips;
      case "crewSalary":
        return peso(totals.crewSalary);
      case "cashAdvance":
        return peso(totals.cashAdvance);
      case "reimbursements":
        return peso(totals.reimbursements);
      case "expenses":
        return peso(totals.expenses);
      case "grossIncome":
        return peso(totals.grossIncome);
      case "netIncome":
        return peso(totals.netIncome);
      case "payable":
        return peso(totals.payable);
      default:
        return null;
    }
  };

  const colCount =
    (selectable ? 1 : 0) + columns.length + (showActions ? 1 : 0);

  return (
    <div className="border rounded-lg bg-background">
      {/* Desktop table */}
      <table
        className={cn(
          "w-full text-sm hidden md:table transition-opacity duration-150",
          !showActions && "report-table",
          isRefreshing && "opacity-70",
        )}
      >
        <thead>
          <tr>
            {selectable && (
              <th className="sticky top-[101px] z-50 bg-muted/60 backdrop-blur border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                />
              </th>
            )}
            {columns.map((col, idx) => {
              const column = table.getColumn(col.key);
              const sortState = column?.getIsSorted(); // false | "asc" | "desc"

              return (
                <th
                  key={col.key}
                  onClick={() =>
                    (col.sortField || col.key === "paid") &&
                    column?.toggleSorting()
                  }
                  className={cn(
                    "group sticky top-[101px] z-50 bg-muted/60 backdrop-blur border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-muted hover:text-foreground",
                    idx === 0 && !selectable && "left-0 z-20",
                    idx === 0 && selectable && "left-[40px] z-20",
                  )}
                >
                  <div className="inline-flex items-center justify-center gap-1 transition-colors group-hover:text-foreground">
                    {col.label}

                    {!sortState && (
                      <ArrowUpDown
                        size={12}
                        className="text-muted-foreground"
                      />
                    )}

                    {sortState === "asc" && (
                      <ArrowUp size={12} className="text-foreground" />
                    )}

                    {sortState === "desc" && (
                      <ArrowDown size={12} className="text-foreground" />
                    )}
                  </div>
                </th>
              );
            })}
            {showActions && (
              <th className="sticky top-[101px] z-50 bg-muted/60 backdrop-blur border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3 whitespace-nowrap">
                Actions
              </th>
            )}
            {!showActions && <th className="w-[1px] p-0" />}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={`skel-${i}`} columns={colCount} />
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colCount}>
                {emptyState || (
                  <EmptyState
                    icon={Route}
                    title="No trips found"
                    description="No trip records match your current filters."
                  />
                )}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => {
              const r = row.original;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-muted/50",
                    r.status === "Holiday" && "bg-muted/30",
                    r.status === "Day Off" &&
                      "bg-slate-50/80 dark:bg-slate-800/30 text-slate-400",
                    selectable && selectedIds.includes(r._id) && "bg-muted",
                  )}
                >
                  {selectable && (
                    <td className="sticky left-0 z-[5] bg-background text-center px-2.5 py-2.5 border-b border-border w-[40px] min-w-[40px] max-w-[40px]">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r._id)}
                        onChange={() => handleSelectRow(r._id)}
                        className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col, idx) => (
                    <td
                      key={col.key}
                      className={cn(
                        "text-center text-xs px-2.5 py-2.5 border-b border-border",
                        idx === 0 && !selectable && "sticky left-0 z-[5]",
                        idx === 0 && selectable && "sticky left-[40px] z-[5]",
                        col.className,
                      )}
                    >
                      {renderCell(col.key, r)}
                    </td>
                  ))}
                  {showActions && (
                    <td className="text-center text-xs px-2.5 py-2.5 border-b border-border">
                      <div className="flex items-center justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-[34px] h-[34px] rounded-md inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-background text-slate-600 hover:bg-muted transition-all">
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-[160px]"
                          >
                            {onEdit && (!canEditRow || canEditRow(r)) && (
                              <DropdownMenuItem onClick={() => onEdit(r)}>
                                <Pencil size={14} className="mr-2" /> Edit
                              </DropdownMenuItem>
                            )}
                            {onDuplicate && (
                              <DropdownMenuItem onClick={() => onDuplicate(r)}>
                                <Copy size={14} className="mr-2" /> Duplicate
                              </DropdownMenuItem>
                            )}
                            {onDelete && (!canDeleteRow || canDeleteRow(r)) && (
                              <DropdownMenuItem
                                onClick={() => onDelete(r)}
                                variant="destructive"
                              >
                                <Trash2 size={14} className="mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  )}
                  {!showActions && <td className="w-[1px] p-0" />}
                </tr>
              );
            })
          )}
        </tbody>

        <tfoot>
          <tr>
            {selectable && (
              <td className="sticky bottom-0 z-30 bg-muted border-t-2 border-border px-2.5 py-3" />
            )}
            {columns.map((col, idx) => {
              const isFirst = idx === 0;
              const totalVal = getTotalForColumn(col.key);
              const displayVal =
                totalVal !== null ? totalVal : isFirst ? "TOTALS" : "";
              return (
                <td
                  key={`total-${col.key}`}
                  className={cn(
                    "sticky bottom-0 z-30 bg-muted border-t-2 border-border text-center text-xs px-2.5 py-3 font-bold",
                    isFirst && !selectable && "left-0 z-[31]",
                    isFirst && selectable && "left-[40px] z-[31]",
                    col.key === "netIncome" &&
                      (totals.netIncome < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-700 dark:text-green-300"),
                    col.key === "payable" && "text-red-600 dark:text-red-400",
                  )}
                >
                  {displayVal}
                </td>
              );
            })}
            {showActions && (
              <td className="sticky bottom-0 z-30 bg-muted border-t-2 border-border px-2.5 py-3" />
            )}
          </tr>
        </tfoot>
      </table>

      <div className="mt-3 border-t border-border flex items-center justify-center">
        <Pagination
          currentPage={table.getState().pagination.pageIndex + 1}
          totalPages={table.getPageCount()}
          totalItems={rows.length}
          pageSize={table.getState().pagination.pageSize}
          onPageChange={(page) => table.setPageIndex(page - 1)}
          onPageSizeChange={(size) => table.setPageSize(size)}
        />
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden p-3">
        {selectable && rows.length > 0 && !loading && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500/20 cursor-pointer"
            />
            <span className="text-xs font-semibold text-muted-foreground">
              {allSelected ? "Deselect All" : "Select All"}
            </span>
          </div>
        )}
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`skel-card-${i}`}
              className="glass-card rounded-md border border-slate-200 dark:border-slate-700 p-4 animate-pulse"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <Skeleton className="h-4 w-24 mb-1.5" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-28 mb-3" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j}>
                    <Skeleton className="h-3 w-14 mb-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : rows.length === 0 ? (
          <div>
            {emptyState || (
              <EmptyState
                icon={Route}
                title="No trips found"
                description="No trip records match your current filters."
              />
            )}
          </div>
        ) : (
          rows.map((r) => (
            <TripCard
              key={r._id}
              r={r}
              showActions={showActions}
              reportMode={reportMode}
              onTogglePaid={onTogglePaid}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onExpenseClick={onExpenseClick}
              selectedTruck={selectedTruck}
              selectable={selectable}
              selected={selectedIds.includes(r._id)}
              onSelectToggle={handleSelectRow}
              showTruckColumn={truckVisible}
            />
          ))
        )}
      </div>
    </div>
  );
}
