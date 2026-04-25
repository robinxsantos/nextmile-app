import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { useAppStore } from "../store/useAppStore";
import { peso, toInputDate } from "../lib/utils";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  CreditCard,
  Eye,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getSelectStyles } from "../lib/selectStyles";
import Modal from "../components/shared/Modal";

type Option = {
  value: string;
  label: string;
};

interface PaymentRow {
  _id: string;
  truck: string | { _id: string; truckName: string };
  truckName: string;
  uploadedBy?: string;
  category: string;
  recipient?: string;
  amount?: number;
  method?: string;
  date: string;
  dateText: string;
  filename: string;
  originalFilename: string;
  note?: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

const CATEGORY_OPTIONS: Option[] = [
  { value: "Cash Advance", label: "Cash Advance" },
  { value: "Salary", label: "Salary" },
];

const METHOD_OPTIONS: Option[] = [
  { value: "GCash", label: "GCash" },
  { value: "Cash", label: "Cash" },
  { value: "Bank Transfer", label: "Bank Transfer" },
];

export default function PaymentsPage() {
  const { truckOptions, selectedTruck, initApp, theme } = useAppStore();

  const isDark = theme === "dark";
  const selectStyles = getSelectStyles(isDark);

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHOD_OPTIONS[0].value);
  const [date, setDate] = useState(toInputDate(new Date()));
  const [note, setNote] = useState("");
  const [previewPayment, setPreviewPayment] = useState<PaymentRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<PaymentRow | null>(null);
  const [showTruckWarning, setShowTruckWarning] = useState(false);

  const [editPayment, setEditPayment] = useState<PaymentRow | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editCategory, setEditCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [editRecipient, setEditRecipient] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState(METHOD_OPTIONS[0].value);
  const [editDate, setEditDate] = useState(toInputDate(new Date()));
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    initApp();
  }, [initApp]);

  const fetchPayments = useCallback(async () => {
    try {
      const params: { truck?: string } = {};
      if (selectedTruck) params.truck = selectedTruck;

      const { data } = await api.get("/payments", { params });
      setPayments(data.rows || []);
    } catch {
      setPayments([]);
    }
  }, [selectedTruck]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const selectedTruckName = truckOptions.find(
    (t) => t._id === selectedTruck,
  )?.truckName;

  const pageTitle = selectedTruckName
    ? `${selectedTruckName} Payments`
    : "Payments";

  const filePreviewLabel = useMemo(() => {
    if (!file) return "";
    const ext = file.name.split(".").pop() || "png";
    return `${category} - ${date}.${ext}`;
  }, [file, category, date]);

  const editFilePreviewLabel = useMemo(() => {
    if (!editFile) return "";
    const ext = editFile.name.split(".").pop() || "png";
    return `${editCategory} - ${editDate}.${ext}`;
  }, [editFile, editCategory, editDate]);

  const paymentStats = useMemo(() => {
    const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return {
      count: payments.length,
      total,
    };
  }, [payments]);

  const resetCreateForm = () => {
    setFile(null);
    setCategory(CATEGORY_OPTIONS[0].value);
    setRecipient("");
    setAmount("");
    setMethod(METHOD_OPTIONS[0].value);
    setDate(toInputDate(new Date()));
    setNote("");
  };

  const openEdit = (p: PaymentRow) => {
    setEditPayment(p);
    setEditCategory(p.category || CATEGORY_OPTIONS[0].value);
    setEditRecipient(p.recipient || "");
    setEditAmount(String(p.amount ?? ""));
    setEditMethod(p.method || METHOD_OPTIONS[0].value);
    setEditDate(toInputDate(new Date(p.date)));
    setEditNote(p.note || "");
    setEditFile(null);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    if (!selectedTruck) {
      setShowTruckWarning(true);
      return;
    }
    if (!recipient.trim()) {
      toast.error("Recipient is required");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Amount is required");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("truckId", selectedTruck);
      formData.append("category", category);
      formData.append("recipient", recipient.trim());
      formData.append("amount", amount);
      formData.append("method", method);
      formData.append("date", date);
      formData.append("note", note.trim());

      await api.post("/payments/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Payment proof uploaded!");
      resetCreateForm();
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

  const handleUpdate = async () => {
    if (!editPayment) return;
    if (!selectedTruck) {
      setShowTruckWarning(true);
      return;
    }
    if (!editRecipient.trim()) {
      toast.error("Recipient is required");
      return;
    }
    if (!editAmount || Number(editAmount) <= 0) {
      toast.error("Amount is required");
      return;
    }

    setSavingEdit(true);
    try {
      const formData = new FormData();
      formData.append("truckId", selectedTruck);
      formData.append("category", editCategory);
      formData.append("recipient", editRecipient.trim());
      formData.append("amount", editAmount);
      formData.append("method", editMethod);
      formData.append("date", editDate);
      formData.append("note", editNote.trim());
      if (editFile) formData.append("file", editFile);

      await api.put(`/payments/${editPayment._id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Payment updated!");
      setEditPayment(null);
      setEditFile(null);
      fetchPayments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Update failed";
      toast.error(msg);
    } finally {
      setSavingEdit(false);
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

  const inputClass =
    "w-full min-h-[44px] rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors";

  return (
    <div className="space-y-3.5">
      <div className="mb-4">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-[1.45rem] font-bold tracking-tight">
              {pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload screenshots sent via GCash, Cash, or Bank Transfer.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[0.72rem] font-bold tracking-wider uppercase text-muted-foreground">
              Records
            </div>
            <div className="font-bold text-sm">
              {paymentStats.count} item{paymentStats.count === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-3.5 items-start">
        <div className="border rounded-lg bg-background p-4">
          <div className="mb-4">
            <h2 className="text-base font-bold tracking-tight">
              Upload Payment Proof
            </h2>
            <p className="text-sm text-muted-foreground">
              Save screenshots sent via GCash, Cash, or Bank Transfer.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Date
              </label>
              <DatePicker
                selected={date ? new Date(`${date}T00:00:00`) : new Date()}
                onChange={(d: Date | null) => {
                  if (d) setDate(toInputDate(d));
                }}
                dateFormat="MMM d, yyyy"
                className={inputClass + " cursor-pointer"}
                wrapperClassName="w-full"
                showPopperArrow={false}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Category
              </label>
              <Select
                options={CATEGORY_OPTIONS}
                value={
                  CATEGORY_OPTIONS.find((o) => o.value === category) || null
                }
                onChange={(opt) =>
                  setCategory(opt?.value || CATEGORY_OPTIONS[0].value)
                }
                styles={{
                  ...selectStyles,
                  menuPortal: (base: Record<string, unknown>) => ({
                    ...base,
                    zIndex: 9999,
                  }),
                }}
                menuPortalTarget={document.body}
                isSearchable={false}
                classNamePrefix="nm-select"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Payment Method
              </label>
              <Select
                options={METHOD_OPTIONS}
                value={METHOD_OPTIONS.find((o) => o.value === method) || null}
                onChange={(opt) =>
                  setMethod(opt?.value || METHOD_OPTIONS[0].value)
                }
                styles={{
                  ...selectStyles,
                  menuPortal: (base: Record<string, unknown>) => ({
                    ...base,
                    zIndex: 9999,
                  }),
                }}
                menuPortalTarget={document.body}
                isSearchable={false}
                classNamePrefix="nm-select"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Recipient
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Driver / Crew.."
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Amount
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Note
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
                className={inputClass}
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Upload Image
              </label>
              <label className="group flex cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-slate-800/50">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <Upload
                  size={24}
                  className="mb-2 text-slate-400 group-hover:text-blue-500"
                />
                {file ? (
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {file.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-200">
                      Click to upload screenshot
                    </div>
                    <div className="text-xs text-slate-500">
                      PNG, JPG, WEBP, GIF
                    </div>
                  </div>
                )}
              </label>

              {file && (
                <div className="mt-3 rounded-[14px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  Filename preview:{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {filePreviewLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 mt-5">
            <button
              onClick={resetCreateForm}
              className="px-4 py-2.5 rounded-[14px] border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Reset
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
            >
              <Upload size={16} />
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>

        <div className="border rounded-lg bg-background overflow-hidden min-w-0">
          <div className="p-3.5 pb-2 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Uploaded Payment Proofs
              </h2>
              <p className="text-sm text-muted-foreground">
                Click View to open the image in a preview window.
              </p>
            </div>
          </div>

          <div className="overflow-auto border-t border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-900 hidden md:block">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-3 whitespace-nowrap">
                    Date
                  </th>
                  <th className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-3 whitespace-nowrap">
                    Category
                  </th>
                  <th className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-3 whitespace-nowrap">
                    Recipient
                  </th>
                  <th className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-3 whitespace-nowrap">
                    Amount
                  </th>
                  <th className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-3 whitespace-nowrap">
                    Payment Method
                  </th>
                  <th className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-3 whitespace-nowrap">
                    Proof
                  </th>
                  <th className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-3 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="py-14 text-center">
                        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-400">
                          <ImageIcon size={24} />
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          No payment proofs yet
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Upload your first screenshot to start tracking
                          payments.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr
                      key={p._id}
                      className="hover:bg-muted dark:hover:bg-slate-800/50"
                    >
                      <td className="text-center text-xs px-3 py-3 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        {p.dateText}
                      </td>
                      <td className="text-center text-xs px-3 py-3 border-b border-slate-100 dark:border-slate-800">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[0.72rem] font-bold bg-muted text-foreground">
                          {p.category}
                        </span>
                      </td>
                      <td className="text-center text-xs px-3 py-3 border-b border-slate-100 dark:border-slate-800">
                        {p.recipient || "—"}
                      </td>
                      <td className="text-center text-xs px-3 py-3 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-900 dark:text-slate-100">
                        {peso(Number(p.amount || 0))}
                      </td>
                      <td className="text-center text-xs px-3 py-3 border-b border-slate-100 dark:border-slate-800">
                        {p.method || "—"}
                      </td>
                      <td className="text-center text-xs px-3 py-3 border-b border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => setPreviewPayment(p)}
                          className="h-8 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-muted hover:border-blue-500/20 hover:text-blue-600 transition-all text-xs font-semibold"
                        >
                          <Eye size={14} /> View
                        </button>
                      </td>
                      <td className="text-center text-xs px-3 py-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEdit(p)}
                            className="w-8 h-8 rounded-xl inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-muted hover:border-blue-500/20 hover:text-blue-600 transition-all"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteModal(p)}
                            className="w-8 h-8 rounded-xl inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden p-3 border-t border-slate-200/60 dark:border-slate-700/60">
            {payments.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-400">
                  <ImageIcon size={24} />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No payment proofs yet
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Upload your first screenshot to start tracking payments.
                </p>
              </div>
            ) : (
              payments.map((p) => (
                <div
                  key={p._id}
                  className="border rounded-md bg-background p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-sm">{p.dateText}</div>
                      <div className="mt-1">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[0.72rem] font-bold bg-muted text-foreground">
                          {p.category}
                        </span>
                      </div>
                    </div>
                    <div className="font-bold text-lg text-slate-900 dark:text-slate-100">
                      {peso(Number(p.amount || 0))}
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1.5">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Recipient:
                      </span>{" "}
                      {p.recipient || "—"}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Method:
                      </span>{" "}
                      {p.method || "—"}
                    </div>
                    {p.note && (
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          Note:
                        </span>{" "}
                        {p.note}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setPreviewPayment(p)}
                      className="flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-muted hover:text-blue-600 transition-all text-xs font-semibold"
                    >
                      <Eye size={14} /> View
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="h-9 w-9 rounded-xl inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-muted hover:text-blue-600 transition-all"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteModal(p)}
                      className="h-9 w-9 rounded-xl inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-red-500/10 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal
        open={!!editPayment}
        onClose={() => {
          setEditPayment(null);
          setEditFile(null);
        }}
        title={
          editPayment
            ? `Edit Payment - ${editPayment.dateText}`
            : "Edit Payment"
        }
        wide
        footer={
          <>
            <button
              onClick={() => {
                setEditPayment(null);
                setEditFile(null);
              }}
              className="px-4 py-2.5 rounded-[14px] border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={savingEdit}
              className="px-6 py-2.5 rounded-[14px] bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-[0_10px_20px_rgba(37,99,235,0.18)] disabled:opacity-50"
            >
              {savingEdit ? "Saving..." : "Update"}
            </button>
          </>
        }
      >
        {editPayment && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Date
              </label>
              <DatePicker
                selected={
                  editDate ? new Date(`${editDate}T00:00:00`) : new Date()
                }
                onChange={(d: Date | null) => {
                  if (d) setEditDate(toInputDate(d));
                }}
                dateFormat="MMM d, yyyy"
                className={inputClass + " cursor-pointer"}
                wrapperClassName="w-full"
                showPopperArrow={false}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Category
              </label>
              <Select
                options={CATEGORY_OPTIONS}
                value={
                  CATEGORY_OPTIONS.find((o) => o.value === editCategory) || null
                }
                onChange={(opt) =>
                  setEditCategory(opt?.value || CATEGORY_OPTIONS[0].value)
                }
                styles={{
                  ...selectStyles,
                  menuPortal: (base: Record<string, unknown>) => ({
                    ...base,
                    zIndex: 9999,
                  }),
                }}
                menuPortalTarget={document.body}
                isSearchable={false}
                classNamePrefix="nm-select"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Method
              </label>
              <Select
                options={METHOD_OPTIONS}
                value={
                  METHOD_OPTIONS.find((o) => o.value === editMethod) || null
                }
                onChange={(opt) =>
                  setEditMethod(opt?.value || METHOD_OPTIONS[0].value)
                }
                styles={{
                  ...selectStyles,
                  menuPortal: (base: Record<string, unknown>) => ({
                    ...base,
                    zIndex: 9999,
                  }),
                }}
                menuPortalTarget={document.body}
                isSearchable={false}
                classNamePrefix="nm-select"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Recipient
              </label>
              <input
                type="text"
                value={editRecipient}
                onChange={(e) => setEditRecipient(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Amount
              </label>
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Note
              </label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                Replace Proof Image (optional)
              </label>
              <label className="group flex cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-slate-800/50">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                />
                <Upload
                  size={22}
                  className="mb-2 text-slate-400 group-hover:text-blue-500"
                />
                {editFile ? (
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {editFile.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {(editFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-200">
                      Keep current proof if blank
                    </div>
                    <div className="text-xs text-slate-500">
                      PNG, JPG, WEBP, GIF
                    </div>
                  </div>
                )}
              </label>

              {editFile && (
                <div className="mt-3 rounded-[14px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  Filename preview:{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {editFilePreviewLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!previewPayment}
        onClose={() => setPreviewPayment(null)}
        title={previewPayment ? `${previewPayment.category} Proof` : "Preview"}
        wide
        footer={
          <>
            <button
              onClick={() => setPreviewPayment(null)}
              className="px-4 py-2.5 rounded-[14px] border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Close
            </button>
            {previewPayment && (
              <button
                onClick={() =>
                  window.open(
                    `/api/payments/${previewPayment._id}/file`,
                    "_blank",
                  )
                }
                className="px-4 py-2.5 rounded-[14px] bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Open in New Tab
              </button>
            )}
          </>
        }
      >
        {previewPayment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Date
                </div>
                <div className="font-semibold">{previewPayment.dateText}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Category
                </div>
                <div className="font-semibold">{previewPayment.category}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Recipient
                </div>
                <div className="font-semibold">
                  {previewPayment.recipient || "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Amount
                </div>
                <div className="font-semibold">
                  {peso(Number(previewPayment.amount || 0))}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Method
                </div>
                <div className="font-semibold">
                  {previewPayment.method || "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  Filename
                </div>
                <div className="font-semibold break-words">
                  {previewPayment.filename}
                </div>
              </div>
            </div>

            {previewPayment.note && (
              <div className="rounded-[14px] border border-slate-200 dark:border-slate-700 p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Note
                </div>
                <div>{previewPayment.note}</div>
              </div>
            )}

            <div className="rounded-[18px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
              <img
                src={`/api/payments/${previewPayment._id}/file`}
                alt={previewPayment.filename}
                className="w-full max-h-[68vh] object-contain rounded-[14px] bg-white"
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete payment?"
        footer={
          <>
            <button
              onClick={() => setDeleteModal(null)}
              className="px-4 py-2.5 rounded-[14px] border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-6 py-2.5 rounded-[14px] bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to delete this payment proof?
          <br />
          <strong>
            {deleteModal?.dateText} / {deleteModal?.category}
          </strong>
        </p>
      </Modal>

      <Modal
        open={showTruckWarning}
        onClose={() => setShowTruckWarning(false)}
        title=""
      >
        <div className="text-center py-4">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-500/10 grid place-items-center text-amber-500">
            <AlertTriangle size={28} />
          </div>
          <div className="font-bold text-lg mb-1">
            Please select a truck first!
          </div>
          <p className="text-sm text-slate-500">
            Choose a truck from the Dashboard filter bar before uploading a
            payment proof.
          </p>
        </div>
      </Modal>
    </div>
  );
}
