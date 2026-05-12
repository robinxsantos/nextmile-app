import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAppStore, type TripRow } from "../../store/useAppStore";
import { useAuthStore } from "../../store/useAuthStore";
import { ClipboardCopy } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import {
  Select as UiSelect,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface TripModalProps {
  open: boolean;
  onClose: () => void;
  editRow?: TripRow | null;
  duplicateFrom?: TripRow | null;
}

const STATUS_OPTIONS = [
  { value: "Working Day", label: "🟢 Working Day" },
  { value: "Day Off", label: "⚪ Day Off" },
  { value: "Holiday", label: "🟡 Holiday" },
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
  const { selectedTruck, truckOptions, addTrip, updateTrip, getLastTrip } =
    useAppStore();
  const { isAdmin } = useAuthStore();
  const admin = isAdmin();

  const [loading, setLoading] = useState(false);
  const [copyingLast, setCopyingLast] = useState(false);
  const [form, setForm] = useState({
    date: new Date(),
    status: "Working Day",
    shipmentNumber: "",
    rate: "",
    trips: "",
    crewSalary: "",
    cashAdvance: "",
    reimbursements: "",
    note: "",
  });

  const [openDate, setOpenDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(form.date);

  const prefillFromTrip = (src: TripRow, useToday = true) => {
    setForm({
      date: useToday
        ? new Date()
        : src.dateIso
          ? new Date(src.dateIso + "T00:00:00")
          : new Date(),
      status: src.status || "Working Day",
      shipmentNumber: src.shipmentNumber || "",
      rate: String(src.rate || ""),
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
        rate: "",
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

  const handleRateChange = (val: string) => {
    setForm((f) => {
      const updated = { ...f, rate: val };
      if (f.status === "Working Day" && val) {
        if (!f.trips || f.trips === "0") updated.trips = "1";
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!selectedTruck) {
      toast.error("Please select a truck first!");
      return;
    }

    if (!admin) {
      if (!form.shipmentNumber.trim()) {
        toast.error("Shipment Number is required.");
        return;
      }
    } else {
      if (form.status === "Working Day" && !form.rate) {
        toast.error("Rate is required for Working Day.");
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
        rate: admin ? Number(form.rate) || 0 : 0,
        trips: admin ? Number(form.trips) || 0 : 0,
        crewSalary: admin ? Number(form.crewSalary) || 0 : 0,
        cashAdvance: admin ? Number(form.cashAdvance) || 0 : 0,
        reimbursements: admin ? Number(form.reimbursements) || 0 : 0,
        note: form.note,
      };

      if (editRow) {
        await updateTrip(editRow._id, payload);
      } else {
        await addTrip(payload);
      }
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
    "w-full h-11 rounded-md border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:border-ring outline-none transition-colors";

  const modalTitle = editRow
    ? `Edit Trip - ${selectedTruckName} - ${editRow.dateText}`
    : duplicateFrom
      ? `Duplicate Trip for ${selectedTruckName}`
      : `Add Trip for ${selectedTruckName}`;

  const readOnlyForDriver = !admin;

  return (
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
          <div className="col-span-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Date
            </label>

            <Popover open={openDate} onOpenChange={setOpenDate}>
              <PopoverTrigger asChild>
                <button
                  className={inputClass + " flex items-center justify-between"}
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
            <UiSelect
              value={form.status}
              onValueChange={(val) => setForm({ ...form, status: val })}
            >
              <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </UiSelect>
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

          {/* RATE */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Rate (₱)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formatNumberWithComma(form.rate)}
              onChange={(e) => {
                const raw = sanitizeNumberInput(e.target.value);
                handleRateChange(raw);
              }}
              placeholder="0"
              disabled={readOnlyForDriver}
              className={
                inputClass +
                (readOnlyForDriver ? " opacity-60 cursor-not-allowed" : "")
              }
            />
          </div>

          {/* TRIPS */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Number of Trips
            </label>
            <input
              type="number"
              value={form.trips}
              onChange={(e) => setForm({ ...form, trips: e.target.value })}
              placeholder="1"
              disabled={readOnlyForDriver}
              className={
                inputClass +
                (readOnlyForDriver ? " opacity-60 cursor-not-allowed" : "")
              }
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
          <div className="col-span-2">
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
  );
}
