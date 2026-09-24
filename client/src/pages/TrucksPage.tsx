import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppStore, type TruckRow } from "../store/useAppStore";
import KpiCard from "../components/shared/KpiCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Truck,
  CheckCircle2,
  ArrowUpDown,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  Wrench,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  Select as UiSelect,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

const formatNumberWithComma = (value: string) => {
  const num = value.replace(/,/g, "");
  if (!num) return "";
  return Number(num).toLocaleString();
};

const STATUS_OPTIONS = [
  { value: "Active", label: "🟢 Active" },
  { value: "Inactive", label: "⚪ Inactive" },
];

const DAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const CUTOFF_TYPE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const BILLING_TYPE_OPTIONS = [
  { value: "subcontracted", label: "Subcontracted" },
  { value: "direct", label: "Direct" },
];

const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const kmDisplay = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return "-";
  return `${Number(value).toLocaleString()} km`;
};

export default function TrucksPage() {
  const {
    truckRows,
    truckStats,
    fetchTrucks,
    initApp,
    addTruck,
    updateTruck,
    deleteTruck,
    addChangeOilRecord,
    updateChangeOilRecord,
    deleteChangeOilRecord,
  } = useAppStore();
  const [truckModal, setTruckModal] = useState(false);
  const [editRow, setEditRow] = useState<TruckRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<TruckRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [changeOilModal, setChangeOilModal] = useState<TruckRow | null>(null);

  const [changeOilForm, setChangeOilForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    odometer: "",
    notes: "",
  });

  const [changeOilLoading, setChangeOilLoading] = useState(false);
  const [editingOilRecordId, setEditingOilRecordId] = useState<string | null>(
    null,
  );

  const [deleteOilRecordId, setDeleteOilRecordId] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState({
    truckName: "",
    status: "Active",
    cutoffType: "weekly",
    billingType: "subcontracted",
    billedTo: "",
    client: "",
    cutoffStart: "1",
    cutoffEnd: "6",
    payday: "6",
    dayOff: "0",
  });

  useEffect(() => {
    initApp();
    fetchTrucks();
  }, [initApp, fetchTrucks]);

  const openAdd = () => {
    setEditRow(null);
    setForm({
      truckName: "",
      status: "Active",
      cutoffType: "weekly",
      billingType: "subcontracted",
      billedTo: "",
      client: "",
      cutoffStart: "1",
      cutoffEnd: "6",
      payday: "6",
      dayOff: "0",
    });
    setTruckModal(true);
  };

  const openEdit = (row: TruckRow) => {
    setEditRow(row);
    setForm({
      truckName: row.truckName,
      status: row.status,
      cutoffType: row.cutoffType || "weekly",
      billingType: row.billingType || "subcontracted",
      billedTo: row.billedTo || "",
      client: row.client ?? row.notes ?? "",
      cutoffStart: String(row.cutoffStart),
      cutoffEnd: String(row.cutoffEnd),
      payday: String(row.payday),
      dayOff: String(row.dayOff),
    });
    setTruckModal(true);
  };

  const handleSave = async () => {
    if (!form.truckName.trim()) {
      toast.error("Truck name is required.", { duration: 6000 });
      return;
    }

    if (form.billingType === "subcontracted" && !form.billedTo.trim()) {
      toast.error("Billed To is required for subcontracted trucks.", {
        duration: 6000,
      });
      return;
    }

    if (!form.client.trim()) {
      toast.error("Client is required.", { duration: 6000 });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        truckName: form.truckName.trim(),
        status: form.status,
        cutoffType: form.cutoffType,

        billingType: form.billingType,
        billedTo:
          form.billingType === "subcontracted" ? form.billedTo.trim() : "",

        client: form.client.trim(),
        notes: form.client.trim(),
        cutoffStart: Number(form.cutoffStart),
        cutoffEnd: Number(form.cutoffEnd),
        payday: Number(form.payday),
        dayOff: form.cutoffType === "weekly" ? Number(form.dayOff) : 0,
      };

      if (editRow) {
        await updateTruck(editRow._id, payload);
      } else {
        await addTruck(payload);
      }
      setTruckModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save truck", {
        duration: 7000,
      });
    } finally {
      setLoading(false);
    }
  };

  const openChangeOilHistory = (row: TruckRow) => {
    setChangeOilModal(row);

    setChangeOilForm({
      date: new Date().toISOString().slice(0, 10),
      odometer:
        row.lastChangeOil !== undefined && row.lastChangeOil !== null
          ? String(row.lastChangeOil)
          : "",
      notes: "",
    });
  };

  const handleAddChangeOilRecord = async () => {
    if (!changeOilModal) return;

    if (!changeOilForm.date) {
      toast.error("Change oil date is required.");
      return;
    }

    const odometer = Number(changeOilForm.odometer.replace(/,/g, ""));

    if (!Number.isFinite(odometer) || odometer < 0) {
      toast.error("Odometer must be a valid number.");
      return;
    }

    setChangeOilLoading(true);

    try {
      await addChangeOilRecord(changeOilModal._id, {
        date: changeOilForm.date,
        odometer,
        notes: changeOilForm.notes.trim(),
      });

      const refreshedTruck = useAppStore
        .getState()
        .truckRows.find((truck) => truck._id === changeOilModal._id);

      if (refreshedTruck) {
        setChangeOilModal(refreshedTruck);
      }

      setChangeOilForm({
        date: new Date().toISOString().slice(0, 10),
        odometer: String(odometer),
        notes: "",
      });
    } catch {
      // Toast is already handled by the store.
    } finally {
      setChangeOilLoading(false);
    }
  };

  const handleEditChangeOilRecord = (record: {
    _id: string;
    date: string;
    odometer: number | null;
    notes: string;
  }) => {
    setEditingOilRecordId(record._id);

    setChangeOilForm({
      date: new Date(record.date).toISOString().slice(0, 10),
      odometer:
        record.odometer !== null && record.odometer !== undefined
          ? String(record.odometer)
          : "",
      notes: record.notes || "",
    });
  };

  const handleUpdateChangeOilRecord = async () => {
    if (!changeOilModal || !editingOilRecordId) return;

    const odometer = Number(changeOilForm.odometer.replace(/,/g, ""));

    if (!changeOilForm.date) {
      toast.error("Change oil date is required.");
      return;
    }

    if (!Number.isFinite(odometer) || odometer < 0) {
      toast.error("Odometer must be a valid number.");
      return;
    }

    setChangeOilLoading(true);

    try {
      await updateChangeOilRecord(changeOilModal._id, editingOilRecordId, {
        date: changeOilForm.date,
        odometer,
        notes: changeOilForm.notes.trim(),
      });

      const refreshedTruck = useAppStore
        .getState()
        .truckRows.find((truck) => truck._id === changeOilModal._id);

      if (refreshedTruck) {
        setChangeOilModal(refreshedTruck);
      }

      setEditingOilRecordId(null);

      setChangeOilForm({
        date: new Date().toISOString().slice(0, 10),
        odometer: refreshedTruck?.lastChangeOil
          ? String(refreshedTruck.lastChangeOil)
          : "",
        notes: "",
      });
    } finally {
      setChangeOilLoading(false);
    }
  };

  const handleDeleteChangeOilRecord = async () => {
    if (!changeOilModal || !deleteOilRecordId) return;

    setChangeOilLoading(true);

    try {
      await deleteChangeOilRecord(changeOilModal._id, deleteOilRecordId);

      const refreshedTruck = useAppStore
        .getState()
        .truckRows.find((truck) => truck._id === changeOilModal._id);

      if (refreshedTruck) {
        setChangeOilModal(refreshedTruck);
      }

      // If the deleted record was being edited, exit edit mode
      if (editingOilRecordId === deleteOilRecordId) {
        setEditingOilRecordId(null);

        setChangeOilForm({
          date: new Date().toISOString().slice(0, 10),
          odometer:
            refreshedTruck?.lastChangeOil != null
              ? String(refreshedTruck.lastChangeOil)
              : "",
          notes: "",
        });
      }

      setDeleteOilRecordId(null);
    } catch {
      // Store already shows the error toast
    } finally {
      setChangeOilLoading(false);
    }
  };

  const inputClass =
    "w-full h-11 rounded-md border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:border-ring outline-none transition-colors";

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-[1.45rem] font-bold tracking-tight">
              Truck Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage fleet records and dedicated data sheets per truck.
            </p>
          </div>
        </div>
      </div>

      <div className="border rounded-lg bg-background p-3.5 mb-3.5">
        <div className="flex justify-end">
          <button
            onClick={openAdd}
            className="h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
          >
            <Plus size={18} /> Add Truck
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
        <KpiCard
          label="Total Trucks"
          value={truckStats.total.toLocaleString()}
          subtitle="Registered fleet entries"
          icon={<Truck size={22} />}
          colorClass="bg-muted text-foreground"
        />
        <KpiCard
          label="Active"
          value={truckStats.active.toLocaleString()}
          subtitle="Available and active"
          icon={<CheckCircle2 size={22} />}
          colorClass="bg-muted text-foreground"
        />
        <KpiCard
          label="Inactive"
          value={truckStats.inactive.toLocaleString()}
          subtitle="Paused or archived"
          icon={<ArrowUpDown size={22} />}
          colorClass="bg-muted text-foreground"
        />
        <KpiCard
          label="Data Sheets"
          value={truckStats.sheets.toLocaleString()}
          subtitle="Auto-created truck sheets"
          icon={<BarChart3 size={22} />}
          colorClass="bg-muted text-foreground"
        />
      </div>

      <div className="border rounded-lg bg-background p-3.5 overflow-hidden">
        <div className="mb-3">
          <h2 className="text-base font-bold tracking-tight">Fleet Records</h2>
          <p className="text-sm text-muted-foreground">
            Truck registry and linked data.
          </p>
        </div>

        {/* Desktop Table */}
        <div className="rounded-[18px] overflow-auto border border-slate-200/60 dark:border-slate-700/60 bg-background hidden md:block">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-muted/40 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-3 py-3 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Truck Name
                </th>
                {[
                  "Status",
                  "Date Added",
                  "Billed To",
                  "Client",
                  "Last Change Oil",
                  "Cutoff Start",
                  "Cutoff End",
                  "Payday",
                  "Day Off",
                ].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-10 bg-muted/40 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-3 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
                <th className="sticky top-0 right-0 z-20 bg-muted/40 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-3 py-3 whitespace-nowrap shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {truckRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-400">
                    No trucks found
                  </td>
                </tr>
              ) : (
                truckRows.map((r) => {
                  const client = r.client ?? r.notes ?? "";
                  return (
                    <tr key={r._id} className="hover:bg-muted/50">
                      <td className="sticky left-0 z-[5] bg-white dark:bg-slate-900 text-center text-sm px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 font-bold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {r.truckName}
                      </td>
                      <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center min-w-[84px] px-2.5 py-1 rounded-full text-[0.72rem] font-bold",
                            r.status === "Active"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-slate-400/12 text-slate-400",
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        {r.dateAdded}
                      </td>
                      <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        {r.billingType === "direct"
                          ? "Direct"
                          : r.billedTo || "—"}
                      </td>

                      <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        {client}
                      </td>

                      <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        {kmDisplay(r.lastChangeOil)}
                      </td>
                      <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        {r.cutoffType === "monthly"
                          ? String(r.cutoffStart)
                          : r.cutoffStartText}
                      </td>
                      <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        {r.cutoffType === "monthly"
                          ? String(r.cutoffEnd)
                          : r.cutoffEndText}
                      </td>
                      <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        {r.cutoffType === "monthly"
                          ? String(r.payday)
                          : r.paydayText}
                      </td>
                      <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                        {r.cutoffType === "monthly" ? "-" : r.dayOffText}
                      </td>
                      <td className="sticky right-0 z-[5] bg-white dark:bg-slate-900 text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openChangeOilHistory(r)}
                            title="Change Oil"
                            className="w-[34px] h-[34px] rounded-md inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-muted hover:text-foreground transition-all"
                          >
                            <Wrench size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(r)}
                            className="w-[34px] h-[34px] rounded-md inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-muted hover:text-foreground transition-all"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteModal(r)}
                            className="w-[34px] h-[34px] rounded-md inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="flex flex-col gap-3 md:hidden">
          {truckRows.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No trucks found
            </div>
          ) : (
            truckRows.map((r) => {
              const client = r.client ?? r.notes ?? "";
              return (
                <div
                  key={r._id}
                  className="border rounded-md bg-background p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-sm">{r.truckName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {r.dateAdded}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[0.72rem] font-bold",
                        r.status === "Active"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-slate-400/12 text-slate-400",
                      )}
                    >
                      {r.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 mb-1">
                    Billed To:{" "}
                    {r.billingType === "direct" ? "Direct" : r.billedTo || "—"}
                  </div>

                  {client && (
                    <div className="text-xs text-slate-500 mb-1">
                      Client: {client}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mb-3">
                    Last Change Oil:{" "}
                    {r.lastChangeOil != null
                      ? `${Number(r.lastChangeOil).toLocaleString()} km`
                      : "-"}
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
                    <div>
                      <div className="text-slate-500">Cutoff Start</div>
                      <div className="font-semibold">{r.cutoffStartText}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Cutoff End</div>
                      <div className="font-semibold">{r.cutoffEndText}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Payday</div>
                      <div className="font-semibold">{r.paydayText}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Day Off</div>
                      <div className="font-semibold">{r.dayOffText}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => openChangeOilHistory(r)}
                      className="h-9 px-3 rounded-md inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-muted hover:text-foreground transition-all text-xs font-semibold"
                    >
                      <Wrench size={14} />
                      Change Oil
                    </button>
                    <button
                      onClick={() => openEdit(r)}
                      className="flex-1 h-9 rounded-md inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-blue-500/10 hover:text-blue-600 transition-all text-xs font-semibold"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteModal(r)}
                      className="h-9 w-9 rounded-md inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-red-500/10 hover:text-red-500 transition-all"
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

      {/* Truck Modal */}
      <>
        {/* ADD / EDIT TRUCK */}
        <Dialog open={truckModal} onOpenChange={setTruckModal}>
          <DialogContent
            className="sm:max-w-[700px]"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{editRow ? "Edit Truck" : "Add Truck"}</DialogTitle>
            </DialogHeader>

            {/* ✅ ORIGINAL FORM (UNCHANGED) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Truck Name
                </label>
                <input
                  type="text"
                  value={form.truckName}
                  onChange={(e) =>
                    setForm({ ...form, truckName: e.target.value })
                  }
                  placeholder="e.g. AAA_1234"
                  className={inputClass}
                />
              </div>

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

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Cutoff Type
                </label>

                <UiSelect
                  value={form.cutoffType}
                  onValueChange={(val) => {
                    setForm((prev) =>
                      val === "monthly"
                        ? {
                            ...prev,
                            cutoffType: val,
                            cutoffStart: "26",
                            cutoffEnd: "25",
                            payday: "26",
                            dayOff: "0",
                          }
                        : {
                            ...prev,
                            cutoffType: val,
                            cutoffStart: "1",
                            cutoffEnd: "6",
                            payday: "6",
                            dayOff: "0",
                          },
                    );
                  }}
                >
                  <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {CUTOFF_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </UiSelect>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Billing Type
                </label>

                <UiSelect
                  value={form.billingType}
                  onValueChange={(val) =>
                    setForm((prev) => ({
                      ...prev,
                      billingType: val,
                      billedTo: val === "direct" ? "" : prev.billedTo,
                    }))
                  }
                >
                  <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {BILLING_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </UiSelect>
              </div>

              {form.billingType === "subcontracted" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Billed To
                  </label>

                  <input
                    type="text"
                    value={form.billedTo}
                    onChange={(e) =>
                      setForm({ ...form, billedTo: e.target.value })
                    }
                    placeholder="e.g. StarTrak Trucking Services"
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Client
                </label>

                <input
                  type="text"
                  value={form.client}
                  onChange={(e) => setForm({ ...form, client: e.target.value })}
                  placeholder="e.g. Pepsi"
                  className={inputClass}
                />
              </div>

              {/* 🔥 KEEP YOUR WEEKLY / MONTHLY BLOCK EXACTLY */}
              {form.cutoffType === "weekly" ? (
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                    Cutoff Settings
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["cutoffStart", "Cutoff Start"],
                      ["cutoffEnd", "Cutoff End"],
                      ["payday", "Payday"],
                      ["dayOff", "Day Off"],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className="text-xs text-muted-foreground mb-1.5 block">
                          {label}
                        </label>

                        <UiSelect
                          value={form[key as keyof typeof form]}
                          onValueChange={(val) =>
                            setForm({ ...form, [key]: val })
                          }
                        >
                          <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {DAY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </UiSelect>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                    Monthly Cutoff Settings
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    {["cutoffStart", "cutoffEnd", "payday"].map((key) => (
                      <div key={key}>
                        <label className="text-xs text-muted-foreground mb-1.5 block">
                          {key}
                        </label>

                        <UiSelect
                          value={form[key as keyof typeof form]}
                          onValueChange={(val) =>
                            setForm({ ...form, [key]: val })
                          }
                        >
                          <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {MONTH_DAY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </UiSelect>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    <strong>Monthly Cutoff</strong>
                    <br />
                    When the cutoff start date is set to the 1st day of the
                    month and the cutoff end date is set to the 31st, the cutoff
                    period covers the entire calendar month.
                    <br />
                    <strong>Cross-Month Cutoff</strong>
                    <br />
                    When the cutoff start date is set to the 26th and the cutoff
                    end date is set to the 25th, the cutoff period begins on the
                    26th of the current month and ends on the 25th of the
                    following month.
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <DialogFooter className="mt-4">
              <button
                onClick={() => setTruckModal(false)}
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

        {/* CHANGE OIL HISTORY */}
        <Dialog
          open={!!changeOilModal}
          onOpenChange={(open) => {
            if (!open) setChangeOilModal(null);
          }}
        >
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>
                Service History
                {changeOilModal ? ` — ${changeOilModal.truckName}` : ""}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* CURRENT */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Last Change Oil
                </div>

                <div className="mt-1 text-xl font-bold">
                  {changeOilModal?.lastChangeOil != null
                    ? `${Number(changeOilModal.lastChangeOil).toLocaleString()} km`
                    : "No record"}
                </div>
              </div>

              {/* ADD RECORD */}
              <div>
                <div className="text-sm font-bold mb-3">
                  Add Change Oil Record
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Date
                    </label>

                    <input
                      type="date"
                      value={changeOilForm.date}
                      onChange={(e) =>
                        setChangeOilForm((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Odometer
                    </label>

                    <div className="relative">
                      <input
                        type="text"
                        value={formatNumberWithComma(changeOilForm.odometer)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/,/g, "");

                          if (!/^\d*$/.test(raw)) return;

                          setChangeOilForm((prev) => ({
                            ...prev,
                            odometer: raw,
                          }));
                        }}
                        placeholder="e.g. 510,250"
                        className={`${inputClass} pr-12`}
                      />

                      <div className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-muted-foreground">
                        KM
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Notes
                    </label>

                    <input
                      type="text"
                      value={changeOilForm.notes}
                      onChange={(e) =>
                        setChangeOilForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="e.g. Change oil + oil filter"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex justify-end items-center gap-3 mt-3">
                  {editingOilRecordId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOilRecordId(null);

                        setChangeOilForm({
                          date: new Date().toISOString().slice(0, 10),
                          odometer:
                            changeOilModal?.lastChangeOil != null
                              ? String(changeOilModal.lastChangeOil)
                              : "",
                          notes: "",
                        });
                      }}
                      disabled={changeOilLoading}
                      className="h-10 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    onClick={
                      editingOilRecordId
                        ? handleUpdateChangeOilRecord
                        : handleAddChangeOilRecord
                    }
                    disabled={changeOilLoading}
                    className="h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {editingOilRecordId ? (
                      <Pencil size={16} />
                    ) : (
                      <Plus size={16} />
                    )}

                    {changeOilLoading
                      ? "Saving..."
                      : editingOilRecordId
                        ? "Update Record"
                        : "Add Record"}
                  </button>
                </div>
              </div>

              {/* HISTORY */}
              <div>
                <div className="text-sm font-bold mb-3">History</div>

                <div className="rounded-lg border border-border overflow-hidden">
                  {!changeOilModal?.changeOilHistory?.length ? (
                    <div className="py-8 px-4 text-center text-sm text-muted-foreground">
                      No change oil history yet.
                    </div>
                  ) : (
                    <div className="max-h-[260px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold">
                              Date
                            </th>

                            <th className="px-3 py-2 text-right text-xs font-semibold">
                              Odometer
                            </th>

                            <th className="px-3 py-2 text-left text-xs font-semibold">
                              Notes
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-semibold">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {[...(changeOilModal.changeOilHistory || [])]
                            .sort(
                              (a, b) =>
                                new Date(b.date).getTime() -
                                new Date(a.date).getTime(),
                            )
                            .map((record, index) => (
                              <tr
                                key={record._id}
                                className="border-t border-border"
                              >
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {new Date(record.date).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    },
                                  )}
                                </td>

                                <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">
                                  {record.odometer != null
                                    ? `${Number(record.odometer).toLocaleString()} KM
                                    `
                                    : "—"}
                                </td>

                                <td className="px-3 py-2">
                                  {record.notes || "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleEditChangeOilRecord(record)
                                      }
                                      title="Edit record"
                                      className="w-8 h-8 rounded-md inline-flex items-center justify-center border border-border hover:bg-muted transition-colors"
                                    >
                                      <Pencil size={13} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteOilRecordId(record._id)
                                      }
                                      title="Delete record"
                                      className="w-8 h-8 rounded-md inline-flex items-center justify-center border border-border hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <button
                onClick={() => setChangeOilModal(null)}
                className="px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
              >
                Close
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DELETE CHANGE OIL RECORD */}
        <Dialog
          open={!!deleteOilRecordId}
          onOpenChange={(open) => {
            if (!open && !changeOilLoading) {
              setDeleteOilRecordId(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete change oil record?</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground">
              This record will be permanently deleted from the change oil
              history.
            </p>

            <DialogFooter className="mt-4">
              <button
                type="button"
                onClick={() => setDeleteOilRecordId(null)}
                disabled={changeOilLoading}
                className="px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteChangeOilRecord}
                disabled={changeOilLoading}
                className="px-5 py-2.5 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {changeOilLoading ? "Deleting..." : "Delete"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DELETE TRUCK */}
        <Dialog open={!!deleteModal} onOpenChange={() => setDeleteModal(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete truck?</DialogTitle>
            </DialogHeader>

            <p>
              Are you sure you want to delete this truck?
              <br />
              <strong>{deleteModal?.truckName}</strong>
            </p>

            <DialogFooter className="mt-4">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 border rounded-md text-sm"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  if (deleteModal) {
                    await deleteTruck(deleteModal._id);
                    setDeleteModal(null);
                  }
                }}
                className="px-6 py-2 bg-red-500 text-white rounded-md text-sm"
              >
                Delete
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </div>
  );
}
