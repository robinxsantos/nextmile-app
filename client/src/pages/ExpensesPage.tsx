import { useEffect, useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppStore, type ExpenseRow } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { peso, toInputDate, cn } from "../lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Check,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ReceiptText,
  Calendar as CalendarIcon,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Pagination from "../components/shared/Pagination";
import EmptyState from "../components/shared/EmptyState";
import { getExpenseBreakdown } from "../lib/expenseSummary";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

const DEFAULT_CATEGORIES = [
  "FUEL",
  "MAINT.",
  "TOLL",
  "INSURANCE",
  "REGISTRATION",
];

const REIMBURSABLE_CATEGORIES = new Set(["FUEL", "TOLL", "PARKING/PASSWAY"]);

function isReimbursableCategory(category?: string) {
  return REIMBURSABLE_CATEGORIES.has((category || "").trim().toUpperCase());
}

const MONTH_OPTIONS = [
  { value: "ALL", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function ExpensesPage() {
  const {
    expenseRows,
    selectedTruck,
    setSelectedTruck,
    truckOptions,
    expensesMonth,
    setExpensesMonth,
    fetchExpenseCategories,
    fetchExpenses,
    initApp,
    addExpense,
    updateExpense,
    deleteExpense,
    toggleExpenseReimbursed,
    expenseCategories,
  } = useAppStore();
  const { user } = useAuthStore();

  const canManageExpenses = user?.role === "admin" || user?.role === "manager";
  const [expenseModal, setExpenseModal] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [editRow, setEditRow] = useState<ExpenseRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<ExpenseRow | null>(null);
  const [showTruckWarning, setShowTruckWarning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "date",
      desc: true,
    },
  ]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [openCategory, setOpenCategory] = useState(false);
  const [openTruck, setOpenTruck] = useState(false);
  const [openMonth, setOpenMonth] = useState(false);

  const [openFormCategory, setOpenFormCategory] = useState(false);
  const [formCategorySearch, setFormCategorySearch] = useState("");
  const [form, setForm] = useState({
    date: toInputDate(new Date()),
    category: "",
    amount: "",
    description: "",
  });

  useEffect(() => {
    if (canManageExpenses) {
      initApp();
    }
  }, [initApp, canManageExpenses]);

  useEffect(() => {
    if (canManageExpenses) {
      const currentMonth = String(new Date().getMonth() + 1);
      setExpensesMonth(currentMonth);
    }
  }, [canManageExpenses, setExpensesMonth]);

  useEffect(() => {
    if (canManageExpenses) {
      fetchExpenses();
    }
  }, [fetchExpenses, expensesMonth, selectedTruck, canManageExpenses]);

  useEffect(() => {
    if (canManageExpenses) {
      fetchExpenseCategories();
    }
  }, [expenseRows, canManageExpenses, fetchExpenseCategories]);

  // Build category options: merge stored + defaults, dedup
  const categoryOptions = useMemo(() => {
    const allCats = [
      ...new Set([...expenseCategories, ...DEFAULT_CATEGORIES]),
    ].sort();
    return allCats.map((c) => ({ value: c, label: c }));
  }, [expenseCategories]);

  const selectedTruckName = truckOptions.find(
    (t) => t._id === selectedTruck,
  )?.truckName;
  const pageTitle = selectedTruckName
    ? `${selectedTruckName} Expenses`
    : "Expenses";

  const filteredRows = useMemo(() => {
    let rows = expenseRows;

    if (expensesMonth !== "ALL") {
      rows = rows.filter((r) => {
        const d = new Date(r.dateIso);
        return String(d.getMonth() + 1) === expensesMonth;
      });
    }

    if (categoryFilter !== "ALL") {
      rows = rows.filter((r) => r.category === categoryFilter);
    }

    return rows.sort(
      (a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime(),
    );
  }, [expenseRows, expensesMonth, categoryFilter]);

  const breakdown = useMemo(
    () => getExpenseBreakdown(filteredRows),
    [filteredRows],
  );

  const openAdd = () => {
    if (!selectedTruck) {
      setShowTruckWarning(true);
      return;
    }
    setEditRow(null);
    setForm({
      date: toInputDate(new Date()),
      category: "",
      amount: "",
      description: "",
    });
    setFormCategorySearch("");
    setExpenseModal(true);
  };

  const openEdit = (row: ExpenseRow) => {
    setEditRow(row);
    setForm({
      date: row.dateIso,
      category: row.category,
      amount: String(row.amount),
      description: row.description,
    });
    setFormCategorySearch("");
    setExpenseModal(true);
  };

  const handleSave = async () => {
    if (!selectedTruck) {
      setShowTruckWarning(true);
      return;
    }
    if (!form.date) {
      toast.error("Date is required.", { duration: 6000 });
      return;
    }
    if (!form.category.trim()) {
      toast.error("Category is required.", { duration: 6000 });
      return;
    }
    if (!form.amount) {
      toast.error("Amount is required.", { duration: 6000 });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        truckId: selectedTruck,
        date: form.date,
        category: form.category,
        amount: Number(form.amount),
        description: form.description,
      };
      if (editRow) {
        await updateExpense(editRow._id, payload);
      } else {
        await addExpense(payload);
      }
      setExpenseModal(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save expense",
        { duration: 7000 },
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full min-h-[44px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3.5 text-xs focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors";

  if (!canManageExpenses) {
    return <Navigate to="/trips" replace />;
  }

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      {
        accessorFn: (row) => new Date(row.dateIso).getTime(), // for sorting
        id: "date",
        header: "Date",
        cell: ({ row }) => row.original.dateText, // 🔥 FIX DISPLAY
        enableSorting: true,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-muted text-foreground">
            {row.original.category}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className={cn(
              row.original.reimbursed
                ? "text-green-500 line-through"
                : "text-red-500",
            )}
          >
            {peso(row.original.amount)}
          </span>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        enableSorting: false,
      },
      ...(canManageExpenses
        ? [
            {
              id: "reimbursed",
              header: "Reimbursed",
              cell: ({ row }: { row: { original: ExpenseRow } }) => {
                const r = row.original;

                return isReimbursableCategory(r.category) ? (
                  <div className="flex justify-center">
                    <button
                      onClick={() => toggleExpenseReimbursed(r._id)}
                      className={cn(
                        "w-[34px] h-[34px] rounded-md inline-flex items-center justify-center border transition",
                        r.reimbursed
                          ? "bg-green-500/10 border-green-500/20 text-green-600"
                          : "bg-background border-border text-muted-foreground hover:bg-green-500/10 hover:text-green-500",
                      )}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <span className="text-center block">—</span>
                );
              },
            },
          ]
        : []),
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex gap-1 justify-center">
              <button
                onClick={() => openEdit(r)}
                className="w-[34px] h-[34px] rounded-md inline-flex items-center justify-center border border-border bg-background text-muted-foreground hover:bg-blue-500/10 hover:text-blue-600 transition"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setDeleteModal(r)}
                className="w-[34px] h-[34px] rounded-md inline-flex items-center justify-center border border-border bg-background text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        },
      },
    ],
    [canManageExpenses],
  );

  const table = useReactTable<ExpenseRow>({
    data: filteredRows,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold tracking-[-0.03em]">
              {pageTitle}
            </h1>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
          >
            <Plus size={18} />
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3">
        {/* Table */}
        <div className="border rounded-lg bg-background overflow-hidden">
          <div className="p-3.5 border-b border-border">
            <h2 className="text-sm font-semibold">Expense Records</h2>

            <p className="text-xs text-muted-foreground">
              Operational costs and maintenance logs
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-b border-border bg-background px-3.5 py-3">
            {/* TRUCK */}
            <div className="min-w-[180px] flex-1 max-w-[240px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Truck
              </label>

              <Popover open={openTruck} onOpenChange={setOpenTruck}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span className="truncate">
                      {truckOptions.find((t) => t._id === selectedTruck)
                        ?.truckName || "All Trucks"}
                    </span>

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search truck..."
                      className="text-xs"
                    />

                    <CommandEmpty className="text-xs">
                      No truck found.
                    </CommandEmpty>

                    <CommandGroup>
                      <CommandItem
                        value="All Trucks"
                        className="text-xs"
                        onSelect={() => {
                          setSelectedTruck("");
                          setOpenTruck(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            !selectedTruck ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        All Trucks
                      </CommandItem>

                      {truckOptions.map((truck) => (
                        <CommandItem
                          key={truck._id}
                          value={truck.truckName}
                          className="text-xs"
                          onSelect={() => {
                            setSelectedTruck(truck._id);
                            setOpenTruck(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedTruck === truck._id
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />

                          {truck.truckName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* RANGE */}
            <div className="min-w-[180px] flex-1 max-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Range
              </label>

              <Popover open={openMonth} onOpenChange={setOpenMonth}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span className="truncate">
                      {MONTH_OPTIONS.find((m) => m.value === expensesMonth)
                        ?.label || "Select month"}
                    </span>

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-[200px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search month..."
                      className="text-xs"
                    />

                    <CommandEmpty className="text-xs">
                      No month found.
                    </CommandEmpty>

                    <CommandGroup>
                      {MONTH_OPTIONS.map((month) => (
                        <CommandItem
                          key={month.value}
                          value={month.label}
                          className="text-xs"
                          onSelect={() => {
                            setExpensesMonth(month.value);
                            setOpenMonth(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              expensesMonth === month.value
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />

                          {month.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* CATEGORY */}
            <div className="min-w-[180px] flex-1 max-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Category
              </label>

              <Popover open={openCategory} onOpenChange={setOpenCategory}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span className="truncate">
                      {categoryFilter === "ALL"
                        ? "All Categories"
                        : categoryFilter}
                    </span>

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command>
                    <CommandInput
                      className="text-xs"
                      placeholder="Search category..."
                    />

                    <CommandEmpty className="text-xs">
                      No category found.
                    </CommandEmpty>

                    <CommandGroup>
                      <CommandItem
                        value="All Categories"
                        className="text-xs"
                        onSelect={() => {
                          setCategoryFilter("ALL");
                          setOpenCategory(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            categoryFilter === "ALL"
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        All Categories
                      </CommandItem>

                      {categoryOptions.map((category) => (
                        <CommandItem
                          key={category.value}
                          value={category.label}
                          className="text-xs"
                          onSelect={() => {
                            setCategoryFilter(category.value);
                            setOpenCategory(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              categoryFilter === category.value
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />

                          {category.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* CLEAR */}
            <button
              type="button"
              onClick={() => {
                setExpensesMonth("ALL");
                setCategoryFilter("ALL");
              }}
              disabled={expensesMonth === "ALL" && categoryFilter === "ALL"}
              className="h-9 px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Clear Filters
            </button>
          </div>

          {/* Desktop Table */}
          <table
            className={cn("w-full text-sm border-separate border-spacing-0")}
          >
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "sticky top-0 z-20 bg-muted/60 backdrop-blur border-b border-border text-xs font-semibold text-muted-foreground px-3 py-3 whitespace-nowrap",
                        header.column.id === "amount"
                          ? "text-right pr-8"
                          : header.column.id === "reimbursed" ||
                              header.column.id === "actions"
                            ? "text-center"
                            : "text-left",
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          onClick={() => {
                            if (!header.column.getCanSort()) return;
                            header.column.toggleSorting();
                          }}
                          className={cn(
                            "flex items-center gap-1 cursor-pointer select-none",
                            header.column.id === "amount"
                              ? "justify-end"
                              : header.column.id === "reimbursed" ||
                                  header.column.id === "actions"
                                ? "justify-center"
                                : "justify-start",
                          )}
                        >
                          {typeof header.column.columnDef.header === "function"
                            ? header.column.columnDef.header(
                                header.getContext(),
                              )
                            : header.column.columnDef.header}

                          {header.column.getCanSort() &&
                            header.column.getIsSorted() === false && (
                              <ArrowUpDown
                                size={12}
                                className="text-muted-foreground"
                              />
                            )}

                          {header.column.getCanSort() &&
                            header.column.getIsSorted() === "asc" && (
                              <ArrowUp size={12} />
                            )}

                          {header.column.getCanSort() &&
                            header.column.getIsSorted() === "desc" && (
                              <ArrowDown size={12} />
                            )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="bg-background">
              {table.getPaginationRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState
                      icon={ReceiptText}
                      title="No expenses found"
                      description={
                        selectedTruck
                          ? `No expenses recorded for ${selectedTruckName || "this truck"} with the current filters.`
                          : "No expense records match your current filters."
                      }
                    />
                  </td>
                </tr>
              ) : (
                table.getPaginationRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "text-xs px-3 py-2.5 border-b border-border",
                          cell.column.id === "amount"
                            ? "text-right tabular-nums pr-8"
                            : cell.column.id === "reimbursed" ||
                                cell.column.id === "actions"
                              ? "text-center"
                              : "text-left",
                        )}
                      >
                        {typeof cell.column.columnDef.cell === "function"
                          ? cell.column.columnDef.cell(cell.getContext())
                          : cell.getValue()}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-3 border-t border-border flex items-center justify-center">
            <Pagination
              currentPage={pagination.pageIndex + 1}
              totalPages={table.getPageCount()}
              totalItems={filteredRows.length}
              pageSize={pagination.pageSize}
              onPageChange={(page) => table.setPageIndex(page - 1)}
              onPageSizeChange={(size) => table.setPageSize(size)}
            />
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-3 md:hidden p-3 border-t border-slate-200/60 dark:border-slate-700/60">
            {table.getPaginationRowModel().rows.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No expenses found"
                description={
                  selectedTruck
                    ? `No expenses recorded for ${selectedTruckName || "this truck"} with the current filters.`
                    : "No expense records match your current filters."
                }
              />
            ) : (
              table.getPaginationRowModel().rows.map((row) => {
                const r = row.original;

                return (
                  <div
                    key={r._id}
                    className="border rounded-md bg-background p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-sm">{r.dateText}</div>

                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-block px-2.5 py-1 rounded-full text-[0.72rem] font-bold bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                            {r.category}
                          </span>

                          {r.reimbursed && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                              Reimbursed
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className={`font-bold text-lg ${
                          r.reimbursed
                            ? "text-green-500 line-through"
                            : "text-red-500"
                        }`}
                      >
                        {peso(r.amount)}
                      </div>
                    </div>

                    {r.description && (
                      <div className="text-xs text-slate-500 mb-3">
                        {r.description}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      {isReimbursableCategory(r.category) && (
                        <button
                          onClick={() => toggleExpenseReimbursed(r._id)}
                          className={`h-9 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 border text-xs font-semibold transition-all ${
                            r.reimbursed
                              ? "bg-green-500/10 border-green-500/25 text-green-500"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600"
                          }`}
                        >
                          <Check size={14} />{" "}
                          {r.reimbursed ? "Reimbursed" : "Reimburse"}
                        </button>
                      )}

                      <button
                        onClick={() => openEdit(r)}
                        className="flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-blue-500/10 hover:text-blue-600 transition-all text-xs font-semibold"
                      >
                        <Pencil size={14} /> Edit
                      </button>

                      <button
                        onClick={() => setDeleteModal(r)}
                        className="h-9 w-9 rounded-xl inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-red-500/10 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3">
          <div className="border rounded-lg bg-background p-4">
            <h2 className="text-sm font-semibold mb-1">Expense Breakdown</h2>
            <p className="text-xs text-slate-500 mb-4">
              Distribution by category
            </p>
            <div className="flex flex-col gap-4">
              {breakdown.entries.length === 0 ? (
                <div className="text-sm text-slate-400">No expenses found</div>
              ) : (
                breakdown.entries.map((item) => {
                  const pct = item.percent;
                  return (
                    <div key={item.category} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center gap-3 font-bold text-xs">
                        <span>{item.category}</span>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-foreground transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border rounded-lg bg-background p-4">
            <div className="text-[0.72rem] text-slate-500 uppercase tracking-wider font-semibold">
              Total Expenses
            </div>
            <div className="text-[1.8rem] font-extrabold leading-none mt-1.5">
              {peso(breakdown.total)}
            </div>
          </div>

          <div className="border rounded-lg bg-background p-4">
            <h2 className="text-sm font-bold mb-1">Categories</h2>
            <p className="text-xs text-slate-500 mb-3">
              Available expense categories
            </p>
            <div className="flex flex-wrap gap-1.5">
              {categoryOptions.map((c) => (
                <span
                  key={c.value}
                  className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-muted text-foreground"
                >
                  {c.label}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              💡 To add a new category, type it in the Category field when
              adding an expense. It will be saved automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Expense Modal */}
      <Dialog open={expenseModal} onOpenChange={setExpenseModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editRow
                ? `Edit Expense - ${selectedTruckName || "Truck"} - ${editRow.dateText}`
                : `Add Expense - ${selectedTruckName}`}
            </DialogTitle>
          </DialogHeader>

          {/* BODY */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold mb-1 block">Date</label>

              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "w-full h-[44px] justify-between rounded-md border border-border bg-background px-3 text-xs flex items-center",
                      !form.date && "text-muted-foreground",
                    )}
                  >
                    {form.date
                      ? format(new Date(form.date), "MMM d, yyyy")
                      : "Pick a date"}

                    <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.date ? new Date(form.date) : undefined}
                    onSelect={(d) => {
                      if (d) {
                        setForm({
                          ...form,
                          date: format(d, "yyyy-MM-dd"),
                        });
                        setDateOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block">
                Category
              </label>

              <Popover
                open={openFormCategory}
                onOpenChange={(open) => {
                  setOpenFormCategory(open);

                  if (!open) {
                    setFormCategorySearch("");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    className={cn(
                      "w-full h-[44px] justify-between rounded-md border border-border bg-background px-3 text-xs flex items-center outline-none focus:ring-2 focus:ring-ring",
                      !form.category && "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">
                      {form.category || "Select/Create category..."}
                    </span>

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search or create category..."
                      value={formCategorySearch}
                      onValueChange={setFormCategorySearch}
                      className="text-xs"
                    />

                    <CommandGroup>
                      {categoryOptions
                        .filter((category) =>
                          category.label
                            .toLowerCase()
                            .includes(formCategorySearch.trim().toLowerCase()),
                        )
                        .map((category) => (
                          <CommandItem
                            key={category.value}
                            value={category.label}
                            className="text-xs"
                            onSelect={() => {
                              setForm({
                                ...form,
                                category: category.value,
                              });

                              setFormCategorySearch("");
                              setOpenFormCategory(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                form.category === category.value
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />

                            {category.label}
                          </CommandItem>
                        ))}

                      {formCategorySearch.trim() &&
                        !categoryOptions.some(
                          (category) =>
                            category.label.toLowerCase() ===
                            formCategorySearch.trim().toLowerCase(),
                        ) && (
                          <CommandItem
                            value={`create-${formCategorySearch}`}
                            className="text-xs"
                            onSelect={() => {
                              const newCategory = formCategorySearch
                                .trim()
                                .toUpperCase();

                              setForm({
                                ...form,
                                category: newCategory,
                              });

                              setFormCategorySearch("");
                              setOpenFormCategory(false);
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create "{formCategorySearch.trim()}"
                          </CommandItem>
                        )}

                      {!formCategorySearch.trim() &&
                        categoryOptions.length === 0 && (
                          <CommandEmpty className="text-xs">
                            No categories found.
                          </CommandEmpty>
                        )}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block">Amount</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className={inputClass}
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-semibold mb-1 block">
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>

          {/* FOOTER */}
          <DialogFooter className="mt-4">
            <button
              onClick={() => setExpenseModal(false)}
              className="px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : editRow ? "Update" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteModal} onOpenChange={() => setDeleteModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>
          </DialogHeader>

          <p className="text-sm">
            {deleteModal?.dateText} / {deleteModal?.category}
          </p>

          <DialogFooter>
            <button
              onClick={() => setDeleteModal(null)}
              className="px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (deleteModal) {
                  await deleteExpense(deleteModal._id);
                  setDeleteModal(null);
                }
              }}
              className="bg-red-500 text-white px-4 py-2 rounded-md"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Truck Warning */}
      <Dialog open={showTruckWarning} onOpenChange={setShowTruckWarning}>
        <DialogContent className="sm:max-w-[400px] text-center">
          <div className="py-4">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-500/10 grid place-items-center text-amber-500">
              <AlertTriangle size={28} />
            </div>

            <div className="font-bold text-lg mb-1">
              Please select a truck first!
            </div>

            <p className="text-sm text-muted-foreground">
              Choose a truck from the Truck filter before adding an expense.
            </p>
          </div>

          <DialogFooter className="flex justify-center">
            <button
              onClick={() => setShowTruckWarning(false)}
              className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
