import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { type TripRow } from "../../store/useAppStore";
import { peso, cn, pesoOrDash } from "../../lib/utils";
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
} from "lucide-react";
import EmptyState from "./EmptyState";
import { Skeleton, SkeletonTableRow } from "./Skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  | "payable";

type VisibleColumns = Partial<Record<ColumnKey, boolean>>;

type ColumnDef = {
  key: ColumnKey;
  label: string;
  sortField?: string;
  className?: string;
  render: (row: TripRow) => ReactNode;
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
  sortable?: boolean;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string) => void;
  emptyState?: ReactNode;
  showTruckColumn?: boolean;
  visibleColumns?: VisibleColumns;
  totalsRows?: TripRow[];
  canEditRow?: (row: TripRow) => boolean;
  canDeleteRow?: (row: TripRow) => boolean;
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "WORKING DAY")
    return "bg-green-500/10 text-green-500 border-green-500/20";
  if (s === "HOLIDAY")
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  return "bg-slate-400/10 text-slate-400 border-slate-400/20";
}

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
      if (e.key === "Escape") {
        cancel();
      }
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

  // ✅ DISPLAY LOGIC (ITO YUNG FIX)
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

function SortHeader({
  label,
  fieldKey,
  sortField,
  sortDirection,
  onSort,
}: {
  label: string;
  fieldKey: string | undefined;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string) => void;
}) {
  if (!fieldKey || !onSort) {
    return <span>{label}</span>;
  }

  const isActive = sortField === fieldKey;

  return (
    <button
      onClick={() => onSort(fieldKey)}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors group"
    >
      {label}
      {isActive ? (
        sortDirection === "asc" ? (
          <ArrowUp size={12} className="text-foreground" />
        ) : (
          <ArrowDown size={12} className="text-foreground" />
        )
      ) : (
        <ArrowUpDown
          size={12}
          className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400"
        />
      )}
    </button>
  );
}

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
          <div className="font-semibold">{peso(r.reimbursements)}</div>
        </div>
        {r.expenses > 0 && (
          <div>
            <div className="text-slate-500">Expenses</div>
            <div className="font-semibold">{peso(r.expenses)}</div>
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
  sortable = false,
  sortField,
  sortDirection,
  onSort,
  emptyState,
  showTruckColumn = false,
  visibleColumns = {},
  canEditRow,
  canDeleteRow,
  onVerificationChange,
}: TripTableProps) {
  const totalsSource = totalsRows ?? rows;

  const totals = useMemo(() => {
    return totalsSource.reduce(
      (acc, r) => {
        acc.rate += Number(r.rate || 0);
        acc.trips += Number(r.trips || 0);
        acc.crewSalary += Number(r.crewSalary || 0);
        acc.cashAdvance += Number(r.cashAdvance || 0);
        acc.reimbursements += Number(r.reimbursements || 0);
        acc.expenses += Number(r.expenses || 0);
        acc.grossIncome += Number(r.grossIncome || 0);
        acc.netIncome += Number(
          reportMode ? (r.reportNetIncome ?? r.netIncome) : r.netIncome,
        );
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

  const netValueFor = (r: TripRow) =>
    reportMode ? (r.reportNetIncome ?? r.netIncome) : r.netIncome;
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

  const renderTripsCell = (value: number) => {
    const v = Number(value || 0);
    return v === 0 ? (
      <span className="text-slate-300 dark:text-slate-600">—</span>
    ) : (
      v
    );
  };

  const columns: ColumnDef[] = [];
  if (show("week"))
    columns.push({
      key: "week",
      label: "Week",
      render: (r) => r.week,
    });
  if (show("date"))
    columns.push({
      key: "date",
      label: "Date",
      sortField: "dateIso",
      render: (r) => r.dateText,
    });
  if (truckVisible)
    columns.push({
      key: "truck",
      label: "Truck",
      render: (r) => r.truckName || "—",
      className: "font-semibold text-blue-600 dark:text-blue-400",
    });
  if (show("status"))
    columns.push({
      key: "status",
      label: "Status",
      render: (r) => (
        <span
          className={cn(
            "inline-block px-2.5 py-1 rounded-full text-[10px] font-bold leading-none border whitespace-nowrap",
            statusBadge(r.status),
          )}
        >
          {r.status.toUpperCase()}
        </span>
      ),
    });
  if (show("shipmentNumber"))
    columns.push({
      key: "shipmentNumber",
      label: "Shipment #",
      render: (r) => {
        const status = r.verificationStatus || "For Confirmation";

        const getIcon = () => {
          switch (status) {
            case "Verified":
              return <CheckCircle size={14} className="text-green-500" />;
            case "Pending":
              return <AlertCircle size={14} className="text-orange-500" />;
            default:
              return <HelpCircle size={14} className="text-gray-400" />;
          }
        };

        return (
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center justify-start gap-1.5 w-full cursor-pointer rounded px-1 py-0.5 transition hover:brightness-50",
                        r.verificationStatus === "Verified" && "text-green-500",
                        r.verificationStatus === "Pending" && "text-orange-500",
                        (!r.verificationStatus ||
                          r.verificationStatus === "For Confirmation") &&
                          "text-gray-400",
                      )}
                    >
                      {r.shipmentNumber ? (
                        <>
                          {getIcon()}
                          {r.shipmentNumber}
                        </>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">
                          —
                        </span>
                      )}
                    </div>
                  </DropdownMenuTrigger>
                </TooltipTrigger>

                <TooltipContent className="bg-neutral-200 text-neutral-950 dark:bg-neutral-50 [&_svg]:bg-neutral-200 [&_svg]:fill-neutral-200 dark:[&_svg]:bg-neutral-50 dark:[&_svg]:fill-neutral-50">
                  {r.verificationStatus === "Verified"
                    ? "Shipment Number is verified"
                    : r.verificationStatus === "Pending"
                      ? "Shipment Number is pending"
                      : "Shipment Number needs confirmation"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenuContent align="center" className="min-w-[180px]">
              <DropdownMenuItem
                onClick={() => onVerificationChange?.(r._id, "Verified")}
              >
                <CheckCircle size={14} className="mr-2 text-green-500" />
                Verified
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onVerificationChange?.(r._id, "Pending")}
              >
                <AlertCircle size={14} className="mr-2 text-orange-500" />
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
        );
      },
      className: "font-semibold",
    });
  if (show("rate"))
    columns.push({
      key: "rate",
      label: "Rate",
      sortField: "rate",
      render: (r) =>
        onQuickEdit ? (
          <EditableCell
            rowId={r._id}
            field="rate"
            value={r.rate}
            onSave={onQuickEdit}
          />
        ) : (
          renderMoneyCell(r.rate)
        ),
    });
  if (show("trips"))
    columns.push({
      key: "trips",
      label: "Trips",
      sortField: "trips",
      render: (r) => {
        const tripsValue = Number(r.trips ?? 0);

        return onQuickEdit ? (
          <EditableCell
            rowId={r._id}
            field="trips"
            value={r.trips}
            onSave={onQuickEdit}
          />
        ) : tripsValue === 0 ? (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        ) : (
          tripsValue
        );
      },
    });
  if (show("crewSalary"))
    columns.push({
      key: "crewSalary",
      label: "Crew Salary",
      sortField: "crewSalary",
      render: (r) =>
        onQuickEdit ? (
          <EditableCell
            rowId={r._id}
            field="crewSalary"
            value={r.crewSalary}
            onSave={onQuickEdit}
          />
        ) : (
          renderMoneyCell(r.crewSalary)
        ),
    });
  if (show("cashAdvance"))
    columns.push({
      key: "cashAdvance",
      label: "Cash Adv.",
      render: (r) => renderMoneyCell(r.cashAdvance),
    });

  if (show("reimbursements"))
    columns.push({
      key: "reimbursements",
      label: "Cr. Reimb.",
      render: (r) => renderMoneyCell(r.reimbursements),
    });

  if (show("expenses"))
    columns.push({
      key: "expenses",
      label: "Expenses",
      render: (r) => renderMoneyCell(r.expenses),
    });
  if (show("note"))
    columns.push({
      key: "note",
      label: "Note",
      render: (r) =>
        onExpenseClick && (r.hasExpenses || r.expenses > 0 || r.note) ? (
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
        ),
      className: "max-w-[120px]",
    });
  if (show("grossIncome"))
    columns.push({
      key: "grossIncome",
      label: "Gross",
      sortField: "grossIncome",
      render: (r) => peso(r.grossIncome),
    });
  if (show("netIncome"))
    columns.push({
      key: "netIncome",
      label: "Net",
      sortField: "netIncome",
      render: (r) => {
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
      },
    });

  if (show("payable"))
    columns.push({
      key: "payable",
      label: "Payable",
      sortField: "payable",
      render: (r) => (
        <span className="text-red-500 font-semibold">
          {displayPayableFor(r)}
        </span>
      ),
    });

  columns.push({
    key: "paid" as ColumnKey,
    label: "Paid",
    render: (r) => (
      <button
        onClick={() => onTogglePaid?.(r._id)}
        className={cn(
          "px-3 py-1.5 rounded-md inline-flex cursor-pointer hover:bg-muted/50 items-center gap-1.5 text-xs border transition-all",
          r.paid
            ? "bg-green-500/10 border-green-500/20 text-green-600"
            : "bg-muted border-border text-slate-400 hover:bg-green-500/10 hover:text-green-500",
        )}
      >
        {r.paid ? (
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
      </button>
    ),
  });

  const colCount =
    (selectable ? 1 : 0) + columns.length + (showActions ? 1 : 0);

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
      const merged = [...new Set([...selectedIds, ...visibleIds])];
      onSelectionChange(merged);
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

  const renderVerificationBadge = (
    r: TripRow,
    onChange?: (id: string, value: string) => void,
  ) => {
    const status = r.verificationStatus || "Pending";

    const getBadge = () => {
      switch (status) {
        case "Verified":
          return (
            <Badge
              variant="outline"
              className="rounded-sm border-green-600 text-green-600 dark:border-green-400 dark:text-green-400 [a&]:hover:bg-green-600/10 [a&]:hover:text-green-600/90 dark:[a&]:hover:bg-green-400/10 dark:[a&]:hover:text-green-400/90"
            >
              <CheckCircle size={14} /> Verified
            </Badge>
          );
        case "Pending":
          return (
            <Badge
              variant="outline"
              className="rounded-sm border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400 [a&]:hover:bg-amber-600/10 [a&]:hover:text-amber-600/90 dark:[a&]:hover:bg-amber-400/10 dark:[a&]:hover:text-amber-400/90"
            >
              <AlertCircle size={14} /> Pending
            </Badge>
          );
        default:
          return (
            <Badge
              variant="outline"
              className="rounded-sm border-gray-600 text-gray-600 dark:border-gray-400 dark:text-gray-400 [a&]:hover:bg-gray-600/10 [a&]:hover:text-gray-600/90 dark:[a&]:hover:bg-gray-400/10 dark:[a&]:hover:text-gray-400/90"
            >
              <HelpCircle size={14} /> For Confirmation
            </Badge>
          );
      }
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{getBadge()}</DropdownMenuTrigger>

        <DropdownMenuContent align="center" className="w-[180px]">
          <DropdownMenuItem onClick={() => onChange?.(r._id, "Verified")}>
            <CheckCircle size={14} className="mr-2 text-green-500" />
            Verified
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => onChange?.(r._id, "Pending")}>
            <AlertCircle size={14} className="mr-2 text-orange-500" />
            Pending
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onChange?.(r._id, "For Confirmation")}
          >
            <HelpCircle size={14} className="mr-2 text-gray-500" />
            For Confirmation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="border rounded-lg bg-background">
      <table
        className={cn(
          "w-full text-sm hidden md:table",
          !showActions && "report-table",
        )}
      >
        <thead>
          <tr>
            {selectable && (
              <th className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3 whitespace-nowrap">
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
            {columns.map((col, idx) => (
              <th
                key={col.key}
                className={cn(
                  "sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3 whitespace-nowrap",
                  idx === 0 && !selectable && "left-0 z-20",
                  idx === 0 && selectable && "left-[40px] z-20",
                )}
              >
                {sortable ? (
                  <SortHeader
                    label={col.label}
                    fieldKey={col.sortField}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={onSort}
                  />
                ) : (
                  col.label
                )}
              </th>
            ))}
            {showActions && (
              <th className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3 whitespace-nowrap">
                Actions
              </th>
            )}
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
            rows.map((r) => {
              return (
                <tr
                  key={r._id}
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
                        idx === 0 &&
                          !selectable &&
                          "sticky left-0 z-[5] bg-background",
                        idx === 0 &&
                          selectable &&
                          "sticky left-[40px] z-[5] bg-background",
                        col.className,
                      )}
                    >
                      {col.render(r)}
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
                                <Trash2 size={14} className="mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  )}
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
              const value =
                col.key === "rate"
                  ? peso(totals.rate)
                  : col.key === "trips"
                    ? totals.trips
                    : col.key === "crewSalary"
                      ? peso(totals.crewSalary)
                      : col.key === "cashAdvance"
                        ? peso(totals.cashAdvance)
                        : col.key === "reimbursements"
                          ? peso(totals.reimbursements)
                          : col.key === "expenses"
                            ? peso(totals.expenses)
                            : col.key === "grossIncome"
                              ? peso(totals.grossIncome)
                              : col.key === "netIncome"
                                ? peso(totals.netIncome)
                                : col.key === "payable"
                                  ? peso(totals.payable)
                                  : isFirst
                                    ? "TOTALS"
                                    : "";

              return (
                <td
                  key={`total-${col.key}`}
                  className={cn(
                    "sticky bottom-0 z-30 bg-muted border-t-2 border-border text-center text-xs px-2.5 py-3 font-bold",
                    idx === 0 && !selectable && "left-0 z-[31]",
                    idx === 0 && selectable && "left-[40px] z-[31]",
                    col.key === "netIncome" &&
                      (totals.netIncome < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-700 dark:text-green-300"),
                    col.key === "payable" && "text-red-600 dark:text-red-400",
                  )}
                >
                  {value}
                </td>
              );
            })}

            {showActions && (
              <td className="sticky bottom-0 z-30 bg-muted border-t-2 border-border px-2.5 py-3" />
            )}
          </tr>
        </tfoot>
      </table>

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
