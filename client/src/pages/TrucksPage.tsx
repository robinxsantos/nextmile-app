import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppStore, type TruckRow } from "../store/useAppStore";
import KpiCard from "../components/shared/KpiCard";
import Modal from "../components/shared/Modal";
import {
  Truck,
  CheckCircle2,
  ArrowUpDown,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "../lib/utils";
import Select from "react-select";

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

const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const formSelectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    minHeight: "44px",
    borderRadius: "14px",
    borderColor: state.isFocused ? "#60a5fa" : "#e2e8f0",
    backgroundColor: "white",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(37,99,235,0.1)" : "none",
    fontSize: "0.875rem",
    fontWeight: 500,
    "&:hover": { borderColor: "#93c5fd" },
    cursor: "pointer",
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    borderRadius: "14px",
    overflow: "hidden",
    boxShadow: "0 12px 40px rgba(15,23,42,0.12)",
    border: "1px solid #e2e8f0",
    zIndex: 100,
  }),
  menuList: (base: Record<string, unknown>) => ({ ...base, padding: "4px" }),
  option: (
    base: Record<string, unknown>,
    state: { isSelected: boolean; isFocused: boolean },
  ) => ({
    ...base,
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "0.875rem",
    fontWeight: state.isSelected ? 600 : 400,
    backgroundColor: state.isSelected
      ? "#2563eb"
      : state.isFocused
        ? "#eff6ff"
        : "transparent",
    color: state.isSelected ? "white" : "#334155",
    cursor: "pointer",
  }),
  singleValue: (base: Record<string, unknown>) => ({
    ...base,
    color: "#0f172a",
    fontWeight: 500,
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base: Record<string, unknown>) => ({
    ...base,
    color: "#94a3b8",
  }),
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 99999 }),
};

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
  } = useAppStore();
  const [truckModal, setTruckModal] = useState(false);
  const [editRow, setEditRow] = useState<TruckRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<TruckRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    truckName: "",
    status: "Active",
    cutoffType: "weekly",
    client: "",
    lastChangeOil: "",
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
      client: "",
      lastChangeOil: "",
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
      client: row.client ?? row.notes ?? "",
      lastChangeOil:
        row.lastChangeOil !== undefined && row.lastChangeOil !== null
          ? String(row.lastChangeOil)
          : "",
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

    if (!form.client.trim()) {
      toast.error("Client is required.", { duration: 6000 });
      return;
    }

    const lastChangeOilNum = Number(form.lastChangeOil);
    if (!Number.isFinite(lastChangeOilNum) || lastChangeOilNum < 0) {
      toast.error("Last Change Oil must be a valid number.", {
        duration: 6000,
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        truckName: form.truckName.trim(),
        status: form.status,
        cutoffType: form.cutoffType,
        client: form.client.trim(),
        notes: form.client.trim(),
        lastChangeOil: lastChangeOilNum,
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

  const inputClass =
    "w-full min-h-[44px] rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 px-3.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors";

  return (
    <div>
      <div className="glass-card rounded-[28px] border border-white/50 dark:border-slate-700/90 shadow-lg p-5 mb-3.5">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-[1.45rem] font-bold tracking-tight">Trucks</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage fleet records and dedicated data sheets per truck.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[0.72rem] font-bold tracking-wider uppercase text-slate-500">
              Fleet module
            </div>
            <div className="font-bold text-sm">Connected to TRUCKS</div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[22px] border border-slate-200/90 dark:border-slate-700/90 shadow-sm p-3.5 mb-3.5">
        <div className="flex justify-end">
          <button
            onClick={openAdd}
            className="min-h-[44px] px-4 rounded-[14px] bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-[0_10px_20px_rgba(37,99,235,0.18)] hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-1.5"
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
          colorClass="bg-amber-500/10 text-amber-500"
        />
        <KpiCard
          label="Active"
          value={truckStats.active.toLocaleString()}
          subtitle="Available and active"
          icon={<CheckCircle2 size={22} />}
          colorClass="bg-blue-600/10 text-blue-600"
        />
        <KpiCard
          label="Inactive"
          value={truckStats.inactive.toLocaleString()}
          subtitle="Paused or archived"
          icon={<ArrowUpDown size={22} />}
          colorClass="bg-pink-500/10 text-pink-500"
        />
        <KpiCard
          label="Data Sheets"
          value={truckStats.sheets.toLocaleString()}
          subtitle="Auto-created truck sheets"
          icon={<BarChart3 size={22} />}
          colorClass="bg-cyan-500/10 text-cyan-500"
        />
      </div>

      <div className="glass-card rounded-[22px] border border-slate-200/90 dark:border-slate-700/90 shadow-sm p-3.5 overflow-hidden">
        <div className="mb-3">
          <h2 className="text-base font-bold tracking-tight">Fleet Records</h2>
          <p className="text-sm text-slate-500">
            Truck registry and linked data.
          </p>
        </div>

        {/* Desktop Table */}
        <div className="rounded-[18px] overflow-auto border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900/95 hidden md:block">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-3 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Truck Name
                </th>
                {[
                  "Status",
                  "Date Added",
                  "Client",
                  "Last Change Oil",
                  "Cutoff Start",
                  "Cutoff End",
                  "Payday",
                  "Day Off",
                ].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
                <th className="sticky top-0 right-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-3 whitespace-nowrap shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {truckRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    No trucks found
                  </td>
                </tr>
              ) : (
                truckRows.map((r) => {
                  const client = r.client ?? r.notes ?? "";
                  return (
                    <tr
                      key={r._id}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50"
                    >
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
                            onClick={() => openEdit(r)}
                            className="w-[34px] h-[34px] rounded-xl inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-600 transition-all"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteModal(r)}
                            className="w-[34px] h-[34px] rounded-xl inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transition-all"
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
                  className="glass-card rounded-xl border border-slate-200 dark:border-slate-700 p-4"
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

      {/* Truck Modal */}
      <Modal
        open={truckModal}
        onClose={() => setTruckModal(false)}
        title={editRow ? "Edit Truck" : "Add Truck"}
        wide
        footer={
          <>
            <button
              onClick={() => setTruckModal(false)}
              className="px-4 py-2.5 rounded-[14px] border border-slate-200 dark:border-slate-700 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2.5 rounded-[14px] bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-[0_10px_20px_rgba(37,99,235,0.18)] disabled:opacity-50"
            >
              {loading ? "Saving..." : editRow ? "Update" : "Save"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
              Truck Name
            </label>
            <input
              type="text"
              value={form.truckName}
              onChange={(e) => setForm({ ...form, truckName: e.target.value })}
              placeholder="e.g. AAA_1234"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
              Status
            </label>
            <Select
              options={STATUS_OPTIONS}
              value={STATUS_OPTIONS.find((o) => o.value === form.status)}
              onChange={(opt) => {
                if (opt) setForm({ ...form, status: opt.value });
              }}
              styles={formSelectStyles}
              isSearchable={false}
              menuPortalTarget={document.body}
              classNamePrefix="nm-select"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
              Cutoff Type
            </label>
            <Select
              options={CUTOFF_TYPE_OPTIONS}
              value={CUTOFF_TYPE_OPTIONS.find(
                (o) => o.value === form.cutoffType,
              )}
              onChange={(opt) => {
                if (!opt) return;
                setForm((prev) =>
                  opt.value === "monthly"
                    ? {
                        ...prev,
                        cutoffType: opt.value,
                        cutoffStart: "26",
                        cutoffEnd: "25",
                        payday: "26",
                        dayOff: "0",
                      }
                    : {
                        ...prev,
                        cutoffType: opt.value,
                        cutoffStart: "1",
                        cutoffEnd: "6",
                        payday: "6",
                        dayOff: "0",
                      },
                );
              }}
              styles={formSelectStyles}
              isSearchable={false}
              menuPortalTarget={document.body}
              classNamePrefix="nm-select"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
              Client
            </label>
            <input
              type="text"
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
              placeholder="Client name"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
              Last Change Oil
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatNumberWithComma(form.lastChangeOil)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "");

                  // allow only numbers
                  if (!/^\d*$/.test(raw)) return;

                  setForm({ ...form, lastChangeOil: raw });
                }}
                placeholder="e.g. 100,000"
                className={`${inputClass} pr-12`}
              />

              {/* KM sa right side */}
              <div className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-500">
                KM
              </div>
            </div>
          </div>

          {form.cutoffType === "weekly" ? (
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">
                Cutoff Settings
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Cutoff Start
                  </label>
                  <Select
                    options={DAY_OPTIONS}
                    value={DAY_OPTIONS.find(
                      (o) => o.value === form.cutoffStart,
                    )}
                    onChange={(opt) => {
                      if (opt) setForm({ ...form, cutoffStart: opt.value });
                    }}
                    styles={formSelectStyles}
                    isSearchable={false}
                    menuPortalTarget={document.body}
                    classNamePrefix="nm-select"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Cutoff End
                  </label>
                  <Select
                    options={DAY_OPTIONS}
                    value={DAY_OPTIONS.find((o) => o.value === form.cutoffEnd)}
                    onChange={(opt) => {
                      if (opt) setForm({ ...form, cutoffEnd: opt.value });
                    }}
                    styles={formSelectStyles}
                    isSearchable={false}
                    menuPortalTarget={document.body}
                    classNamePrefix="nm-select"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Payday
                  </label>
                  <Select
                    options={DAY_OPTIONS}
                    value={DAY_OPTIONS.find((o) => o.value === form.payday)}
                    onChange={(opt) => {
                      if (opt) setForm({ ...form, payday: opt.value });
                    }}
                    styles={formSelectStyles}
                    isSearchable={false}
                    menuPortalTarget={document.body}
                    classNamePrefix="nm-select"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Day Off
                  </label>
                  <Select
                    options={DAY_OPTIONS}
                    value={DAY_OPTIONS.find((o) => o.value === form.dayOff)}
                    onChange={(opt) => {
                      if (opt) setForm({ ...form, dayOff: opt.value });
                    }}
                    styles={formSelectStyles}
                    isSearchable={false}
                    menuPortalTarget={document.body}
                    classNamePrefix="nm-select"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">
                Monthly Cutoff Settings
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Cutoff Start Day
                  </label>
                  <Select
                    options={MONTH_DAY_OPTIONS}
                    value={MONTH_DAY_OPTIONS.find(
                      (o) => o.value === form.cutoffStart,
                    )}
                    onChange={(opt) => {
                      if (opt) setForm({ ...form, cutoffStart: opt.value });
                    }}
                    styles={formSelectStyles}
                    isSearchable={false}
                    menuPortalTarget={document.body}
                    classNamePrefix="nm-select"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Cutoff End Day
                  </label>
                  <Select
                    options={MONTH_DAY_OPTIONS}
                    value={MONTH_DAY_OPTIONS.find(
                      (o) => o.value === form.cutoffEnd,
                    )}
                    onChange={(opt) => {
                      if (opt) setForm({ ...form, cutoffEnd: opt.value });
                    }}
                    styles={formSelectStyles}
                    isSearchable={false}
                    menuPortalTarget={document.body}
                    classNamePrefix="nm-select"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Salary Day
                  </label>
                  <Select
                    options={MONTH_DAY_OPTIONS}
                    value={MONTH_DAY_OPTIONS.find(
                      (o) => o.value === form.payday,
                    )}
                    onChange={(opt) => {
                      if (opt) setForm({ ...form, payday: opt.value });
                    }}
                    styles={formSelectStyles}
                    isSearchable={false}
                    menuPortalTarget={document.body}
                    classNamePrefix="nm-select"
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                <strong>Monthly Cutoff</strong>
                <br />
                When the cutoff start date is set to the 1st day of the month
                and the cutoff end date is set to the 31st, the cutoff period
                covers the entire calendar month.
                <br />
                <strong>Cross-Month Cutoff</strong>
                <br />
                When the cutoff start date is set to the 26th and the cutoff end
                date is set to the 25th, the cutoff period begins on the 26th of
                the current month and ends on the 25th of the following month.
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete truck?"
        footer={
          <>
            <button
              onClick={() => setDeleteModal(null)}
              className="px-4 py-2.5 rounded-[14px] border border-slate-200 dark:border-slate-700 text-sm font-semibold"
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
              className="px-6 py-2.5 rounded-[14px] bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
            >
              Delete
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to delete this truck?
          <br />
          <strong>{deleteModal?.truckName}</strong>
        </p>
      </Modal>
    </div>
  );
}
