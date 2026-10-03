import {
  Fragment,
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
import {
  useAppStore,
  type TripRow,
  type ExpenseRow,
} from "../../store/useAppStore";
import { peso, cn } from "../../lib/utils";
import { getColumnLabels } from "../../lib/columnLabels";
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
  CircleCheck,
  AlertCircle,
  HelpCircle,
  CheckCheck,
  ChevronRight,
  ChevronDown,
  Receipt,
} from "lucide-react";
import EmptyState from "./EmptyState";
import { SkeletonTableRow } from "./Skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Pagination from "../shared/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

type ColumnKey =
  | "truck"
  | "week"
  | "date"
  | "status"
  | "shipmentNumber"
  | "verification"
  | "rate"
  | "vat"
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
  expenseRows?: ExpenseRow[];
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
  expandableDetails?: boolean;
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
      "w-full text-xs text-left bg-white dark:bg-slate-800 border border-blue-400 rounded-md px-1.5 py-1 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all";
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
// TripTable
// ---------------------------------------------------------------------------

export default function TripTable({
  rows,
  expenseRows = [],
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
  expandableDetails = false,
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
    pageSize: 10,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    () => new Set(),
  );

  const [highlightedExpenseRow, setHighlightedExpenseRow] = useState<
    string | null
  >(null);
  const { truckOptions } = useAppStore();

  const toggleExpandedRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [columnLabels, setColumnLabels] = useState(getColumnLabels());
  const totalsSource = totalsRows ?? rows;

  const selectedTruckName = truckOptions.find(
    (t) => t._id === selectedTruck,
  )?.truckName;

  const getExpenseOwnerForTrip = (trip: TripRow) => {
    const tripTruckId =
      typeof trip.truck === "string" ? trip.truck : trip.truck?._id || "";

    return (
      rows.find((row) => {
        if (row._id === trip._id) return false;

        const rowTruckId =
          typeof row.truck === "string" ? row.truck : row.truck?._id || "";

        return (
          rowTruckId === tripTruckId &&
          row.dateIso === trip.dateIso &&
          (row.expenseItems?.length || 0) > 0
        );
      }) ?? null
    );
  };

  const jumpToExpenseOwner = (ownerId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.add(ownerId);
      return next;
    });

    setHighlightedExpenseRow(ownerId);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`trip-details-${ownerId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    });

    window.setTimeout(() => {
      setHighlightedExpenseRow((current) =>
        current === ownerId ? null : current,
      );
    }, 1800);
  };

  const totals = useMemo(() => {
    return totalsSource.reduce(
      (acc, r) => {
        const reimbursements = Number(r.reimbursements || 0);
        const expenses = Number(r.expenses || 0);

        acc.rate += Number(r.rate || 0);
        acc.vat += Number(r.vat || 0);
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

        acc.netIncome += baseNet;

        acc.payable += Number(
          reportMode ? (r.reportPayable ?? r.payable) : r.payable,
        );

        return acc;
      },
      {
        rate: 0,
        vat: 0,
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
  const isNumericColumn = (key: ColumnKey) =>
    ["rate", "vat", "grossIncome", "netIncome", "payable"].includes(key);
  const truckVisible = showTruckColumn && show("truck");

  const netValueFor = (r: TripRow) =>
    Number(reportMode ? (r.reportNetIncome ?? r.netIncome) : r.netIncome);
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
        label: columnLabels.shipmentNumber,
        sortField: "shipmentNumber",
        className: "w-0 whitespace-nowrap",
      });
    if (show("rate"))
      cols.push({
        key: "rate",
        label: "Adjusted Rate",
        sortField: "rate",
      });
    if (show("vat"))
      cols.push({
        key: "vat",
        label: "VAT",
        sortField: "vat",
      });
    if (show("trips"))
      cols.push({ key: "trips", label: "Trips", sortField: "trips" });
    if (!expandableDetails && show("crewSalary"))
      cols.push({
        key: "crewSalary",
        label: "Crew Salary",
        sortField: "crewSalary",
      });

    if (!expandableDetails && show("cashAdvance"))
      cols.push({
        key: "cashAdvance",
        label: columnLabels.cashAdvance,
      });

    if (!expandableDetails && show("reimbursements"))
      cols.push({
        key: "reimbursements",
        label: "Cr. Reimb.",
      });

    if (!expandableDetails && show("expenses"))
      cols.push({
        key: "expenses",
        label: "Expenses",
      });

    if (!expandableDetails && show("note"))
      cols.push({
        key: "note",
        label: "Note",
      });
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
    cols.push({ key: "paid", label: "Crew Payment" });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truckVisible, visibleColumns, columnLabels]);

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

            case "vat":
              return row.vat;

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

      case "date": {
        const isExpanded = expandedRows.has(r._id);
        const hasExpenses =
          Boolean(r.hasExpenses) || Number(r.expenses || 0) > 0;

        const shortDate = new Date(`${r.dateIso}T00:00:00`).toLocaleDateString(
          "en-US",
          {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          },
        );

        return expandableDetails ? (
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpandedRow(r._id);
              }}
              className="inline-flex items-center gap-1.5 font-medium hover:text-blue-600 transition-colors"
              title={isExpanded ? "Hide details" : "Show details"}
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={14} className="text-muted-foreground" />
              )}

              {shortDate}
            </button>

            {hasExpenses && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center justify-center text-blue-500 cursor-help">
                    <Receipt size={14} />
                  </span>
                </TooltipTrigger>

                <TooltipContent>
                  <div className="text-xs">
                    <div className="font-semibold">Expenses recorded</div>
                    <div className="opacity-80">
                      {peso(Number(r.expenses || 0))} total
                    </div>
                    <div className="opacity-60 mt-0.5">
                      Expand this trip to view details
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          shortDate
        );
      }

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

        const StatusIcon =
          status === "Verified"
            ? CircleCheck
            : status === "Pending"
              ? AlertCircle
              : HelpCircle;

        return r.shipmentNumber ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "-mx-2 h-8 justify-start gap-2 px-2 text-xs font-normal",
                  status === "Verified" && "text-blue-600 dark:text-blue-400",
                  status === "Pending" && "text-orange-500",
                  status === "For Confirmation" && "text-muted-foreground",
                )}
              >
                <StatusIcon className="size-3.5" />
                {r.shipmentNumber}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem
                onClick={() => onVerificationChange?.(r._id, "Verified")}
              >
                <CircleCheck className="size-4" />
                Verified
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onVerificationChange?.(r._id, "Pending")}
              >
                <AlertCircle className="size-4" />
                Pending
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() =>
                  onVerificationChange?.(r._id, "For Confirmation")
                }
              >
                <HelpCircle className="size-4" />
                For Confirmation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      }

      case "rate":
        return renderMoneyCell(r.rate);

      case "vat":
        return renderMoneyCell(r.vat);

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
        return renderMoneyCell(r.crewSalary);

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
                <div className="flex items-center justify-start gap-1.5">
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
              netValue < 0
                ? "text-red-500"
                : "text-green-700 dark:text-green-400",
            )}
          >
            {peso(netValue)}
          </span>
        );
      }

      case "payable":
        return <span className="text-red-500">{displayPayableFor(r)}</span>;

      case "paid": {
        const isLoading = loadingId === r._id;
        const effectivePaid = isLoading ? !r.paid : r.paid;

        return (
          <Button
            variant="outline"
            size="sm"
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
              "group min-w-[136px] text-xs font-normal",
              effectivePaid
                ? "border-green-500/30 bg-green-500/10 text-green-600 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                : "text-muted-foreground hover:border-green-500/30 hover:bg-green-500/10 hover:text-green-600 dark:hover:border-green-500/40 dark:hover:bg-green-500/10 dark:hover:text-green-400",
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 group-hover:hidden">
                  {effectivePaid ? (
                    <Check className="size-3.5" />
                  ) : (
                    <X className="size-3.5" />
                  )}

                  {effectivePaid ? "Settled" : "Unsettled"}
                </span>

                <span className="hidden items-center gap-1.5 group-hover:flex">
                  {effectivePaid ? (
                    <>
                      <X className="size-3.5" />
                      Set as Unsettled
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      Set as Settled
                    </>
                  )}
                </span>
              </>
            )}
          </Button>
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
      case "vat":
        return peso(totals.vat);
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
    <div className="[&>div]:max-h-[calc(100vh-280px)] [&>div]:overflow-auto">
      {/* Desktop table */}
      <Table
        className={cn(
          "text-sm transition-opacity duration-150",
          !showActions && "report-table",
          isRefreshing && "opacity-70",
        )}
      >
        <TableHeader>
          <TableRow className="sticky top-0 z-20 bg-background hover:bg-background">
            {selectable && (
              <TableHead className="w-12 pl-4 pr-2 whitespace-nowrap">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? "indeterminate" : false
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all trips"
                />
              </TableHead>
            )}
            {columns.map((col, idx) => {
              const column = table.getColumn(col.key);
              const sortState = column?.getIsSorted(); // false | "asc" | "desc"

              return (
                <TableHead
                  key={col.key}
                  className={cn(
                    "h-10 whitespace-nowrap text-sm font-medium",
                    col.key === "paid"
                      ? "text-center"
                      : isNumericColumn(col.key)
                        ? "text-right"
                        : "text-left",
                  )}
                >
                  <div
                    className={cn(
                      "flex w-full items-center",
                      col.key === "paid"
                        ? "justify-center"
                        : isNumericColumn(col.key)
                          ? "justify-end"
                          : "justify-start",
                    )}
                    onDoubleClick={() => {
                      if (
                        col.key === "shipmentNumber" ||
                        col.key === "cashAdvance"
                      ) {
                        setEditingLabel(col.key);
                        setLabelDraft(col.label);
                      }
                    }}
                  >
                    {editingLabel === col.key ? (
                      <input
                        value={labelDraft}
                        autoFocus
                        onChange={(e) => setLabelDraft(e.target.value)}
                        onBlur={() => {
                          const updated = {
                            ...columnLabels,
                            [col.key]: labelDraft,
                          };
                          localStorage.setItem(
                            "column-labels",
                            JSON.stringify(updated),
                          );
                          setColumnLabels(updated);
                          setEditingLabel(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const updated = {
                              ...columnLabels,
                              [col.key]: labelDraft,
                            };
                            localStorage.setItem(
                              "column-labels",
                              JSON.stringify(updated),
                            );
                            setColumnLabels(updated);
                            setEditingLabel(null);
                          }
                          if (e.key === "Escape") {
                            setEditingLabel(null);
                          }
                        }}
                        className="text-xs px-1 border rounded bg-background text-left"
                      />
                    ) : col.sortField || col.key === "paid" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-mx-2 h-8 gap-1.5 px-2 text-xs font-medium"
                        onClick={() => column?.toggleSorting()}
                      >
                        {col.label}

                        {sortState === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : sortState === "desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ArrowUpDown className="size-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    ) : (
                      <span>{col.label}</span>
                    )}
                  </div>
                </TableHead>
              );
            })}
            {showActions && (
              <TableHead className="w-16 pl-2 pr-4 text-center text-xs font-medium">
                Actions
              </TableHead>
            )}
            {!showActions && <TableHead className="w-px p-0" />}
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={`skel-${i}`} columns={colCount} />
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount}>
                {emptyState || (
                  <EmptyState
                    icon={Route}
                    title="No Trips Found!"
                    description={`No trips recorded for ${selectedTruckName} on the selected date range.`}
                  />
                )}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row, rowIndex) => {
              const r = row.original;
              const tripExpenses = r.expenseItems || [];

              const expenseOwner = getExpenseOwnerForTrip(r);

              const hasExpenseElsewhere =
                expenseOwner && expenseOwner._id !== r._id;

              return (
                <Fragment key={row.id}>
                  <TableRow
                    onClick={(e) => {
                      if (!expandableDetails) return;

                      const target = e.target as HTMLElement;

                      if (
                        target.closest(
                          "button, input, select, textarea, a, [role='menuitem'], [role='menu'], [data-no-row-expand]",
                        )
                      ) {
                        return;
                      }

                      toggleExpandedRow(r._id);
                    }}
                    className={cn(
                      expandableDetails && "cursor-pointer",
                      expandedRows.has(r._id) &&
                        "relative z-[1] bg-muted/50 shadow-md dark:shadow-[0_4px_10px_-4px_rgba(255,255,255,0.08)]",
                      r.status === "Holiday" && "bg-muted/30",
                      r.status === "Day Off" && "text-muted-foreground",
                      selectable && selectedIds.includes(r._id) && "bg-muted",
                    )}
                  >
                    {selectable && (
                      <TableCell className="w-12 pl-4 pr-2">
                        <Checkbox
                          checked={selectedIds.includes(r._id)}
                          onCheckedChange={() => handleSelectRow(r._id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select trip ${r.dateText}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((col, idx) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          "text-xs",
                          col.key === "paid"
                            ? "text-center"
                            : isNumericColumn(col.key)
                              ? "text-right tabular-nums whitespace-nowrap"
                              : "text-left",
                          col.className,
                        )}
                      >
                        {renderCell(col.key, r)}
                      </TableCell>
                    ))}
                    {showActions && (
                      <TableCell className="w-16 pl-2 pr-4 text-center">
                        <div className="flex items-center justify-center w-full">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Open trip actions"
                              >
                                <MoreVertical className="size-4" />
                              </Button>
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
                                <DropdownMenuItem
                                  onClick={() => onDuplicate(r)}
                                >
                                  <Copy size={14} className="mr-2" /> Duplicate
                                </DropdownMenuItem>
                              )}
                              {onDelete &&
                                (!canDeleteRow || canDeleteRow(r)) && (
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
                      </TableCell>
                    )}
                    {!showActions && <TableCell className="w-px p-0" />}
                  </TableRow>
                  {expandableDetails && expandedRows.has(r._id) && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={colCount}
                        className="bg-muted/30 px-4 py-2"
                      >
                        <div
                          id={`trip-details-${r._id}`}
                          className={cn(
                            "relative ml-2 pl-4 transition-all duration-300",
                            highlightedExpenseRow === r._id &&
                              "rounded-lg bg-blue-500/10 ring-2 ring-blue-500/30",
                          )}
                        >
                          {/* EXPANDED INDICATOR — KEEP */}
                          <span className="absolute inset-y-0 left-0 w-[2px] rounded-full bg-red-500/70" />

                          {/* HEADER */}
                          <div className="mb-2.5 flex flex-wrap items-center gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(
                                    `${r.dateIso}T00:00:00`,
                                  ).toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>

                                <span className="text-muted-foreground/50">
                                  ·
                                </span>

                                <span className="text-xs text-muted-foreground">
                                  {columnLabels.shipmentNumber}:{" "}
                                  <span className="font-medium text-foreground">
                                    {r.shipmentNumber || "N/A"}
                                  </span>
                                </span>

                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "shrink-0 text-xs font-normal",
                                    r.status === "Working Day" &&
                                      "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
                                    r.status === "Holiday" &&
                                      "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                    r.status !== "Working Day" &&
                                      r.status !== "Holiday" &&
                                      "text-muted-foreground",
                                  )}
                                >
                                  {r.status || "N/A"}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* DETAILS */}
                          <div className="grid gap-x-8 gap-y-2.5 lg:grid-cols-[160px_160px_160px_minmax(260px,1fr)]">
                            {/* COLUMN 1 */}
                            <div className="space-y-2.5">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  Original Rate
                                </p>
                                <p className="text-xs font-medium tabular-nums">
                                  {peso(Number(r.originalRate || r.rate || 0))}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  Rate Adjustment
                                </p>
                                <p className="text-xs font-medium tabular-nums">
                                  {r.rateAdjustmentType === "amount" &&
                                  Number(r.rateAdjustment || 0) > 0
                                    ? peso(Number(r.rateAdjustment))
                                    : r.rateAdjustmentType === "percentage" &&
                                        Number(r.rateAdjustment || 0) > 0
                                      ? `${Number(
                                          r.rateAdjustment,
                                        ).toLocaleString("en-PH", {
                                          maximumFractionDigits: 2,
                                        })}%`
                                      : "—"}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  Adjusted Rate
                                </p>
                                <p className="text-xs font-medium tabular-nums">
                                  {peso(Number(r.rate || 0))}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  VAT
                                </p>
                                <p className="text-xs font-medium tabular-nums">
                                  {peso(Number(r.vat || 0))}
                                </p>
                              </div>
                            </div>

                            {/* COLUMN 2 */}
                            <div className="space-y-2.5">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  Crew Salary
                                </p>
                                <p className="text-xs font-medium tabular-nums">
                                  {peso(Number(r.crewSalary || 0))}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <div
                                  onDoubleClick={() => {
                                    setEditingLabel("cashAdvance");
                                    setLabelDraft(columnLabels.cashAdvance);
                                  }}
                                  className="text-xs text-muted-foreground"
                                  title="Double-click to rename"
                                >
                                  {editingLabel === "cashAdvance" ? (
                                    <input
                                      value={labelDraft}
                                      autoFocus
                                      onChange={(e) =>
                                        setLabelDraft(e.target.value)
                                      }
                                      onBlur={() => {
                                        const updated = {
                                          ...columnLabels,
                                          cashAdvance:
                                            labelDraft.trim() || "Allowance",
                                        };

                                        localStorage.setItem(
                                          "column-labels",
                                          JSON.stringify(updated),
                                        );

                                        setColumnLabels(updated);
                                        setEditingLabel(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          const updated = {
                                            ...columnLabels,
                                            cashAdvance:
                                              labelDraft.trim() || "Allowance",
                                          };

                                          localStorage.setItem(
                                            "column-labels",
                                            JSON.stringify(updated),
                                          );

                                          setColumnLabels(updated);
                                          setEditingLabel(null);
                                        }

                                        if (e.key === "Escape") {
                                          setEditingLabel(null);
                                        }
                                      }}
                                      onDoubleClick={(e) => e.stopPropagation()}
                                      className="h-7 w-[120px] rounded-md border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                  ) : (
                                    <span className="cursor-pointer hover:text-foreground">
                                      {columnLabels.cashAdvance}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs font-medium tabular-nums">
                                  {peso(Number(r.cashAdvance || 0))}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  Crew Reimbursement
                                </p>

                                <div className="flex items-center gap-1.5 text-xs font-medium tabular-nums">
                                  {r.paid &&
                                    Number(r.reimbursements || 0) > 0 && (
                                      <CheckCheck className="size-3.5 text-green-500" />
                                    )}

                                  <span
                                    className={cn(
                                      r.paid &&
                                        Number(r.reimbursements || 0) > 0 &&
                                        "text-muted-foreground line-through",
                                    )}
                                  >
                                    {peso(Number(r.reimbursements || 0))}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* COLUMN 3 */}
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">
                                Expense Amount
                              </p>

                              <p
                                className={cn(
                                  "text-xs font-medium tabular-nums",
                                  Number(r.expenses || 0) > 0 &&
                                    "text-blue-600 dark:text-blue-400",
                                )}
                              >
                                {peso(Number(r.expenses || 0))}
                              </p>
                            </div>

                            {/* COLUMN 4 — EXPENSE BREAKDOWN */}
                            <div className="min-w-0 space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Expense Breakdown
                              </p>

                              {tripExpenses.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const truckId =
                                      typeof r.truck === "string"
                                        ? r.truck
                                        : r.truck?._id || selectedTruck;

                                    onExpenseClick?.({
                                      truckId,
                                      dateIso: r.dateIso,
                                      dateText: r.dateText,
                                    });
                                  }}
                                  className="group flex w-full max-w-[380px] flex-col gap-1.5 text-left"
                                >
                                  {tripExpenses.map((expense) => (
                                    <div
                                      key={expense._id}
                                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 text-xs"
                                    >
                                      <span
                                        className={cn(
                                          "truncate group-hover:underline",
                                          expense.reimbursed
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-blue-600 dark:text-blue-400",
                                        )}
                                      >
                                        {expense.category
                                          .trim()
                                          .toUpperCase() === "REIMBURSEMENT"
                                          ? "REIMB."
                                          : expense.category}

                                        {expense.description &&
                                        !(
                                          expense.category
                                            .trim()
                                            .toUpperCase() ===
                                            "REIMBURSEMENT" &&
                                          expense.reimbursed
                                        )
                                          ? `: ${expense.description}`
                                          : ""}

                                        {expense.reimbursed
                                          ? " (Reimbursed by Client)"
                                          : ""}
                                      </span>

                                      <span className="whitespace-nowrap font-medium tabular-nums text-foreground">
                                        {peso(Number(expense.amount || 0))}
                                      </span>
                                    </div>
                                  ))}
                                </button>
                              ) : hasExpenseElsewhere && expenseOwner ? (
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    jumpToExpenseOwner(expenseOwner._id);
                                  }}
                                  className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  View this date&apos;s expense breakdown →
                                </Button>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  —
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>

        <TableFooter>
          <TableRow>
            {selectable && <TableCell />}
            {columns.map((col, idx) => {
              const isFirst = idx === 0;
              const totalVal = getTotalForColumn(col.key);
              const displayVal =
                totalVal !== null ? totalVal : isFirst ? "TOTALS" : "";
              return (
                <TableCell
                  key={`total-${col.key}`}
                  className={cn(
                    "text-xs font-medium",
                    col.key === "paid"
                      ? "text-center"
                      : isNumericColumn(col.key)
                        ? "text-right tabular-nums"
                        : "text-left",
                    col.key === "netIncome" &&
                      (totals.netIncome < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-700 dark:text-green-400"),
                    col.key === "payable" && "text-red-600 dark:text-red-400",
                  )}
                >
                  {displayVal}
                </TableCell>
              );
            })}
            {showActions && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>

      <div className="border-t border-border">
        <Pagination
          currentPage={table.getState().pagination.pageIndex + 1}
          totalPages={table.getPageCount()}
          totalItems={rows.length}
          pageSize={table.getState().pagination.pageSize}
          onPageChange={(page) => table.setPageIndex(page - 1)}
          onPageSizeChange={(size) => table.setPageSize(size)}
        />
      </div>
    </div>
  );
}
