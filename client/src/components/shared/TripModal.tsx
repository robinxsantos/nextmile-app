import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAppStore, type TripRow } from "../../store/useAppStore";
import { useAuthStore } from "../../store/useAuthStore";
import {
  ClipboardCopy,
  CalendarDays,
  ChevronsUpDown,
  Check,
  TruckElectric,
  BedDouble,
  TentTree,
  Calculator,
  Percent,
  PhilippinePeso,
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";

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
  const {
    selectedTruck,
    truckOptions,
    addTrip,
    updateTrip,
    getLastTrip,
    fetchDashboard,
  } = useAppStore();
  const { user } = useAuthStore();

  const canManageTripFinancials =
    user?.role === "admin" || user?.role === "manager";

  const [loading, setLoading] = useState(false);
  const [copyingLast, setCopyingLast] = useState(false);
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
    reimbursements: "",
    note: "",
  });

  const [openDate, setOpenDate] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);
  const [openAdjustmentType, setOpenAdjustmentType] = useState(false);
  const [openAutoVat, setOpenAutoVat] = useState(false);
  const [openCalculatorApplyAs, setOpenCalculatorApplyAs] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(form.date);
  const [adjustmentCalculatorOpen, setAdjustmentCalculatorOpen] =
    useState(false);

  const [calculatorOriginalRate, setCalculatorOriginalRate] = useState("");
  const [calculatorActualRate, setCalculatorActualRate] = useState("");

  const [calculatorApplyAs, setCalculatorApplyAs] = useState<
    "amount" | "percentage"
  >("amount");

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
        reimbursements: "",
        note: "",
      });

      setSelectedDate(today); // 🔥 IMPORTANT
    }
  }, [editRow, duplicateFrom, open]);

  const handleCopyFromLast = async () => {
    if (!selectedTruck) {
      toast.error("Please select a truck first!");
      return;
    }
    setCopyingLast(true);
    try {
      const lastTrip = await getLastTrip(selectedTruck);
      if (lastTrip) {
        prefillFromTrip(lastTrip, true);
        toast.success("Copied from last trip!");
      } else {
        toast.info("No previous trips found for this truck.", {
          duration: 4000,
        });
      }
    } catch {
      toast.error("Failed to fetch last trip.");
    } finally {
      setCopyingLast(false);
    }
  };

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
  const inputClass =
    "w-full h-11 rounded-md border border-border bg-background px-3 text-xs focus:ring-2 focus:ring-ring focus:border-ring outline-none transition-colors";

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
        <DialogContent
          className="sm:max-w-[700px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>

          {/* BODY */}
          <div className="grid grid-cols-2 gap-4">
            {/* DATE */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Date
              </label>

              <Popover open={openDate} onOpenChange={setOpenDate}>
                <PopoverTrigger asChild>
                  <button
                    className={
                      inputClass + " flex items-center justify-between"
                    }
                  >
                    {selectedDate
                      ? format(selectedDate, "MMM d, yyyy")
                      : "Select date"}
                    <CalendarDays className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0 z-[9999]">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => {
                      if (!d) return;
                      setSelectedDate(d);
                      setForm({ ...form, date: d });
                      setOpenDate(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {!editRow && (
                <button
                  type="button"
                  onClick={handleCopyFromLast}
                  disabled={copyingLast}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:opacity-80 disabled:opacity-50"
                >
                  <ClipboardCopy size={14} />
                  {copyingLast ? "Loading..." : "Copy from Last Trip"}
                </button>
              )}
            </div>

            {/* STATUS */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Status
              </label>

              <Popover open={openStatus} onOpenChange={setOpenStatus}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    className="w-full h-11 rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {(() => {
                        const selectedStatus = STATUS_OPTIONS.find(
                          (opt) => opt.value === form.status,
                        );

                        if (!selectedStatus) {
                          return (
                            <span className="truncate text-muted-foreground">
                              Select status
                            </span>
                          );
                        }

                        const Icon = selectedStatus.icon;

                        return (
                          <>
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {selectedStatus.label}
                            </span>
                          </>
                        );
                      })()}
                    </div>

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandGroup>
                      {STATUS_OPTIONS.map((opt) => {
                        const Icon = opt.icon;

                        return (
                          <CommandItem
                            key={opt.value}
                            value={opt.label}
                            className="text-xs"
                            onSelect={() => {
                              setForm({
                                ...form,
                                status: opt.value,
                              });

                              setOpenStatus(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                form.status === opt.value
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />

                            <Icon className="mr-2 h-4 w-4" />
                            {opt.label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* SHIPMENT */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Shipment Number
              </label>
              <input
                type="text"
                value={form.shipmentNumber}
                onChange={(e) =>
                  setForm({ ...form, shipmentNumber: e.target.value })
                }
                placeholder="e.g. SHP-0410-123"
                className={inputClass}
              />
            </div>

            {/* CREW */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Crew Salary (₱)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberWithComma(form.crewSalary)}
                onChange={(e) => {
                  const raw = sanitizeNumberInput(e.target.value);
                  setForm({ ...form, crewSalary: raw });
                }}
                placeholder="0"
                disabled={readOnlyForDriver}
                className={
                  inputClass +
                  (readOnlyForDriver ? " opacity-60 cursor-not-allowed" : "")
                }
              />
            </div>

            {/* RATE */}
            {/* ORIGINAL RATE */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Original Rate (₱)
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={formatNumberWithComma(form.originalRate)}
                onChange={(e) => {
                  const raw = sanitizeNumberInput(e.target.value);
                  handleOriginalRateChange(raw);
                }}
                placeholder="0"
                disabled={readOnlyForDriver}
                className={
                  inputClass +
                  (readOnlyForDriver ? " opacity-60 cursor-not-allowed" : "")
                }
              />
            </div>

            {/* FINAL RATE */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Rate (₱)
              </label>

              <input
                type="text"
                value={formatNumberWithComma(form.rate)}
                placeholder="0"
                readOnly
                disabled={readOnlyForDriver}
                className={
                  inputClass +
                  " bg-muted " +
                  (readOnlyForDriver ? " opacity-60 cursor-not-allowed" : "")
                }
              />

              <p className="mt-1 text-[10px] text-muted-foreground">
                Auto-computed final rate
              </p>
            </div>

            {/* RATE ADJUSTMENT TYPE */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Rate Adjustment Type
              </label>

              <Popover
                open={openAdjustmentType}
                onOpenChange={setOpenAdjustmentType}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    disabled={readOnlyForDriver}
                    className={
                      inputClass +
                      " flex items-center justify-between " +
                      (readOnlyForDriver
                        ? " opacity-60 cursor-not-allowed"
                        : "")
                    }
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const selected = RATE_ADJUSTMENT_OPTIONS.find(
                          (option) => option.value === form.rateAdjustmentType,
                        );

                        if (!selected) return <span>None</span>;

                        const Icon = selected.icon;

                        return (
                          <>
                            {Icon && <Icon className="h-4 w-4 shrink-0" />}
                            <span>{selected.label}</span>
                          </>
                        );
                      })()}
                    </div>

                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandGroup>
                      {RATE_ADJUSTMENT_OPTIONS.map((option) => {
                        const Icon = option.icon;

                        return (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            className="text-xs"
                            onSelect={() => {
                              setForm((current) =>
                                recomputeRateFields(current, {
                                  rateAdjustmentType: option.value,
                                  rateAdjustment:
                                    option.value === "none"
                                      ? ""
                                      : current.rateAdjustment,
                                }),
                              );

                              setOpenAdjustmentType(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                form.rateAdjustmentType === option.value
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />

                            {Icon && <Icon className="mr-2 h-4 w-4" />}

                            {option.label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* RATE ADJUSTMENT */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  {form.rateAdjustmentType === "percentage"
                    ? "Rate Adjustment (%)"
                    : "Rate Adjustment (₱)"}
                </label>

                {!readOnlyForDriver && (
                  <button
                    type="button"
                    onClick={handleOpenAdjustmentCalculator}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    Calculator
                  </button>
                )}
              </div>

              <input
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
                  inputClass +
                  (form.rateAdjustmentType === "none" ? " bg-muted" : "") +
                  (readOnlyForDriver ? " opacity-60 cursor-not-allowed" : "")
                }
              />
            </div>

            {/* AUTO VAT */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Auto-Compute VAT
              </label>

              <Popover open={openAutoVat} onOpenChange={setOpenAutoVat}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    disabled={readOnlyForDriver}
                    className={
                      inputClass +
                      " flex items-center justify-between " +
                      (readOnlyForDriver
                        ? " opacity-60 cursor-not-allowed"
                        : "")
                    }
                  >
                    <span>{form.autoVat ? "Yes" : "No"}</span>

                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandGroup>
                      {[
                        ["yes", "Yes"],
                        ["no", "No"],
                      ].map(([value, label]) => (
                        <CommandItem
                          key={value}
                          value={label}
                          className="text-xs"
                          onSelect={() => {
                            const autoVat = value === "yes";

                            setForm((current) =>
                              recomputeRateFields(current, {
                                autoVat,
                              }),
                            );

                            setOpenAutoVat(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              form.autoVat === (value === "yes")
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />

                          {label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* VAT */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                VAT (₱)
              </label>

              <input
                type="text"
                value={formatNumberWithComma(form.vat)}
                placeholder="0"
                readOnly
                disabled={readOnlyForDriver}
                className={
                  inputClass +
                  " bg-muted " +
                  (readOnlyForDriver ? " opacity-60 cursor-not-allowed" : "")
                }
              />

              <p className="mt-1 text-[10px] text-muted-foreground">
                {form.autoVat ? "12% of Original Rate" : "VAT disabled"}
              </p>
            </div>

            {/* CASH ADVANCE */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Cash Advance (₱)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberWithComma(form.cashAdvance)}
                onChange={(e) => {
                  const raw = sanitizeNumberInput(e.target.value);
                  setForm({ ...form, cashAdvance: raw });
                }}
                placeholder="0"
                disabled={readOnlyForDriver}
                className={
                  inputClass +
                  (readOnlyForDriver ? " opacity-60 cursor-not-allowed" : "")
                }
              />
            </div>

            {/* REIMBURSE */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Reimbursements (₱)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberWithComma(form.reimbursements)}
                onChange={(e) => {
                  const raw = sanitizeNumberInput(e.target.value);
                  setForm({ ...form, reimbursements: raw });
                }}
                placeholder="0"
                disabled={readOnlyForDriver}
                className={
                  inputClass +
                  (readOnlyForDriver ? " opacity-60 cursor-not-allowed" : "")
                }
              />
            </div>

            {/* NOTE */}
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Expense Note
              </label>

              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                disabled={!editRow}
                className={
                  inputClass +
                  " min-h-[80px] py-2.5 resize-none " +
                  (!editRow ? "opacity-60 cursor-not-allowed" : "")
                }
                rows={3}
                placeholder="Expense description will automatically appear here based on the date."
              />
            </div>
          </div>

          {/* FOOTER */}
          <DialogFooter className="mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : editRow ? "Update" : "Save"}
            </button>
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
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Original Rate (₱)
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={formatNumberWithComma(calculatorOriginalRate)}
                onChange={(e) =>
                  setCalculatorOriginalRate(sanitizeNumberInput(e.target.value))
                }
                placeholder="0"
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Actual Rate Received (₱)
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={formatNumberWithComma(calculatorActualRate)}
                onChange={(e) =>
                  setCalculatorActualRate(sanitizeNumberInput(e.target.value))
                }
                placeholder="0"
                className={inputClass}
              />
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
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

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Apply As
              </label>

              <Popover
                open={openCalculatorApplyAs}
                onOpenChange={setOpenCalculatorApplyAs}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    className={
                      inputClass + " flex items-center justify-between"
                    }
                  >
                    <span>
                      {calculatorApplyAs === "amount" ? "Amount" : "Percentage"}
                    </span>

                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandGroup>
                      {[
                        ["amount", "Amount"],
                        ["percentage", "Percentage"],
                      ].map(([value, label]) => (
                        <CommandItem
                          key={value}
                          value={label}
                          className="text-xs"
                          onSelect={() => {
                            setCalculatorApplyAs(
                              value as "amount" | "percentage",
                            );

                            setOpenCalculatorApplyAs(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              calculatorApplyAs === value
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />

                          {label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <button
              type="button"
              onClick={() => setAdjustmentCalculatorOpen(false)}
              className="px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApplyAdjustmentCalculator}
              className="px-5 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition"
            >
              Apply
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
