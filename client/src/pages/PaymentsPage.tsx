import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import api from "../api/client";
import heic2any from "heic2any";
import { useAppStore } from "../store/useAppStore";
import { peso, toInputDate } from "../lib/utils";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import Modal from "../components/shared/Modal";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import {
  Select as UiSelect,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

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
  { value: "Receipt", label: "Receipt" },
];

const METHOD_OPTIONS: Option[] = [
  { value: "GCash", label: "GCash" },
  { value: "Cash", label: "Cash" },
  { value: "Bank Transfer", label: "Bank Transfer" },
];

export default function PaymentsPage() {
  const { truckOptions, selectedTruck, initApp } = useAppStore();

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [convertingFile, setConvertingFile] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHOD_OPTIONS[0].value);
  const [date, setDate] = useState(toInputDate(new Date()));
  const [note, setNote] = useState("");
  const [previewPayment, setPreviewPayment] = useState<PaymentRow | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<PaymentRow | null>(null);
  const [showTruckWarning, setShowTruckWarning] = useState(false);
  const [openDate, setOpenDate] = useState(false);

  const [editPayment, setEditPayment] = useState<PaymentRow | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isDraggingEditFile, setIsDraggingEditFile] = useState(false);
  const [convertingEditFile, setConvertingEditFile] = useState(false);
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
    return () => {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
    };
  }, [previewImageUrl]);

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

  const prepareImageFile = async (selectedFile: File): Promise<File> => {
    const lowerName = selectedFile.name.toLowerCase();

    const isHeic =
      selectedFile.type === "image/heic" ||
      selectedFile.type === "image/heif" ||
      lowerName.endsWith(".heic") ||
      lowerName.endsWith(".heif");

    if (!isHeic) {
      return selectedFile;
    }

    const converted = await heic2any({
      blob: selectedFile,
      toType: "image/jpeg",
      quality: 0.85,
    });

    const jpegBlob = Array.isArray(converted) ? converted[0] : converted;

    const jpegName = selectedFile.name.replace(/\.(heic|heif)$/i, ".jpg");

    return new File([jpegBlob], jpegName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  };

  const processCreateFile = async (selectedFile: File) => {
    setConvertingFile(true);

    try {
      const preparedFile = await prepareImageFile(selectedFile);
      setFile(preparedFile);

      const lowerName = selectedFile.name.toLowerCase();

      if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif")) {
        toast.success("HEIC converted to JPEG");
      }
    } catch (error) {
      console.error("Image processing failed:", error);
      setFile(null);
      toast.error("Failed to process image");
    } finally {
      setConvertingFile(false);
    }
  };

  const handleCreateFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    await processCreateFile(selectedFile);

    e.target.value = "";
  };

  const handleCreateFileDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDraggingFile(false);

    const droppedFile = e.dataTransfer.files?.[0];

    if (!droppedFile) return;

    const lowerName = droppedFile.name.toLowerCase();

    const isSupported =
      droppedFile.type.startsWith("image/") ||
      lowerName.endsWith(".heic") ||
      lowerName.endsWith(".heif");

    if (!isSupported) {
      toast.error("Please drop an image file");
      return;
    }

    await processCreateFile(droppedFile);
  };

  const processEditFile = async (selectedFile: File) => {
    setConvertingEditFile(true);

    try {
      const preparedFile = await prepareImageFile(selectedFile);
      setEditFile(preparedFile);

      const lowerName = selectedFile.name.toLowerCase();

      if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif")) {
        toast.success("HEIC converted to JPEG");
      }
    } catch (error) {
      console.error("Image processing failed:", error);
      setEditFile(null);
      toast.error("Failed to process image");
    } finally {
      setConvertingEditFile(false);
    }
  };

  const handleEditFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    await processEditFile(selectedFile);

    e.target.value = "";
  };

  const handleEditFileDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDraggingEditFile(false);

    const droppedFile = e.dataTransfer.files?.[0];

    if (!droppedFile) return;

    const lowerName = droppedFile.name.toLowerCase();

    const isSupported =
      droppedFile.type.startsWith("image/") ||
      lowerName.endsWith(".heic") ||
      lowerName.endsWith(".heif");

    if (!isSupported) {
      toast.error("Please drop an image file");
      return;
    }

    await processEditFile(droppedFile);
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

  const openPreview = async (payment: PaymentRow) => {
    setPreviewPayment(payment);
    setPreviewLoading(true);
    setPreviewImageUrl(null);

    try {
      const response = await api.get(`/payments/${payment._id}/file`, {
        responseType: "blob",
      });

      const objectUrl = URL.createObjectURL(response.data);
      setPreviewImageUrl(objectUrl);
    } catch {
      toast.error("Failed to load payment proof");
      setPreviewPayment(null);
    } finally {
      setPreviewLoading(false);
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
    "w-full h-11 rounded-md border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:border-ring outline-none transition-colors";

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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Date
              </label>
              <Popover open={openDate} onOpenChange={setOpenDate}>
                <PopoverTrigger asChild>
                  <button className="w-full h-11 px-3 flex items-center justify-between rounded-md border border-border bg-background text-sm">
                    {date
                      ? format(new Date(`${date}T00:00:00`), "MMM d, yyyy")
                      : "Select date"}
                    <CalendarDays className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date ? new Date(`${date}T00:00:00`) : undefined}
                    onSelect={(d) => {
                      if (!d) return;

                      setDate(toInputDate(d));
                      setOpenDate(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Category
              </label>
              <UiSelect
                value={category}
                onValueChange={(val) => setCategory(val)}
              >
                <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </UiSelect>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Payment Method
              </label>
              <UiSelect value={method} onValueChange={(val) => setMethod(val)}>
                <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {METHOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </UiSelect>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
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
              <label className="text-xs font-medium text-foreground mb-1.5 block">
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
              <label className="text-xs font-medium text-foreground mb-1.5 block">
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
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Upload Image
              </label>
              <label
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();

                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDraggingFile(false);
                  }
                }}
                onDrop={handleCreateFileDrop}
                className={`group flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors ${
                  isDraggingFile
                    ? "border-foreground bg-muted"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
              >
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="hidden"
                  onChange={handleCreateFileChange}
                />
                <Upload
                  size={24}
                  className="mb-2 text-muted-foreground group-hover:text-foreground transition-colors"
                />
                {convertingFile ? (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      Converting HEIC to JPEG...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Please wait
                    </div>
                  </div>
                ) : file ? (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      {file.name}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      {isDraggingFile
                        ? "Drop image here"
                        : "Drop or choose an image"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      JPG, PNG, WEBP, GIF, or HEIC
                    </div>
                  </div>
                )}
              </label>

              {file && (
                <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Filename preview:{" "}
                  <span className="font-medium text-foreground">
                    {filePreviewLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 mt-5">
            <button
              onClick={resetCreateForm}
              className="h-9 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || convertingFile}
              className="px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
            >
              <Upload size={16} />
              {convertingFile
                ? "Converting..."
                : uploading
                  ? "Uploading..."
                  : "Upload"}
            </button>
          </div>
        </div>

        <div className="border rounded-lg bg-background overflow-hidden min-w-0">
          <div className="p-3.5 pb-2 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Uploaded Payments
              </h2>
              <p className="text-sm text-muted-foreground">
                Click View to open the image in a preview window.
              </p>
            </div>
          </div>

          <div className="overflow-auto border-t border-border bg-background hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 bg-muted/60 backdrop-blur border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3">
                    Date
                  </th>
                  <th className="sticky top-0 z-10 bg-muted/60 backdrop-blur border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3">
                    Category
                  </th>
                  <th className="sticky top-0 z-10 bg-muted/60 backdrop-blur border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3">
                    Recipient
                  </th>
                  <th className="sticky top-0 z-10 bg-muted/60 backdrop-blur border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3">
                    Amount
                  </th>
                  <th className="sticky top-0 z-10 bg-muted/60 backdrop-blur border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3">
                    Payment Method
                  </th>
                  <th className="sticky top-0 z-10 bg-muted/60 backdrop-blur border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3">
                    Proof
                  </th>
                  <th className="sticky top-0 z-10 bg-muted/60 backdrop-blur border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-2.5 py-3">
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
                    <tr key={p._id} className="hover:bg-muted/20">
                      <td className="text-center text-xs px-2.5 py-2.5 border-b border-border">
                        {p.dateText}
                      </td>

                      <td className="text-center text-xs px-2.5 py-2.5 border-b border-border">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[0.72rem] font-bold bg-muted text-foreground">
                          {p.category}
                        </span>
                      </td>

                      <td className="text-center text-xs px-2.5 py-2.5 border-b border-border">
                        {p.recipient || "—"}
                      </td>

                      <td className="text-center text-xs px-2.5 py-2.5 border-b border-border tabular-nums">
                        {peso(Number(p.amount || 0))}
                      </td>

                      <td className="text-center text-xs px-2.5 py-2.5 border-b border-border">
                        {p.method || "—"}
                      </td>

                      <td className="text-center text-xs px-2.5 py-2.5 border-b border-border">
                        <button
                          onClick={() => openPreview(p)}
                          className="h-8 px-3 rounded-md inline-flex items-center justify-center gap-1.5 border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs font-medium"
                        >
                          <Eye size={14} />
                          View
                        </button>
                      </td>

                      <td className="text-center text-xs px-2.5 py-2.5 border-b border-border">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEdit(p)}
                            className="w-8 h-8 rounded-md inline-flex items-center justify-center border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            onClick={() => setDeleteModal(p)}
                            className="w-8 h-8 rounded-md inline-flex items-center justify-center border border-border bg-background text-muted-foreground hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transition-colors"
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
                      onClick={() => openPreview(p)}
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
          setIsDraggingEditFile(false);
          setConvertingEditFile(false);
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
                setIsDraggingEditFile(false);
                setConvertingEditFile(false);
              }}
              className="h-9 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={savingEdit || convertingEditFile}
              className="h-9 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {convertingEditFile
                ? "Converting..."
                : savingEdit
                  ? "Saving..."
                  : "Update"}
            </button>
          </>
        }
      >
        {editPayment && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={
                      inputClass + " flex items-center justify-between"
                    }
                  >
                    {editDate
                      ? format(new Date(`${editDate}T00:00:00`), "MMM d, yyyy")
                      : "Select date"}
                    <CalendarDays className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0 z-[9999]">
                  <Calendar
                    mode="single"
                    selected={
                      editDate ? new Date(`${editDate}T00:00:00`) : undefined
                    }
                    onSelect={(d) => {
                      if (!d) return;
                      setEditDate(toInputDate(d));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Category
              </label>
              <UiSelect
                value={editCategory}
                onValueChange={(val) => setEditCategory(val)}
              >
                <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </UiSelect>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Method
              </label>
              <UiSelect
                value={editMethod}
                onValueChange={(val) => setEditMethod(val)}
              >
                <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {METHOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </UiSelect>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
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
              <label className="text-xs font-medium text-foreground mb-1.5 block">
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
              <label className="text-xs font-medium text-foreground mb-1.5 block">
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
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Replace Proof Image (optional)
              </label>

              <label
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDraggingEditFile(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingEditFile(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();

                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDraggingEditFile(false);
                  }
                }}
                onDrop={handleEditFileDrop}
                className={`group flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-5 text-center transition-colors ${
                  isDraggingEditFile
                    ? "border-foreground bg-muted"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
              >
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="hidden"
                  onChange={handleEditFileChange}
                />
                <Upload
                  size={22}
                  className="mb-2 text-muted-foreground group-hover:text-foreground transition-colors"
                />
                {convertingEditFile ? (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      Converting HEIC to JPEG...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Please wait
                    </div>
                  </div>
                ) : editFile ? (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      {editFile.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(editFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      {isDraggingEditFile
                        ? "Drop image here"
                        : "Drop or choose a replacement image"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      JPG, PNG, WEBP, GIF, or HEIC
                    </div>
                  </div>
                )}
              </label>

              {editFile && (
                <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Filename preview:{" "}
                  <span className="font-medium text-foreground">
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
        onClose={() => {
          setPreviewPayment(null);

          if (previewImageUrl) {
            URL.revokeObjectURL(previewImageUrl);
            setPreviewImageUrl(null);
          }
        }}
        title={previewPayment ? `${previewPayment.category} Proof` : "Preview"}
        wide
        footer={
          <>
            <button
              onClick={() => {
                setPreviewPayment(null);

                if (previewImageUrl) {
                  URL.revokeObjectURL(previewImageUrl);
                  setPreviewImageUrl(null);
                }
              }}
              className="h-9 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Close
            </button>
            {previewPayment && (
              <button
                onClick={() => {
                  if (previewImageUrl) {
                    window.open(previewImageUrl, "_blank");
                  }
                }}
                disabled={!previewImageUrl}
                className="h-9 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Open in New Tab
              </button>
            )}
          </>
        }
      >
        {previewPayment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Date
                </div>
                <div className="text-sm font-medium text-foreground">
                  {previewPayment.dateText}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Category
                </div>
                <div className="text-sm font-medium text-foreground">
                  {previewPayment.category}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recipient
                </div>
                <div className="text-sm font-medium text-foreground">
                  {previewPayment.recipient || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Amount
                </div>
                <div className="text-sm font-medium text-foreground">
                  {peso(Number(previewPayment.amount || 0))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Method
                </div>
                <div className="text-sm font-medium text-foreground">
                  {previewPayment.method || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Filename
                </div>
                <div className="text-sm font-medium text-foreground">
                  {previewPayment.filename}
                </div>
              </div>
            </div>

            {previewPayment.note && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Note
                </div>
                <div>{previewPayment.note}</div>
              </div>
            )}

            <div className="rounded-md border border-border bg-muted/20 p-3 flex items-center justify-center">
              {previewLoading ? (
                <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
                  Loading payment proof...
                </div>
              ) : previewImageUrl ? (
                <img
                  src={previewImageUrl}
                  alt={previewPayment.filename}
                  className="max-w-full max-h-[58vh] w-auto h-auto object-contain rounded-md bg-background"
                />
              ) : (
                <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
                  Preview unavailable
                </div>
              )}
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
              className="px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={confirmDelete}
              className="px-6 py-2.5 rounded-md bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition"
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
