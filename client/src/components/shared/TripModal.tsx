import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAppStore, type TripRow } from "../../store/useAppStore";
import { useAuthStore } from "../../store/useAuthStore";
import {
  CalendarDays,
  TruckElectric,
  BedDouble,
  TentTree,
  Calculator,
  Percent,
  PhilippinePeso,
  Check,
  ChevronsUpDown,
  Plus,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import api from "../../api/client";
import { cn } from "../../lib/utils";
import {
  Command,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";

interface TripModalProps {
  open: boolean;
  onClose: () => void;
  editRow?: TripRow | null;
  duplicateFrom?: TripRow | null;
}

const RATE_ADJUSTMENT_OPTIONS = [
  {
    value: "none",
    label: "None",
    icon: null,
  },
  {
    value: "amount",
    label: "Amount",
    icon: PhilippinePeso,
  },
  {
    value: "percentage",
    label: "Percentage",
    icon: Percent,
  },
] as const;

const STATUS_OPTIONS = [
  {
    value: "Working Day",
    label: "Working Day",
    icon: TruckElectric,
  },
  {
    value: "Day Off",
    label: "Day Off",
    icon: BedDouble,
  },
  {
    value: "Holiday",
    label: "Holiday",
    icon: TentTree,
  },
];

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const formatNumberWithComma = (value: string) => {
  if (!value) return "";

  const raw = value.replace(/,/g, "");

  // 🔥 allow incomplete decimals like "1."
  if (raw.endsWith(".")) return raw;

  const num = Number(raw);
  if (Number.isNaN(num)) return value;

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const sanitizeNumberInput = (value: string) => {
  let cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");

  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }

  return cleaned;
};

export default function TripModal({
  open,
  onClose,
  editRow,
  duplicateFrom,
}: TripModalProps) {
  const { selectedTruck, truckOptions, addTrip, updateTrip, fetchDashboard } =
    useAppStore();
  const { user } = useAuthStore();

  const canManageTripFinancials =
    user?.role === "admin" || user?.role === "manager";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: new Date(),
    status: "Working Day",
    shipmentNumber: "",
    originalRate: "",
    rateAdjustmentType: "none" as "none" | "amount" | "percentage",
    rateAdjustment: "",
    rate: "",
    vat: "",
    autoVat: true,
    trips: "",
    crewSalary: "",
    cashAdvance: "",
    reimbursementCategory: "",
    reimbursements: "",
    note: "",
  });

  const [openDate, setOpenDate] = useState(false);
  const [openReimbursementCategory, setOpenReimbursementCategory] =
    useState(false);

  const [reimbursementCategorySearch, setReimbursementCategorySearch] =
    useState("");

  const [reimbursableCategories, setReimbursableCategories] = useState<
    string[]
  >([]);
  const [selectedDate, setSelectedDate] = useState<Date>(form.date);
  const [adjustmentCalculatorOpen, setAdjustmentCalculatorOpen] =
    useState(false);

  const [calculatorOriginalRate, setCalculatorOriginalRate] = useState("");
  const [calculatorActualRate, setCalculatorActualRate] = useState("");

  const [calculatorApplyAs, setCalculatorApplyAs] = useState<
    "amount" | "percentage"
  >("amount");

  const fetchReimbursableCategories = async () => {
    if (!selectedTruck) {
      setReimbursableCategories([]);
      return;
    }

    try {
      const { data } = await api.get("/expenses/category-settings", {
        params: {
          truck: selectedTruck,
        },
      });

      const categories = (data.categories || [])
        .filter(
          (category: { name: string; reimbursable: boolean }) =>
            category.reimbursable,
        )
        .map((category: { name: string }) => category.name)
        .sort();

      setReimbursableCategories(categories);
    } catch (error) {
      console.error("Failed to load reimbursable categories:", error);
      setReimbursableCategories([]);
    }
  };

  useEffect(() => {
    if (open) {
      fetchReimbursableCategories();
    }
  }, [open, selectedTruck]);

  const prefillFromTrip = (src: TripRow, useToday = true) => {
    setForm({
      date: useToday
        ? new Date()
        : src.dateIso
          ? new Date(src.dateIso + "T00:00:00")
          : new Date(),
      status: src.status || "Working Day",
      shipmentNumber: src.shipmentNumber || "",
      originalRate: String(src.originalRate || src.rate || ""),
      rateAdjustmentType: src.rateAdjustmentType || "none",
      rateAdjustment: String(src.rateAdjustment || ""),
      rate: String(src.rate || ""),
      vat: String(src.vat || ""),
      autoVat: src.autoComputeVat ?? false,
      trips: String(src.trips || ""),
      crewSalary: String(src.crewSalary || ""),
      cashAdvance: String(src.cashAdvance || ""),
      reimbursementCategory: src.reimbursementCategory || "",
      reimbursements: String(src.reimbursements || ""),
      note: src.note || "",
    });
  };

  useEffect(() => {
    if (editRow) {
      const d = editRow.dateIso
        ? new Date(editRow.dateIso + "T00:00:00")
        : new Date();

      prefillFromTrip(editRow, false);
      setSelectedDate(d);
    } else if (duplicateFrom) {
      const today = new Date();

      prefillFromTrip(duplicateFrom, true);
      setSelectedDate(today);
    } else {
      const today = new Date();

      setForm({
        date: today,
        status: "Working Day",
        shipmentNumber: "",
        originalRate: "",
        rateAdjustmentType: "none",
        rateAdjustment: "",
        rate: "",
        vat: "",
        autoVat: true,
        trips: "",
        crewSalary: "",
        cashAdvance: "",
        reimbursementCategory: "",
        reimbursements: "",
        note: "",
      });

      setSelectedDate(today); // 🔥 IMPORTANT
    }
  }, [editRow, duplicateFrom, open]);

  const calculateFinalRate = (
    originalRate: number,
    adjustmentType: "none" | "amount" | "percentage",
    adjustment: number,
  ) => {
    let finalRate = originalRate;

    if (adjustmentType === "amount") {
      finalRate = originalRate - adjustment;
    }

    if (adjustmentType === "percentage") {
      finalRate = originalRate - originalRate * (adjustment / 100);
    }

    return Math.max(0, Math.round((finalRate + Number.EPSILON) * 100) / 100);
  };

  const recomputeRateFields = (
    currentForm: typeof form,
    overrides: Partial<typeof form> = {},
  ) => {
    const next = {
      ...currentForm,
      ...overrides,
    };

    if (next.status === "Day Off") {
      return {
        ...next,
        originalRate: "",
        rateAdjustmentType: "none",
        rateAdjustment: "",
        rate: "",
        vat: "",
        trips: "",
        crewSalary: "",
        cashAdvance: "",
        reimbursementCategory: "",
        reimbursements: "",
      };
    }

    const originalRate = Number(next.originalRate) || 0;
    const adjustment = Number(next.rateAdjustment) || 0;

    const rate = calculateFinalRate(
      originalRate,
      next.rateAdjustmentType,
      adjustment,
    );

    const vat = next.autoVat
      ? Math.round((originalRate * 0.12 + Number.EPSILON) * 100) / 100
      : 0;

    return {
      ...next,
      rate: originalRate > 0 ? rate.toFixed(2) : "",
      vat: originalRate > 0 && next.autoVat ? vat.toFixed(2) : "",
      trips:
        next.status === "Working Day" &&
        originalRate > 0 &&
        (!next.trips || next.trips === "0")
          ? "1"
          : next.trips,
    };
  };

  const handleOriginalRateChange = (val: string) => {
    setForm((current) =>
      recomputeRateFields(current, {
        originalRate: val,
      }),
    );
  };

  const handleRateAdjustmentChange = (val: string) => {
    setForm((current) =>
      recomputeRateFields(current, {
        rateAdjustment: val,
      }),
    );
  };

  const calculatorOriginal = Number(calculatorOriginalRate) || 0;
  const calculatorActual = Number(calculatorActualRate) || 0;

  const calculatorDeduction = Math.max(
    0,
    calculatorOriginal - calculatorActual,
  );

  const calculatorPercentage =
    calculatorOriginal > 0
      ? (calculatorDeduction / calculatorOriginal) * 100
      : 0;

  const handleOpenAdjustmentCalculator = () => {
    setCalculatorOriginalRate(form.originalRate || "");
    setCalculatorActualRate(form.rate || "");
    setCalculatorApplyAs(
      form.rateAdjustmentType === "percentage" ? "percentage" : "amount",
    );
    setAdjustmentCalculatorOpen(true);
  };

  const handleApplyAdjustmentCalculator = () => {
    if (calculatorOriginal <= 0) {
      toast.error("Original Rate must be greater than 0.");
      return;
    }

    if (calculatorActual < 0) {
      toast.error("Actual Rate cannot be negative.");
      return;
    }

    if (calculatorActual > calculatorOriginal) {
      toast.error("Actual Rate cannot exceed Original Rate.");
      return;
    }

    setForm((current) =>
      recomputeRateFields(current, {
        originalRate: calculatorOriginal.toFixed(2),
        rateAdjustmentType: calculatorApplyAs,
        rateAdjustment:
          calculatorApplyAs === "amount"
            ? calculatorDeduction.toFixed(2)
            : calculatorPercentage.toFixed(2),
      }),
    );

    setAdjustmentCalculatorOpen(false);
  };

  const handleSubmit = async () => {
    if (!selectedTruck) {
      toast.error("Please select a truck first!");
      return;
    }

    if (!canManageTripFinancials) {
      if (!form.shipmentNumber.trim()) {
        toast.error("Shipment Number is required.");
        return;
      }
    } else {
      if (form.status === "Working Day" && !form.originalRate) {
        toast.error("Original Rate is required for Working Day.");
        return;
      }

      if (
        form.rateAdjustmentType === "amount" &&
        Number(form.rateAdjustment || 0) > Number(form.originalRate || 0)
      ) {
        toast.error("Rate Adjustment cannot exceed Original Rate.");
        return;
      }

      if (
        form.rateAdjustmentType === "percentage" &&
        Number(form.rateAdjustment || 0) >= 100
      ) {
        toast.error("Rate Adjustment percentage must be less than 100%.");
        return;
      }

      if (form.status === "Working Day" && !form.crewSalary) {
        toast.error("Crew Salary is required for Working Day.");
        return;
      }
    }

    if (
      canManageTripFinancials &&
      Number(form.reimbursements || 0) > 0 &&
      !form.reimbursementCategory.trim()
    ) {
      toast.error("Reimbursement Category is required.");
      return;
    }

    if (
      canManageTripFinancials &&
      form.reimbursementCategory.trim() &&
      Number(form.reimbursements || 0) <= 0
    ) {
      toast.error("Reimbursement amount is required.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        truckId: selectedTruck,
        date: toLocalDateString(form.date),
        status: form.status,
        shipmentNumber: form.shipmentNumber,
        originalRate: canManageTripFinancials
          ? Number(form.originalRate) || 0
          : 0,
        rateAdjustmentType: canManageTripFinancials
          ? form.rateAdjustmentType
          : "none",
        rateAdjustment: canManageTripFinancials
          ? Number(form.rateAdjustment) || 0
          : 0,
        autoComputeVat: canManageTripFinancials ? form.autoVat : false,
        rate: canManageTripFinancials ? Number(form.rate) || 0 : 0,
        vat: canManageTripFinancials ? Number(form.vat) || 0 : 0,
        trips: canManageTripFinancials ? Number(form.trips) || 0 : 0,
        crewSalary: canManageTripFinancials ? Number(form.crewSalary) || 0 : 0,
        cashAdvance: canManageTripFinancials
          ? Number(form.cashAdvance) || 0
          : 0,
        reimbursementCategory: canManageTripFinancials
          ? form.reimbursementCategory
          : "",
        reimbursements: canManageTripFinancials
          ? Number(form.reimbursements) || 0
          : 0,
        note: form.note,
      };

      if (editRow) {
        await updateTrip(editRow._id, payload);
      } else {
        await addTrip(payload);
      }
      await fetchDashboard();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save trip");
    } finally {
      setLoading(false);
    }
  };

  const selectedTruckName =
    truckOptions.find((t) => t._id === selectedTruck)?.truckName ||
    "Selected Truck";

  const modalTitle = editRow
    ? `Edit Trip - ${selectedTruckName} - ${editRow.dateText}`
    : duplicateFrom
      ? `Duplicate Trip for ${selectedTruckName}`
      : `Add Trip for ${selectedTruckName}`;

  const readOnlyForDriver = !canManageTripFinancials;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(val) => {
          if (!val) onClose();
        }}
      >
        <DialogContent className="sm:max-w-[700px] !gap-3">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>

            <DialogDescription className="sr-only">
              Enter the trip details below.
            </DialogDescription>
          </DialogHeader>

          {/* BODY */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {/* DATE */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Date <span className="text-destructive">*</span>
              </Label>

              <Popover open={openDate} onOpenChange={setOpenDate}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    {selectedDate
                      ? format(selectedDate, "MMM d, yyyy")
                      : "Select date"}

                    <CalendarDays className="size-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (!date) return;

                      setSelectedDate(date);
                      setForm((current) => ({
                        ...current,
                        date,
                      }));
                      setOpenDate(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* STATUS */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Status <span className="text-destructive">*</span>
              </Label>

              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) =>
                    recomputeRateFields(current, {
                      status: value,
                    }),
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>

                <SelectContent>
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;

                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <Icon className="size-4" />
                        {option.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* SHIPMENT */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Shipment Number
                {!canManageTripFinancials && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>

              <Input
                type="text"
                value={form.shipmentNumber}
                onChange={(e) =>
                  setForm({ ...form, shipmentNumber: e.target.value })
                }
                placeholder="e.g. SHP-0410-123"
              />
            </div>

            {/* CREW */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Crew Salary (₱)
                {canManageTripFinancials && form.status === "Working Day" && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>

              <Input
                type="text"
                inputMode="numeric"
                value={formatNumberWithComma(form.crewSalary)}
                onChange={(e) => {
                  const raw = sanitizeNumberInput(e.target.value);
                  setForm({ ...form, crewSalary: raw });
                }}
                placeholder="0"
                disabled={readOnlyForDriver}
              />
            </div>

            {/* RATE */}
            {/* ORIGINAL RATE */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Original Rate (₱)
                {canManageTripFinancials && form.status === "Working Day" && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>

              <Input
                type="text"
                inputMode="decimal"
                value={formatNumberWithComma(form.originalRate)}
                onChange={(e) => {
                  const raw = sanitizeNumberInput(e.target.value);
                  handleOriginalRateChange(raw);
                }}
                placeholder="0"
                disabled={readOnlyForDriver}
              />
            </div>

            {/* FINAL RATE */}
            <div className="space-y-1.5">
              <Label className="text-xs">Rate (₱)</Label>

              <Input
                type="text"
                value={formatNumberWithComma(form.rate)}
                placeholder="0"
                readOnly
                disabled={readOnlyForDriver}
                className="bg-muted"
              />

              <p className="text-[10px] leading-none text-muted-foreground">
                Auto-computed final rate
              </p>
            </div>

            {/* RATE ADJUSTMENT TYPE */}
            <div className="space-y-1.5">
              <Label className="text-xs">Rate Adjustment Type</Label>

              <Select
                value={form.rateAdjustmentType}
                disabled={readOnlyForDriver}
                onValueChange={(value) => {
                  const adjustmentType = value as
                    | "none"
                    | "amount"
                    | "percentage";

                  setForm((current) =>
                    recomputeRateFields(current, {
                      rateAdjustmentType: adjustmentType,
                      rateAdjustment:
                        adjustmentType === "none" ? "" : current.rateAdjustment,
                    }),
                  );
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {RATE_ADJUSTMENT_OPTIONS.map((option) => {
                    const Icon = option.icon;

                    return (
                      <SelectItem key={option.value} value={option.value}>
                        {Icon && <Icon className="size-4" />}
                        {option.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* RATE ADJUSTMENT */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  {form.rateAdjustmentType === "percentage"
                    ? "Rate Adjustment (%)"
                    : "Rate Adjustment (₱)"}
                </Label>

                {!readOnlyForDriver && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={handleOpenAdjustmentCalculator}
                    className="h-auto px-0 py-0 text-[11px]"
                  >
                    <Calculator data-icon="inline-start" />
                    Calculator
                  </Button>
                )}
              </div>

              <Input
                type="text"
                inputMode="decimal"
                value={formatNumberWithComma(form.rateAdjustment)}
                onChange={(e) => {
                  const raw = sanitizeNumberInput(e.target.value);
                  handleRateAdjustmentChange(raw);
                }}
                placeholder="0"
                disabled={
                  readOnlyForDriver || form.rateAdjustmentType === "none"
                }
                className={
                  form.rateAdjustmentType === "none" ? "bg-muted" : undefined
                }
              />
            </div>

            {/* AUTO VAT */}
            <div className="space-y-1.5">
              <Label className="text-xs">Auto-Compute VAT</Label>

              <Select
                value={form.autoVat ? "yes" : "no"}
                disabled={readOnlyForDriver}
                onValueChange={(value) => {
                  const autoVat = value === "yes";

                  setForm((current) =>
                    recomputeRateFields(current, {
                      autoVat,
                    }),
                  );
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* VAT */}
            <div className="space-y-1.5">
              <Label className="text-xs">VAT (₱)</Label>

              <Input
                type="text"
                value={formatNumberWithComma(form.vat)}
                placeholder="0"
                readOnly
                disabled={readOnlyForDriver}
                className="bg-muted"
              />

              <p className="text-[10px] leading-none text-muted-foreground">
                {form.autoVat ? "12% of Original Rate" : "VAT disabled"}
              </p>
            </div>

            {/* CASH ADVANCE */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cash Advance (₱)</Label>

              <Input
                type="text"
                inputMode="numeric"
                value={formatNumberWithComma(form.cashAdvance)}
                onChange={(e) => {
                  const raw = sanitizeNumberInput(e.target.value);
                  setForm({ ...form, cashAdvance: raw });
                }}
                placeholder="0"
                disabled={readOnlyForDriver}
              />
            </div>

            {/* REIMBURSEMENT CATEGORY */}
            <div className="space-y-1.5">
              <Label className="text-xs">Reimbursement Category</Label>

              <Popover
                open={openReimbursementCategory}
                onOpenChange={(open) => {
                  setOpenReimbursementCategory(open);

                  if (!open) {
                    setReimbursementCategorySearch("");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    disabled={readOnlyForDriver}
                    className={cn(
                      "w-full justify-between font-normal",
                      !form.reimbursementCategory && "text-muted-foreground",
                    )}
                  >
                    <span className="truncate">
                      {form.reimbursementCategory ||
                        "Search/Create Category..."}
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
                      value={reimbursementCategorySearch}
                      onValueChange={setReimbursementCategorySearch}
                      className="text-sm"
                    />

                    <CommandGroup>
                      {reimbursableCategories
                        .filter((category) =>
                          category
                            .toLowerCase()
                            .includes(
                              reimbursementCategorySearch.trim().toLowerCase(),
                            ),
                        )
                        .map((category) => (
                          <CommandItem
                            key={category}
                            value={category}
                            className="text-sm font-medium"
                            onSelect={() => {
                              setForm((current) => ({
                                ...current,
                                reimbursementCategory: category,
                              }));

                              setReimbursementCategorySearch("");
                              setOpenReimbursementCategory(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                form.reimbursementCategory === category
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />

                            {category}
                          </CommandItem>
                        ))}

                      {reimbursementCategorySearch.trim() &&
                        !reimbursableCategories.some(
                          (category) =>
                            category.toLowerCase() ===
                            reimbursementCategorySearch.trim().toLowerCase(),
                        ) && (
                          <CommandItem
                            value={`create-${reimbursementCategorySearch}`}
                            className="text-sm font-medium"
                            onSelect={async () => {
                              if (!selectedTruck) return;

                              const newCategory = reimbursementCategorySearch
                                .trim()
                                .toUpperCase();

                              try {
                                await api.put("/expenses/category-settings", {
                                  truckId: selectedTruck,
                                  name: newCategory,
                                  reimbursable: true,
                                });

                                setReimbursableCategories((current) =>
                                  [
                                    ...new Set([...current, newCategory]),
                                  ].sort(),
                                );

                                setForm((current) => ({
                                  ...current,
                                  reimbursementCategory: newCategory,
                                }));

                                setReimbursementCategorySearch("");
                                setOpenReimbursementCategory(false);
                              } catch (error) {
                                console.error(
                                  "Failed to create reimbursement category:",
                                  error,
                                );
                                toast.error(
                                  "Failed to create reimbursement category.",
                                );
                              }
                            }}
                          >
                            <Plus className="mr-2 size-4" />
                            Create "{reimbursementCategorySearch.trim()}"
                          </CommandItem>
                        )}

                      {!reimbursementCategorySearch.trim() &&
                        reimbursableCategories.length === 0 && (
                          <CommandEmpty className="text-xs">
                            No reimbursable categories found.
                          </CommandEmpty>
                        )}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* REIMBURSEMENTS */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Reimbursements (₱)
                {form.reimbursementCategory && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>

              <Input
                type="text"
                inputMode="numeric"
                value={formatNumberWithComma(form.reimbursements)}
                onChange={(e) => {
                  const raw = sanitizeNumberInput(e.target.value);

                  setForm((current) => ({
                    ...current,
                    reimbursements: raw,
                    reimbursementCategory:
                      !raw || Number(raw) <= 0
                        ? ""
                        : current.reimbursementCategory,
                  }));
                }}
                placeholder="0"
                disabled={readOnlyForDriver || !form.reimbursementCategory}
                className={!form.reimbursementCategory ? "bg-muted" : undefined}
              />
            </div>

            {/* NOTE */}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Expense Note</Label>

              <Textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                disabled={!editRow}
                rows={2}
                placeholder="Expense description will automatically appear here based on the date."
                className="min-h-[56px] resize-none"
              />
            </div>
          </div>

          {/* FOOTER */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>

            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : editRow ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adjustmentCalculatorOpen}
        onOpenChange={setAdjustmentCalculatorOpen}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Rate Adjustment Calculator</DialogTitle>

            <DialogDescription className="sr-only">
              Calculate and apply a rate adjustment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Original Rate (₱)</Label>

              <Input
                type="text"
                inputMode="decimal"
                value={formatNumberWithComma(calculatorOriginalRate)}
                onChange={(e) =>
                  setCalculatorOriginalRate(sanitizeNumberInput(e.target.value))
                }
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Actual Rate Received (₱)</Label>

              <Input
                type="text"
                inputMode="decimal"
                value={formatNumberWithComma(calculatorActualRate)}
                onChange={(e) =>
                  setCalculatorActualRate(sanitizeNumberInput(e.target.value))
                }
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Deduction</span>
                <span className="font-semibold">
                  ₱
                  {calculatorDeduction.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Adjustment Percentage
                </span>
                <span className="font-semibold">
                  {calculatorPercentage.toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">You Receive</span>
                <span className="font-semibold">
                  {(100 - calculatorPercentage).toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Apply As</Label>

              <Select
                value={calculatorApplyAs}
                onValueChange={(value) =>
                  setCalculatorApplyAs(value as "amount" | "percentage")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="amount">
                    <PhilippinePeso className="size-4" />
                    Amount
                  </SelectItem>

                  <SelectItem value="percentage">
                    <Percent className="size-4" />
                    Percentage
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdjustmentCalculatorOpen(false)}
            >
              Cancel
            </Button>

            <Button type="button" onClick={handleApplyAdjustmentCalculator}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
