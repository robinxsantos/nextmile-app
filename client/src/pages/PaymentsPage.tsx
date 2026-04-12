import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { useAppStore } from "../store/useAppStore";
import { Upload, Image, Trash2, CreditCard } from "lucide-react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getSelectStyles } from "../lib/selectStyles";
import Modal from "../components/shared/Modal";

interface PaymentRow {
  _id: string;
  truck: string | { _id: string; truckName: string };
  truckName: string;
  category: string;
  date: string;
  dateText: string;
  filename: string;
  originalFilename: string;
  note: string;
  fileSize: number;
  createdAt: string;
}

const CATEGORY_OPTIONS = [
  { value: "Cash Advance", label: "Cash Advance" },
  { value: "Salary", label: "Salary" },
];

export default function PaymentsPage() {
  const { truckOptions, selectedTruck, initApp, theme } = useAppStore();
  const isDark = theme === "dark";
  const selectStyles = getSelectStyles(isDark);
  const [deleteModal, setDeleteModal] = useState<PaymentRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Cash Advance");
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState("");

  useEffect(() => {
    initApp();
  }, [initApp]);

  const fetchPayments = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedTruck) params.truck = selectedTruck;
      const { data } = await api.get("/payments", { params });
      setPayments(data.rows || []);
    } catch {
      // Endpoint may not exist yet
    }
  }, [selectedTruck]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    if (!selectedTruck) {
      toast.error("Please select a truck");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("truckId", selectedTruck);
      formData.append("category", category);
      formData.append(
        "date",
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      );
      formData.append("note", note);

      await api.post("/payments/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Screenshot uploaded!");
      setFile(null);
      setNote("");
      fetchPayments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;

    try {
      await api.delete(`/payments/${deleteModal._id}`);
      toast.success("Payment deleted");
      setDeleteModal(null);
      fetchPayments();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const filenamePreview = useMemo(() => {
    const ext = file ? file.name.split(".").pop() : "png";
    const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return `${category} - ${d}.${ext}`;
  }, [file, category, date]);

  const selectedTruckName = truckOptions.find(
    (t) => t._id === selectedTruck,
  )?.truckName;

  return (
    <div>
      <div className="glass-card rounded-[28px] border border-slate-200/80 dark:border-slate-700/90 shadow-lg p-5 mb-3.5">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-[1.45rem] font-bold tracking-tight">
              Payments
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Upload GCash screenshots for Cash Advance and Salary payments.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3">
        {/* Upload Form */}
        <div className="glass-card rounded-[22px] border border-slate-200/90 dark:border-slate-700/90 shadow-sm p-5">
          <h2 className="text-base font-bold tracking-tight mb-4">
            Upload Screenshot
          </h2>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Category
              </label>
              <Select
                options={CATEGORY_OPTIONS}
                value={CATEGORY_OPTIONS.find((o) => o.value === category)}
                onChange={(opt) => {
                  if (opt) setCategory(opt.value);
                }}
                styles={{
                  ...selectStyles,
                  menuPortal: (base: Record<string, unknown>) => ({
                    ...base,
                    zIndex: 9999,
                  }),
                }}
                isSearchable={false}
                menuPortalTarget={document.body}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Date
              </label>
              <DatePicker
                selected={date}
                onChange={(d: Date | null) => setDate(d || new Date())}
                dateFormat="MMM d, yyyy"
                className="w-full min-h-[44px] rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors cursor-pointer"
                wrapperClassName="w-full"
                showPopperArrow={false}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Note (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
                className="w-full min-h-[44px] rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Screenshot
              </label>
              <label className="flex flex-col items-center justify-center w-full min-h-[120px] rounded-[14px] border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <div className="text-center p-4">
                    <Image size={24} className="mx-auto mb-2 text-blue-500" />
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                      {file.name}
                    </div>
                    <div className="text-[0.65rem] text-slate-400 mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <Upload size={24} className="mx-auto mb-2 text-slate-400" />
                    <div className="text-xs text-slate-500">
                      Click to upload screenshot
                    </div>
                  </div>
                )}
              </label>
            </div>

            {file && (
              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <span className="font-semibold">Filename: </span>
                {filenamePreview}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={uploading || !file || !selectedTruck}
              className="w-full min-h-[44px] rounded-[14px] bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-[0_10px_20px_rgba(37,99,235,0.18)] hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {uploading ? (
                "Uploading..."
              ) : (
                <>
                  <Upload size={16} /> Upload
                </>
              )}
            </button>
          </div>
        </div>

        {/* Gallery */}
        <div className="glass-card rounded-[22px] border border-slate-200/90 dark:border-slate-700/90 shadow-sm p-5">
          <h2 className="text-base font-bold tracking-tight mb-1">
            Uploaded Screenshots
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            {selectedTruckName || "All trucks"}
          </p>

          {payments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
              <div className="font-semibold">No payment screenshots yet</div>
              <div className="text-sm">Upload your first GCash screenshot</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {payments.map((p) => (
                <div
                  key={p._id}
                  className="glass-card rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  <div
                    className="h-40 bg-slate-100 dark:bg-slate-800 cursor-pointer flex items-center justify-center"
                    onClick={() =>
                      window.open(`/api/payments/${p._id}/file`, "_blank")
                    }
                  >
                    <img
                      src={`/api/payments/${p._id}/file`}
                      alt={p.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-xs truncate">
                      {p.filename}
                    </div>
                    <div className="text-[0.65rem] text-slate-500 mt-0.5">
                      {p.dateText}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {p.category}
                      </span>
                      <button
                        onClick={() => setDeleteModal(p)}
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {p.note && (
                      <div className="text-[0.65rem] text-slate-400 mt-1 truncate">
                        {p.note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Modal
          open={!!deleteModal}
          onClose={() => setDeleteModal(null)}
          title="Delete payment?"
          footer={
            <>
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2.5 rounded-[14px] border border-slate-200 dark:border-slate-700 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-6 py-2.5 rounded-[14px] bg-red-500 text-white text-sm font-semibold"
              >
                Delete
              </button>
            </>
          }
        >
          <p>Are you sure you want to delete this payment screenshot?</p>
          <p className="font-bold mt-1">
            {deleteModal?.dateText} / {deleteModal?.category}
          </p>
        </Modal>
      </div>
    </div>
  );
}
