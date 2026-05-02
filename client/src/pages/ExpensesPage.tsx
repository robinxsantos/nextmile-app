import { useEffect, useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppStore, type ExpenseRow } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import FilterBar from "../components/shared/FilterBar";
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
  Coins,
  Check,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Pagination from "../components/shared/Pagination";
import CreatableSelect from "react-select/creatable";
import { getSelectStyles } from "../lib/selectStyles";
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
import { Calendar as CalendarIcon } from "lucide-react";

const DEFAULT_CATEGORIES = [
  "FUEL",
  "MAINT.",
  "TOLL",
  "PARKING",
  "INSURANCE",
  "REGISTRATION",
];

const REIMBURSABLE_CATEGORIES = new Set(["FUEL", "TOLL", "PARKING"]);

function isReimbursableCategory(category?: string) {
  return REIMBURSABLE_CATEGORIES.has((category || "").trim().toUpperCase());
}

export default function ExpensesPage() {
  const {
    expenseRows,
    selectedTruck,
    truckOptions,
    expensesMonth,
    setExpensesMonth,
    fetchExpenses,
    initApp,
    addExpense,
    updateExpense,
    deleteExpense,
    toggleExpenseReimbursed,
    expenseCategories,
    theme,
  } = useAppStore();
  const { isAdmin } = useAuthStore();
  const admin = isAdmin();
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
  const [form, setForm] = useState({
    date: toInputDate(new Date()),
    category: "",
    amount: "",
    description: "",
  });

  const isDark = theme === "dark";
  const selectStyles = getSelectStyles(isDark);

  useEffect(() => {
    if (admin) initApp();
  }, [initApp, admin]);

  useEffect(() => {
    if (admin) {
      const currentMonth = String(new Date().getMonth() + 1);
      setExpensesMonth(currentMonth);
    }
  }, [admin, setExpensesMonth]);

  useEffect(() => {
    if (admin) fetchExpenses();
  }, [fetchExpenses, expensesMonth, admin]);

  if (!admin) return null;

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
      rows = rows.filter(
        (r) => r.category === categoryFilter || r.category === "REIMBURSEMENT", // 🔥 KEY FIX
      );
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
    setExpenseModal(true);
  };

  useKeyboardShortcuts({ onNewExpense: admin ? openAdd : undefined });

  const openEdit = (row: ExpenseRow) => {
    setEditRow(row);
    setForm({
      date: row.dateIso,
      category: row.category,
      amount: String(row.amount),
      description: row.description,
    });
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
    "w-full min-h-[44px] rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors";

  if (!admin) {
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
          <span className="inline-block px-2.5 py-1 rounded-full text-[0.72rem] font-bold bg-muted text-foreground">
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
              "font-semibold",
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
      ...(admin
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
    [admin],
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
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track company expenses by category, month, and total distribution.
            </p>
          </div>
        </div>
      </div>

      <FilterBar
        showRange={false}
        showTruck={false}
        showMonth
        monthValue={expensesMonth}
        onMonthChange={setExpensesMonth}
        actions={
          <div className="flex items-center gap-2">
            {/* ✅ ADD BUTTON */}
            <button
              onClick={openAdd}
              className="h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
            >
              <Plus size={18} /> Add Expense
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 mt-4">
        {/* Table */}
        <div className="border rounded-lg bg-background overflow-hidden">
          <div className="p-3.5 pb-2 flex items-start justify-between gap-3">
            {/* LEFT SIDE */}
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Expense Records
              </h2>
              <p className="text-sm text-muted-foreground">
                Operational costs and maintenance logs
              </p>
            </div>

            {/* RIGHT SIDE — DITO MO ILALAGAY */}
            <Popover open={openCategory} onOpenChange={setOpenCategory}>
              <PopoverTrigger asChild>
                <button
                  role="combobox"
                  className="h-10 w-[200px] justify-between rounded-md border border-border bg-background px-3 text-sm flex items-center"
                >
                  {categoryFilter === "ALL" ? "All Categories" : categoryFilter}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="Search category..." />
                  <CommandEmpty>No category found.</CommandEmpty>

                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setCategoryFilter("ALL");
                        setOpenCategory(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          categoryFilter === "ALL" ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      All Categories
                    </CommandItem>

                    {categoryOptions.map((c) => (
                      <CommandItem
                        key={c.value}
                        value={c.label}
                        onSelect={() => {
                          setCategoryFilter(c.value);
                          setOpenCategory(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            categoryFilter === c.value
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        {c.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
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
                        "sticky top-0 z-40 bg-muted/60 backdrop-blur border-b border-border text-xs font-semibold text-muted-foreground px-3 py-3 whitespace-nowrap",
                        header.column.id === "reimbursed"
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
                            header.column.id === "reimbursed" ||
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
              {table.getPaginationRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td className="text-left text-xs px-3 py-2.5 border-b border-border">
                      {typeof cell.column.columnDef.cell === "function"
                        ? cell.column.columnDef.cell(cell.getContext())
                        : cell.getValue()}
                    </td>
                  ))}
                </tr>
              ))}
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
                icon={Coins}
                title="No expenses found"
                description="No expenses available."
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
            <h2 className="text-base font-bold tracking-tight mb-1">
              Expense Breakdown
            </h2>
            <p className="text-sm text-slate-500 mb-4">
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
                      <div className="flex justify-between items-center gap-3 font-bold text-sm tracking-tight">
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
            <div className="text-[1.8rem] font-extrabold tracking-tight leading-none mt-1.5">
              {peso(breakdown.total)}
            </div>
          </div>

          <div className="border rounded-lg bg-background p-4">
            <h2 className="text-base font-bold tracking-tight mb-1">
              Categories
            </h2>
            <p className="text-sm text-slate-500 mb-3">
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
            <p className="text-[0.65rem] text-slate-400 mt-3">
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
                : "Add Expense"}
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
                      "w-full h-[44px] justify-between rounded-md border border-border bg-background px-3 text-sm flex items-center",
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
              <CreatableSelect
                options={categoryOptions}
                value={
                  form.category
                    ? { value: form.category, label: form.category }
                    : null
                }
                onChange={(opt) =>
                  setForm({ ...form, category: opt?.value || "" })
                }
                onCreateOption={(val) => setForm({ ...form, category: val })}
                styles={selectStyles}
              />
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
              onClick={() => setDeleteModal(null)}
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
              Choose a truck from the Dashboard filter bar.
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
