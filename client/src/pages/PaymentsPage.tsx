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
  Pencil,
  Check,
  ChevronsUpDown,
  RotateCcw,
  Search,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import type { DateRange } from "react-day-picker";
import Pagination from "../components/shared/Pagination";
import EmptyState from "../components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";

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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleting, setDeleting] = useState(false);
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
  const [openEditDate, setOpenEditDate] = useState(false);
  const [editTruck, setEditTruck] = useState("");

  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState("ALL");

  const [openPaymentPeriod, setOpenPaymentPeriod] = useState(false);

  const [paymentDateRange, setPaymentDateRange] = useState<
    DateRange | undefined
  >(undefined);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(10);

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

  const filteredPayments = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !query ||
        payment.recipient?.toLowerCase().includes(query) ||
        payment.category.toLowerCase().includes(query) ||
        payment.method?.toLowerCase().includes(query) ||
        payment.note?.toLowerCase().includes(query);

      const matchesCategory =
        paymentCategoryFilter === "ALL" ||
        payment.category === paymentCategoryFilter;

      const paymentDate = new Date(`${payment.date.slice(0, 10)}T00:00:00`);

      const matchesPeriod =
        !paymentDateRange?.from ||
        (paymentDate >= paymentDateRange.from &&
          (!paymentDateRange.to || paymentDate <= paymentDateRange.to));

      return matchesSearch && matchesCategory && matchesPeriod;
    });
  }, [payments, paymentSearch, paymentCategoryFilter, paymentDateRange]);

  const totalPaymentPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / paymentPageSize),
  );

  const paginatedPayments = useMemo(() => {
    const start = (paymentPage - 1) * paymentPageSize;
    const end = start + paymentPageSize;

    return filteredPayments.slice(start, end);
  }, [filteredPayments, paymentPage, paymentPageSize]);

  useEffect(() => {
    setPaymentPage(1);
  }, [paymentSearch, paymentCategoryFilter, paymentDateRange, selectedTruck]);

  useEffect(() => {
    if (paymentPage > totalPaymentPages) {
      setPaymentPage(totalPaymentPages);
    }
  }, [paymentPage, totalPaymentPages]);

  const paymentStats = useMemo(() => {
    return {
      count: payments.length,
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
    const paymentTruckId = typeof p.truck === "string" ? p.truck : p.truck._id;

    setEditPayment(p);
    setEditTruck(paymentTruckId);
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
    if (!selectedTruck) {
      toast.error("Please select a truck from the topbar");
      return;
    }
    if (!file) {
      toast.error("Please select a file");
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
    setUploadProgress(0);

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

        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;

          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );

          setUploadProgress(percent);
        },
      });

      toast.success("Payment attachment uploaded!");
      resetCreateForm();
      fetchPayments();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUpdate = async () => {
    if (!editPayment) return;

    if (!editRecipient.trim()) {
      toast.error("Recipient is required");
      return;
    }

    if (!editAmount || Number(editAmount) <= 0) {
      toast.error("Amount is required");
      return;
    }

    if (!editTruck) {
      toast.error("Truck is required.");
      return;
    }

    setSavingEdit(true);

    try {
      const formData = new FormData();

      formData.append("truckId", editTruck);
      formData.append("category", editCategory);
      formData.append("recipient", editRecipient.trim());
      formData.append("amount", editAmount);
      formData.append("method", editMethod);
      formData.append("date", editDate);
      formData.append("note", editNote.trim());

      if (editFile) {
        formData.append("file", editFile);
      }

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
      toast.error("Failed to load attachment");
      setPreviewPayment(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal || deleting) return;

    setDeleting(true);

    try {
      await api.delete(`/payments/${deleteModal._id}`);

      toast.success("Payment deleted");
      setDeleteModal(null);

      await fetchPayments();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-3.5 items-start">
        <Card size="sm" className="!gap-0">
          <CardHeader className="border-b">
            <div>
              <CardTitle>Upload Payment Attachment</CardTitle>
              <CardDescription>
                Record a payment and attach a supporting image.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="py-4">
            <div className="grid grid-cols-2 gap-4">
              {/* TRUCK */}
              <div className="space-y-1.5">
                <Label className="text-xs">Truck</Label>

                <Input
                  value={
                    truckOptions.find((truck) => truck._id === selectedTruck)
                      ?.truckName || "Select truck from topbar"
                  }
                  disabled
                />
              </div>

              {/* DATE */}
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>

                <Popover open={openDate} onOpenChange={setOpenDate}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                    >
                      {date
                        ? format(new Date(`${date}T00:00:00`), "MMM d, yyyy")
                        : "Select date"}

                      <CalendarDays className="size-4 opacity-50" />
                    </Button>
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

              {/* CATEGORY */}
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>

                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>

                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PAYMENT METHOD */}
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>

                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>

                  <SelectContent>
                    {METHOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* RECIPIENT */}
              <div className="space-y-1.5">
                <Label className="text-xs">Recipient</Label>

                <Input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Driver / Crew.."
                />
              </div>

              {/* AMOUNT */}
              <div className="space-y-1.5">
                <Label className="text-xs">Amount</Label>

                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* NOTE */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Note</Label>

                <Input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note..."
                />
              </div>

              {/* UPLOAD IMAGE */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Upload Image</Label>

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
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-blue-500/40 bg-blue-500/5 hover:border-blue-500 hover:bg-blue-500/10"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="hidden"
                    onChange={handleCreateFileChange}
                  />

                  <Upload className="mb-2 size-6 text-blue-500 transition-colors group-hover:text-blue-600" />

                  {convertingFile ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
                        Converting HEIC to JPEG...
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Please wait
                      </div>
                    </div>
                  ) : file ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{file.name}</div>

                      <div className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
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
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Filename preview:{" "}
                    <span className="font-medium text-foreground">
                      {filePreviewLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>

          {uploading && (
            <div className="space-y-1.5 border-t px-4 py-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Uploading payment attachment...</span>

                <span className="tabular-nums">{uploadProgress}%</span>
              </div>

              <Progress value={uploadProgress} />
            </div>
          )}

          <CardFooter className="justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={resetCreateForm}
              disabled={uploading || convertingFile}
            >
              Reset
            </Button>

            <Button
              type="button"
              onClick={handleUpload}
              disabled={uploading || convertingFile}
            >
              <Upload data-icon="inline-start" />

              {convertingFile
                ? "Converting..."
                : uploading
                  ? "Uploading..."
                  : "Upload"}
            </Button>
          </CardFooter>
        </Card>

        <Card size="sm" className="!gap-0 min-w-0 overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Uploaded Payments</CardTitle>

                <CardDescription>
                  View and manage uploaded payment attachments.
                </CardDescription>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-sm font-medium text-muted-foreground">
                  Records
                </div>

                <div className="text-sm font-medium">
                  {paymentStats.count} item{paymentStats.count === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="border-b py-4">
            <div className="flex flex-wrap items-end gap-2">
              {/* SEARCH */}
              <div className="min-w-[180px] flex-1">
                <Label className="mb-1.5 block text-xs text-muted-foreground">
                  Search
                </Label>

                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>

                  <InputGroupInput
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    placeholder="Search payments..."
                  />
                </InputGroup>
              </div>

              {/* CATEGORY */}
              <div className="w-[160px] shrink-0">
                <Label className="mb-1.5 block text-xs text-muted-foreground">
                  Category
                </Label>

                <Select
                  value={paymentCategoryFilter}
                  onValueChange={setPaymentCategoryFilter}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>

                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PERIOD */}
              <div className="w-[250px] shrink-0">
                <Label className="mb-1.5 block text-xs text-muted-foreground">
                  Period
                </Label>

                <Popover
                  open={openPaymentPeriod}
                  onOpenChange={setOpenPaymentPeriod}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                    >
                      <span
                        className={
                          !paymentDateRange?.from ? "text-muted-foreground" : ""
                        }
                      >
                        {paymentDateRange?.from && paymentDateRange?.to
                          ? `${format(paymentDateRange.from, "MMM d, yyyy")} - ${format(
                              paymentDateRange.to,
                              "MMM d, yyyy",
                            )}`
                          : "Select date range"}
                      </span>

                      <CalendarDays className="size-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      selected={paymentDateRange}
                      onSelect={(range) => {
                        setPaymentDateRange(range);

                        if (
                          range?.from &&
                          range?.to &&
                          range.from.getTime() !== range.to.getTime()
                        ) {
                          setOpenPaymentPeriod(false);
                        }
                      }}
                      numberOfMonths={2}
                      defaultMonth={paymentDateRange?.from}
                      showOutsideDays
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* RESET */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Reset payment filters"
                onClick={() => {
                  setPaymentSearch("");
                  setPaymentCategoryFilter("ALL");
                  setPaymentDateRange(undefined);
                }}
                disabled={
                  !paymentSearch &&
                  paymentCategoryFilter === "ALL" &&
                  !paymentDateRange?.from
                }
              >
                <RotateCcw />
              </Button>
            </div>
          </CardContent>

          <div className="[&>div]:max-h-[calc(100vh-280px)] [&>div]:overflow-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="sticky top-0 z-20 bg-background hover:bg-background">
                  <TableHead className="whitespace-nowrap text-xs font-medium">
                    Date
                  </TableHead>

                  {!selectedTruck && (
                    <TableHead className="whitespace-nowrap text-xs font-medium">
                      Truck
                    </TableHead>
                  )}

                  <TableHead className="whitespace-nowrap text-xs font-medium">
                    Category
                  </TableHead>

                  <TableHead className="whitespace-nowrap pr-8 text-right text-xs font-medium">
                    Amount
                  </TableHead>

                  <TableHead className="whitespace-nowrap text-xs font-medium">
                    Recipient
                  </TableHead>

                  <TableHead className="whitespace-nowrap text-xs font-medium">
                    Payment Method
                  </TableHead>

                  <TableHead className="whitespace-nowrap text-center text-xs font-medium">
                    Attachment
                  </TableHead>

                  <TableHead className="whitespace-nowrap text-center text-xs font-medium">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={selectedTruck ? 7 : 8} className="p-0">
                      <EmptyState
                        icon={ImageIcon}
                        title="No payment attachments yet"
                        description="Upload your first payment attachment to start tracking payments."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPayments.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {p.dateText}
                      </TableCell>

                      {!selectedTruck && (
                        <TableCell className="whitespace-nowrap text-xs">
                          {p.truckName ||
                            (typeof p.truck === "object"
                              ? p.truck.truckName
                              : "—")}
                        </TableCell>
                      )}

                      <TableCell className="text-xs">
                        <Badge
                          variant="secondary"
                          className="text-xs font-medium"
                        >
                          {p.category}
                        </Badge>
                      </TableCell>

                      <TableCell className="whitespace-nowrap pr-8 text-right text-xs font-medium tabular-nums">
                        {peso(Number(p.amount || 0))}
                      </TableCell>

                      <TableCell className="text-xs">
                        {p.recipient || "—"}
                      </TableCell>

                      <TableCell className="text-xs">
                        {p.method || "—"}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openPreview(p)}
                        >
                          <Eye />
                          View
                        </Button>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={() => openEdit(p)}
                              >
                                <Pencil />
                                <span className="sr-only">Edit payment</span>
                              </Button>
                            </TooltipTrigger>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={() => setDeleteModal(p)}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 />
                                <span className="sr-only">Delete payment</span>
                              </Button>
                            </TooltipTrigger>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredPayments.length > 0 && (
            <div className="flex items-center justify-center border-t">
              <Pagination
                currentPage={paymentPage}
                totalPages={totalPaymentPages}
                totalItems={filteredPayments.length}
                pageSize={paymentPageSize}
                onPageChange={setPaymentPage}
                onPageSizeChange={(size) => {
                  setPaymentPageSize(size);
                  setPaymentPage(1);
                }}
              />
            </div>
          )}
        </Card>
      </div>

      <Dialog
        open={!!editPayment}
        onOpenChange={(open) => {
          if (!open) {
            setEditPayment(null);
            setEditFile(null);
            setIsDraggingEditFile(false);
            setConvertingEditFile(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] !gap-3">
          <DialogHeader>
            <DialogTitle>
              {editPayment
                ? `Edit Payment - ${editPayment.dateText}`
                : "Edit Payment"}
            </DialogTitle>

            <DialogDescription className="sr-only">
              Update the payment details or replace the attachment.
            </DialogDescription>
          </DialogHeader>

          {editPayment && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              {/* TRUCK */}
              <div className="space-y-1.5">
                <Label className="text-xs">Truck</Label>

                <div className="flex h-9 w-full items-center rounded-md border bg-muted/40 px-3 text-sm">
                  <span className="truncate">
                    {truckOptions.find((truck) => truck._id === editTruck)
                      ?.truckName || "Select truck"}
                  </span>
                </div>
              </div>

              {/* DATE */}
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>

                <Popover open={openEditDate} onOpenChange={setOpenEditDate}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                    >
                      {editDate
                        ? format(
                            new Date(`${editDate}T00:00:00`),
                            "MMM d, yyyy",
                          )
                        : "Select date"}

                      <CalendarDays className="size-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={
                        editDate ? new Date(`${editDate}T00:00:00`) : undefined
                      }
                      onSelect={(d) => {
                        if (!d) return;

                        setEditDate(toInputDate(d));
                        setOpenEditDate(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* CATEGORY */}
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>

                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>

                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* METHOD */}
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>

                <Select value={editMethod} onValueChange={setEditMethod}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>

                  <SelectContent>
                    {METHOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* RECIPIENT */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-payment-recipient" className="text-xs">
                  Recipient
                </Label>

                <Input
                  id="edit-payment-recipient"
                  value={editRecipient}
                  onChange={(e) => setEditRecipient(e.target.value)}
                />
              </div>

              {/* AMOUNT */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-payment-amount" className="text-xs">
                  Amount
                </Label>

                <Input
                  id="edit-payment-amount"
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>

              {/* NOTE */}
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-payment-note" className="text-xs">
                  Note
                </Label>

                <Input
                  id="edit-payment-note"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                />
              </div>

              {/* REPLACE PROOF */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Replace Attachment (optional)</Label>

                <Button
                  variant="outline"
                  asChild
                  className={`h-[96px] w-full border-dashed ${
                    isDraggingEditFile
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-blue-500/40 bg-blue-500/5 hover:border-blue-500 hover:bg-blue-500/10"
                  }`}
                >
                  <label
                    className="group flex cursor-pointer flex-col items-center justify-center"
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
                  >
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
                      className="hidden"
                      onChange={handleEditFileChange}
                    />

                    <Upload className="mb-1 size-5 text-blue-500 transition-colors group-hover:text-blue-600" />

                    {convertingEditFile ? (
                      <>
                        <span>Converting HEIC to JPEG...</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          Please wait
                        </span>
                      </>
                    ) : editFile ? (
                      <>
                        <span className="max-w-full truncate">
                          {editFile.name}
                        </span>

                        <span className="text-xs font-normal text-muted-foreground">
                          {(editFile.size / 1024).toFixed(1)} KB
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          {isDraggingEditFile
                            ? "Drop image here"
                            : "Drop or choose a replacement image"}
                        </span>

                        <span className="text-xs font-normal text-muted-foreground">
                          JPG, PNG, WEBP, GIF, or HEIC
                        </span>
                      </>
                    )}
                  </label>
                </Button>

                {editFile && (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Filename preview:{" "}
                    <span className="font-medium text-foreground">
                      {editFilePreviewLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingEdit || convertingEditFile}
              onClick={() => {
                setEditPayment(null);
                setEditFile(null);
                setIsDraggingEditFile(false);
                setConvertingEditFile(false);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleUpdate}
              disabled={savingEdit || convertingEditFile}
            >
              {convertingEditFile
                ? "Converting..."
                : savingEdit
                  ? "Saving..."
                  : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer
        open={!!previewPayment}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewPayment(null);

            if (previewImageUrl) {
              URL.revokeObjectURL(previewImageUrl);
              setPreviewImageUrl(null);
            }
          }
        }}
        direction="right"
      >
        <DrawerContent className="data-[vaul-drawer-direction=right]:!w-[460px] data-[vaul-drawer-direction=right]:!max-w-[90vw]">
          <DrawerHeader>
            <DrawerTitle>
              {previewPayment
                ? `${previewPayment.category} Attachment`
                : "Payment Attachment"}
            </DrawerTitle>

            <DrawerDescription className="sr-only">
              View payment details and the uploaded attachment.
            </DrawerDescription>
          </DrawerHeader>

          {previewPayment && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="text-sm font-medium">
                    {previewPayment.dateText}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Category
                  </Label>
                  <p className="text-sm font-medium">
                    {previewPayment.category}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Recipient
                  </Label>
                  <p className="text-sm font-medium">
                    {previewPayment.recipient || "—"}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Amount
                  </Label>
                  <p className="text-sm font-medium tabular-nums">
                    {peso(Number(previewPayment.amount || 0))}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Payment Method
                  </Label>
                  <p className="text-sm font-medium">
                    {previewPayment.method || "—"}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Filename
                  </Label>
                  <p className="break-all text-sm font-medium">
                    {previewPayment.filename}
                  </p>
                </div>
              </div>

              {previewPayment.note && (
                <div className="mt-4 space-y-1 rounded-md border bg-muted/30 p-3">
                  <Label className="text-xs text-muted-foreground">Note</Label>
                  <p className="text-sm">{previewPayment.note}</p>
                </div>
              )}

              <div className="mt-4 flex min-h-[320px] items-center justify-center rounded-md bg-muted p-3">
                {previewLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading image...
                  </p>
                ) : previewImageUrl ? (
                  <img
                    src={previewImageUrl}
                    alt={previewPayment.filename}
                    className="max-h-[60vh] max-w-full rounded-md object-contain"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Preview unavailable
                  </p>
                )}
              </div>
            </div>
          )}

          <DrawerFooter>
            <Button
              disabled={!previewImageUrl}
              onClick={() => {
                if (previewImageUrl) {
                  window.open(previewImageUrl, "_blank");
                }
              }}
            >
              Open in New Tab
            </Button>

            <DrawerClose render={<Button variant="outline">Close</Button>} />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog
        open={!!deleteModal}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModal(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete payment?</DialogTitle>

            <DialogDescription>
              Are you sure you want to delete this payment attachment?
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
              disabled={deleting}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              <Trash2 />
              {deleting ? "Deleting..." : "Delete Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
