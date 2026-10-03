import { useEffect, useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../api/client";
import { useAppStore, type ExpenseRow } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  TrendingUp,
  TrendingDown,
  ArrowDown,
  ArrowUpDown,
  ReceiptText,
  RotateCcw,
  Calendar as CalendarIcon,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Sparkline from "../components/shared/Sparkline";
import { Checkbox } from "@/components/ui/checkbox";

const DEFAULT_CATEGORIES = [
  "FUEL",
  "MAINT.",
  "TOLL",
  "INSURANCE",
  "REGISTRATION",
];

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
  const [expenseSummary, setExpenseSummary] = useState({
    currentTotal: 0,
    previousTotal: 0,
    yearTotal: 0,
    previousYearTotal: 0,
    monthlyTotals: Array(12).fill(0) as number[],
  });

  const [openFormCategory, setOpenFormCategory] = useState(false);
  const [formCategorySearch, setFormCategorySearch] = useState("");
  const [reimbursableCategories, setReimbursableCategories] = useState<
    Set<string>
  >(new Set());
  const [form, setForm] = useState({
    date: toInputDate(new Date()),
    category: "",
    amount: "",
    description: "",
    reimbursable: false,
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

  const fetchExpenseSummary = async () => {
    if (!canManageExpenses) return;

    try {
      const response = await api.get("/expenses/summary", {
        params: {
          truck: selectedTruck || undefined,
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
        },
      });

      setExpenseSummary({
        currentTotal: Number(response.data.currentTotal || 0),
        previousTotal: Number(response.data.previousTotal || 0),
        yearTotal: Number(response.data.yearTotal || 0),
        previousYearTotal: Number(response.data.previousYearTotal || 0),
        monthlyTotals: response.data.monthlyTotals || Array(12).fill(0),
      });
    } catch (error) {
      console.error("Failed to load expense summary:", error);

      setExpenseSummary({
        currentTotal: 0,
        previousTotal: 0,
        yearTotal: 0,
        previousYearTotal: 0,
        monthlyTotals: Array(12).fill(0),
      });
    }
  };

  useEffect(() => {
    fetchExpenseSummary();
  }, [canManageExpenses, selectedTruck]);

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

  const filteredRows = useMemo(() => {
    let rows = [...expenseRows];

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

  const expenseSparkLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const isAllMonths = expensesMonth === "ALL";

  const selectedMonthIndex =
    expensesMonth === "ALL" ? new Date().getMonth() : Number(expensesMonth) - 1;

  const expenseCurrentValue = isAllMonths
    ? expenseSummary.yearTotal
    : expenseSummary.monthlyTotals[selectedMonthIndex] || 0;

  const expensePreviousValue = isAllMonths
    ? expenseSummary.previousYearTotal
    : selectedMonthIndex > 0
      ? expenseSummary.monthlyTotals[selectedMonthIndex - 1] || 0
      : expenseSummary.previousTotal;

  const expenseDiff = expenseCurrentValue - expensePreviousValue;

  const expensePercent =
    expensePreviousValue === 0
      ? null
      : (expenseDiff / Math.abs(expensePreviousValue)) * 100;

  const expenseIsUp = expenseDiff > 0;
  const expenseIsGood = expenseDiff <= 0;

  const expenseSign = expenseDiff === 0 ? "" : expenseDiff > 0 ? "+" : "-";

  const fetchCategorySettings = async () => {
    if (!selectedTruck) {
      setReimbursableCategories(new Set());
      return;
    }

    try {
      const { data } = await api.get("/expenses/category-settings", {
        params: {
          truck: selectedTruck,
        },
      });

      const reimbursable = new Set<string>(
        (data.categories || [])
          .filter(
            (category: { reimbursable: boolean }) => category.reimbursable,
          )
          .map((category: { name: string }) => category.name),
      );

      setReimbursableCategories(reimbursable);
    } catch (error) {
      console.error("Failed to load category settings:", error);
      setReimbursableCategories(new Set());
    }
  };

  useEffect(() => {
    fetchCategorySettings();
  }, [selectedTruck]);

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
      reimbursable: false,
    });
    setFormCategorySearch("");
    setExpenseModal(true);
  };

  const openEdit = async (row: ExpenseRow) => {
    setEditRow(row);

    let reimbursable = false;

    if (selectedTruck) {
      try {
        const { data } = await api.get("/expenses/category-settings", {
          params: {
            truck: selectedTruck,
          },
        });

        const categorySetting = (data.categories || []).find(
          (category: { name: string; reimbursable: boolean }) =>
            category.name.trim().toUpperCase() ===
            row.category.trim().toUpperCase(),
        );

        reimbursable = Boolean(categorySetting?.reimbursable);
      } catch (error) {
        console.error("Failed to load category setting:", error);
      }
    }

    setForm({
      date: row.dateIso,
      category: row.category,
      amount: String(row.amount),
      description: row.description,
      reimbursable,
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
    if (!form.amount.trim()) {
      toast.error("Amount is required.", { duration: 6000 });
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount)) {
      toast.error("Enter a valid amount.", { duration: 6000 });
      return;
    }

    if (amount <= 0) {
      toast.error("Amount must be greater than 0.", { duration: 6000 });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        truckId: selectedTruck,
        date: form.date,
        category: form.category,
        amount,
        description: form.description,
      };
      if (editRow) {
        await updateExpense(editRow._id, payload);
      } else {
        await addExpense(payload);
      }

      await api.put("/expenses/category-settings", {
        truckId: selectedTruck,
        name: form.category,
        reimbursable: form.reimbursable,
      });

      await fetchCategorySettings();
      await fetchExpenseSummary();

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
          <Badge variant="secondary" className="text-xs font-medium">
            {row.original.category}
          </Badge>
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
              "font-medium tabular-nums",
              row.original.reimbursed
                ? "text-green-600 line-through dark:text-green-400"
                : "text-destructive",
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
        size: 280,
        cell: ({ row }) => (
          <div className="max-w-[280px] truncate">
            {row.original.description || "—"}
          </div>
        ),
      },
      ...(canManageExpenses
        ? [
            {
              id: "reimbursed",
              header: "Reimbursed",
              cell: ({ row }: { row: { original: ExpenseRow } }) => {
                const r = row.original;

                return reimbursableCategories.has(
                  r.category.trim().toUpperCase(),
                ) ? (
                  <div className="flex justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={async () => {
                            await toggleExpenseReimbursed(r._id);
                            await fetchExpenseSummary();
                          }}
                          className={cn(
                            r.reimbursed &&
                              "border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/15 hover:text-green-600 dark:text-green-400",
                          )}
                        >
                          <Check />
                          <span className="sr-only">
                            {r.reimbursed
                              ? "Mark as not reimbursed"
                              : "Mark as reimbursed"}
                          </span>
                        </Button>
                      </TooltipTrigger>

                      <TooltipContent>
                        {r.reimbursed ? "Reimbursed" : "Mark as reimbursed"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <span className="block text-center text-muted-foreground">
                    —
                  </span>
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

          const isCrewReimbursement =
            r.category.trim().toUpperCase() === "REIMBURSEMENT" &&
            Boolean(r.tripId);

          return (
            <div className="flex items-center justify-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil />
                      <span className="sr-only">Edit expense</span>
                    </Button>
                  </span>
                </TooltipTrigger>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setDeleteModal(r)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 />
                      <span className="sr-only">Delete expense</span>
                    </Button>
                  </span>
                </TooltipTrigger>

                {isCrewReimbursement && (
                  <TooltipContent>
                    Set the related trip as Unsettled to remove
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [canManageExpenses, toggleExpenseReimbursed, reimbursableCategories],
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
      <div className="sticky top-14 z-30 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 bg-background/95 px-1 py-3 backdrop-blur">
        {/* LEFT: MONTH */}
        <div className="flex items-center">
          <Select
            value={expensesMonth}
            onValueChange={(value) => {
              setExpensesMonth(value);

              setPagination((current) => ({
                ...current,
                pageIndex: 0,
              }));
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>

            <SelectContent>
              {MONTH_OPTIONS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* RESET MONTH */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={expensesMonth === String(new Date().getMonth() + 1)}
            onClick={() => {
              const currentMonth = String(new Date().getMonth() + 1);

              setExpensesMonth(currentMonth);

              setPagination((current) => ({
                ...current,
                pageIndex: 0,
              }));
            }}
          >
            <RotateCcw />
          </Button>
        </div>

        {/* RIGHT: ADD EXPENSE */}
        <Button type="button" onClick={openAdd}>
          <Plus />
          Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1fr_380px]">
        {/* Expense Records */}
        <Card size="sm" className="!gap-0 overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Expense Records</CardTitle>

                <CardDescription>
                  Operational costs and maintenance logs
                </CardDescription>
              </div>

              <div className="flex items-center gap-1">
                <Select
                  value={categoryFilter}
                  onValueChange={(value) => {
                    setCategoryFilter(value);

                    setPagination((current) => ({
                      ...current,
                      pageIndex: 0,
                    }));
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>

                    {categoryOptions.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={categoryFilter === "ALL"}
                  onClick={() => {
                    setCategoryFilter("ALL");

                    setPagination((current) => ({
                      ...current,
                      pageIndex: 0,
                    }));
                  }}
                  aria-label="Reset category filter"
                >
                  <RotateCcw />
                </Button>
              </div>
            </div>
          </CardHeader>
          {/* Desktop Table */}
          <div className="[&>div]:max-h-[calc(100vh-320px)] [&>div]:overflow-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="sticky top-0 z-20 bg-background hover:bg-background"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        style={{
                          width:
                            header.column.id === "description"
                              ? header.column.getSize()
                              : undefined,
                        }}
                        key={header.id}
                        className={cn(
                          "text-xs",
                          header.column.id === "date" && "pl-4",
                          header.column.id === "amount"
                            ? "pr-8 text-right"
                            : header.column.id === "reimbursed" ||
                                header.column.id === "actions"
                              ? "text-center"
                              : "text-left",
                        )}
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              "h-7 text-xs",
                              header.column.id === "amount"
                                ? "ml-auto px-0"
                                : header.column.id === "date"
                                  ? "px-0"
                                  : "-ml-3 px-2",
                            )}
                          >
                            {typeof header.column.columnDef.header === "string"
                              ? header.column.columnDef.header
                              : null}

                            {!header.column.getIsSorted() && (
                              <ArrowUpDown className="size-3.5 text-muted-foreground" />
                            )}

                            {header.column.getIsSorted() === "asc" && (
                              <ArrowUp className="size-3.5" />
                            )}

                            {header.column.getIsSorted() === "desc" && (
                              <ArrowDown className="size-3.5" />
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs font-medium text-foreground">
                            {typeof header.column.columnDef.header === "string"
                              ? header.column.columnDef.header
                              : null}
                          </span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {table.getPaginationRowModel().rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length} className="p-0">
                      <EmptyState
                        icon={ReceiptText}
                        title="No expenses found"
                        description={
                          selectedTruck
                            ? `No expenses recorded for ${selectedTruckName || "this truck"} with the current filters.`
                            : "No expense records match your current filters."
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getPaginationRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{
                            width:
                              cell.column.id === "description"
                                ? cell.column.getSize()
                                : undefined,
                          }}
                          className={cn(
                            "text-xs",
                            cell.column.id === "date" && "pl-4",
                            cell.column.id === "amount"
                              ? "pr-8 text-right tabular-nums"
                              : cell.column.id === "reimbursed" ||
                                  cell.column.id === "actions"
                                ? "text-center"
                                : "text-left",
                          )}
                        >
                          {typeof cell.column.columnDef.cell === "function"
                            ? cell.column.columnDef.cell(cell.getContext())
                            : String(cell.getValue() ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-center border-t">
            <Pagination
              currentPage={pagination.pageIndex + 1}
              totalPages={table.getPageCount()}
              totalItems={filteredRows.length}
              pageSize={pagination.pageSize}
              onPageChange={(page) => table.setPageIndex(page - 1)}
              onPageSizeChange={(size) => table.setPageSize(size)}
            />
          </div>
        </Card>

        {/* Sidebar */}
        <div className="flex flex-col gap-3">
          <Card size="sm">
            <CardHeader className="grid grid-cols-[1fr_auto] items-start">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <ReceiptText className="size-4 text-muted-foreground" />
                </div>

                <CardTitle>Expenses</CardTitle>
              </div>

              <span className="text-sm font-semibold tracking-tight tabular-nums">
                {peso(expenseCurrentValue)}
              </span>
            </CardHeader>

            <CardContent>
              <div className="-translate-y-2 grid grid-cols-[1fr_100px] items-end gap-3">
                <div className="min-w-0">
                  {expensePercent !== null && expenseDiff !== 0 && (
                    <div
                      className={cn(
                        "flex items-center gap-1 text-[11px] font-medium tabular-nums",
                        expenseIsGood
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive",
                      )}
                    >
                      {expenseIsUp ? (
                        <TrendingUp className="size-3" />
                      ) : (
                        <TrendingDown className="size-3" />
                      )}

                      <span>
                        {expenseSign}
                        {Math.abs(expensePercent).toFixed(1)}%
                      </span>

                      <span className="text-muted-foreground">
                        ({expenseSign}
                        {peso(Math.abs(expenseDiff))})
                      </span>
                    </div>
                  )}

                  {expensePercent === null && (
                    <div className="text-[11px] font-medium text-muted-foreground">
                      {isAllMonths
                        ? "No prior year data"
                        : "No prior month data"}
                    </div>
                  )}

                  {expenseDiff === 0 && (
                    <div className="text-[11px] font-medium text-muted-foreground">
                      No change
                    </div>
                  )}

                  {expensePercent !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isAllMonths ? "vs last year" : "vs last month"}
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Sparkline
                    data={expenseSummary.monthlyTotals}
                    labels={expenseSparkLabels}
                    invert
                    current={expenseCurrentValue}
                    previous={expensePreviousValue}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <div>
                <CardTitle>Expense Breakdown</CardTitle>
                <CardDescription>Distribution by category</CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <div className="flex flex-col gap-4">
                {breakdown.entries.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No expenses found
                  </div>
                ) : (
                  breakdown.entries.map((item) => {
                    const pct = item.percent;

                    return (
                      <div key={item.category} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium">{item.category}</span>

                          <div className="flex items-center gap-2 tabular-nums">
                            <span className="font-medium">
                              {peso(item.amount)}
                            </span>

                            <span className="text-muted-foreground">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground transition-[width]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <div>
                <CardTitle>Categories</CardTitle>
                <CardDescription>Available expense categories</CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.map((category) => (
                  <Badge
                    key={category.value}
                    variant="secondary"
                    className="text-xs font-medium"
                  >
                    {category.label}
                  </Badge>
                ))}
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Type a new category when adding an expense to save it
                automatically.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Expense Modal */}
      <Dialog open={expenseModal} onOpenChange={setExpenseModal}>
        <DialogContent className="sm:max-w-[520px] gap-3">
          <DialogHeader>
            <DialogTitle>
              {editRow
                ? `Edit Expense for ${selectedTruckName || "Truck"}`
                : `Add Expense for ${selectedTruckName || "Truck"}`}
            </DialogTitle>

            <DialogDescription className="sr-only">
              {editRow
                ? "Update the expense details below."
                : "Enter the expense details below."}
            </DialogDescription>
          </DialogHeader>

          {/* BODY */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>

              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-between font-normal",
                      !form.date && "text-muted-foreground",
                    )}
                  >
                    {form.date
                      ? format(new Date(`${form.date}T00:00:00`), "MMM d, yyyy")
                      : "Pick a date"}

                    <CalendarIcon className="size-4 opacity-50" />
                  </Button>
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

            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>

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
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between font-normal",
                      !form.category && "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">
                      {form.category || "Select/Create Category..."}
                    </span>

                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                  </Button>
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
                            className="text-sm font-medium"
                            onSelect={() => {
                              setForm({
                                ...form,
                                category: category.value,
                                reimbursable: reimbursableCategories.has(
                                  category.value.trim().toUpperCase(),
                                ),
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
                            className="text-sm font-medium"
                            onSelect={() => {
                              const newCategory = formCategorySearch
                                .trim()
                                .toUpperCase();

                              setForm({
                                ...form,
                                category: newCategory,
                                reimbursable: false,
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

            <div className="col-span-2 flex items-center gap-2">
              <Checkbox
                id="expense-category-reimbursable"
                checked={form.reimbursable}
                disabled={!form.category}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    reimbursable: checked === true,
                  }))
                }
              />

              <Label
                htmlFor="expense-category-reimbursable"
                className="cursor-pointer text-xs font-normal"
              >
                Reimbursable
              </Label>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="expense-amount" className="text-xs">
                Amount
              </Label>

              <Input
                id="expense-amount"
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    amount: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="expense-description" className="text-xs">
                Description
              </Label>

              <Textarea
                id="expense-description"
                value={form.description}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
                placeholder="Add a description..."
                rows={2}
                className="min-h-[56px] resize-none"
              />
            </div>
          </div>

          {/* FOOTER */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExpenseModal(false)}
              disabled={loading}
            >
              Cancel
            </Button>

            <Button type="button" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : editRow ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteModal} onOpenChange={() => setDeleteModal(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>

            <DialogDescription>
              Are you sure you want to delete this expense?
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm font-medium">
            {deleteModal?.dateText} / {deleteModal?.category}
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModal(null)}
              disabled={loading}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={async () => {
                if (!deleteModal) return;

                setLoading(true);

                try {
                  await deleteExpense(deleteModal._id);
                  await fetchExpenseSummary();

                  setDeleteModal(null);
                } catch (err: unknown) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Failed to delete expense",
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Trash2 />
              {loading ? "Deleting..." : "Delete Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Truck Warning */}
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
    </div>
  );
}
