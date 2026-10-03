import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { useAppStore, type TruckRow } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
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
  ArrowUp,
  ArrowDown,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Wrench,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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

interface CompanyOption {
  _id: string;
  companyName: string;
  status: "Active" | "Inactive";
}

const formatNumberWithComma = (value: string) => {
  const num = value.replace(/,/g, "");
  if (!num) return "";
  return Number(num).toLocaleString();
};

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
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
  const { user: currentUser } = useAuthStore();

  const isManager = currentUser?.role === "manager";
  const isAdmin = currentUser?.role === "admin";

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [fleetSort, setFleetSort] = useState<{
    field: "truckName" | "companyName" | "status";
    direction: "asc" | "desc";
  } | null>(null);

  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [truckModal, setTruckModal] = useState(false);
  const [editRow, setEditRow] = useState<TruckRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<TruckRow | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [changeOilModal, setChangeOilModal] = useState<TruckRow | null>(null);
  const [openChangeOilDate, setOpenChangeOilDate] = useState(false);

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
    companyName: "",
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

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const fetchCompanies = async () => {
      try {
        const { data } = await api.get("/companies");
        setCompanies(data.rows || []);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error || "Failed to load companies";

        toast.error(msg);
      }
    };

    fetchCompanies();
  }, [isAdmin]);

  const companyOptions = Array.from(
    new Set([
      ...companies
        .filter((company) => company.status === "Active")
        .map((company) => company.companyName),
      ...(editRow?.companyName ? [editRow.companyName] : []),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const openAdd = () => {
    setEditRow(null);

    setForm({
      truckName: "",
      companyName: isManager ? currentUser?.companyName || "" : "",
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
      companyName: row.companyName || "",
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

    if (!form.companyName.trim()) {
      toast.error("Company name is required.", {
        duration: 6000,
      });
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
        companyName: form.companyName.trim(),
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
    setEditingOilRecordId(null);
    setDeleteOilRecordId(null);
    setOpenChangeOilDate(false);
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

  const filteredTruckRows = [...truckRows]
    .filter((row) => {
      if (!isAdmin || companyFilter === "ALL") return true;

      return row.companyName === companyFilter;
    })
    .sort((a, b) => {
      if (!fleetSort) return 0;

      const aValue =
        fleetSort.field === "truckName"
          ? a.truckName || ""
          : fleetSort.field === "companyName"
            ? a.companyName || ""
            : a.status || "";

      const bValue =
        fleetSort.field === "truckName"
          ? b.truckName || ""
          : fleetSort.field === "companyName"
            ? b.companyName || ""
            : b.status || "";

      const result = aValue.localeCompare(bValue, undefined, {
        numeric: true,
        sensitivity: "base",
      });

      return fleetSort.direction === "asc" ? result : -result;
    });

  const toggleFleetSort = (field: "truckName" | "companyName" | "status") => {
    setFleetSort((current) => {
      if (!current || current.field !== field) {
        return {
          field,
          direction: "asc",
        };
      }

      if (current.direction === "asc") {
        return {
          field,
          direction: "desc",
        };
      }

      return null;
    });
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={openAdd}>
          <Plus data-icon="inline-start" />
          Add Vehicle
        </Button>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* TOTAL TRUCKS */}
        <Card size="sm">
          <CardHeader className="grid grid-cols-[1fr_auto] items-start">
            <CardTitle>Total Trucks</CardTitle>

            <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <Truck className="size-4" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {truckStats.total.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* ACTIVE */}
        <Card size="sm">
          <CardHeader className="grid grid-cols-[1fr_auto] items-start">
            <CardTitle>Active</CardTitle>

            <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <CheckCircle2 className="size-4" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {truckStats.active.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* INACTIVE */}
        <Card size="sm">
          <CardHeader className="grid grid-cols-[1fr_auto] items-start">
            <CardTitle>Inactive</CardTitle>

            <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <ArrowUpDown className="size-4" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {truckStats.inactive.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card size="sm" className="!gap-0 overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Fleet Records</CardTitle>

              <CardDescription>Truck registry and records</CardDescription>
            </div>

            {isAdmin && (
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Filter by company" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ALL">All Companies</SelectItem>

                  {Array.from(
                    new Set(
                      truckRows.map((row) => row.companyName).filter(Boolean),
                    ),
                  )
                    .sort((a, b) => a.localeCompare(b))
                    .map((company) => (
                      <SelectItem key={company} value={company}>
                        {company}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        {/* FLEET TABLE */}
        {filteredTruckRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No trucks found
          </div>
        ) : (
          <div className="[&>div]:max-h-[calc(100vh-320px)] [&>div]:overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 z-20 bg-background hover:bg-background">
                  <TableHead className="pl-4 text-xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-8 gap-1.5 px-2 text-xs font-medium"
                      onClick={() => toggleFleetSort("truckName")}
                    >
                      Vehicle Name
                      {fleetSort?.field === "truckName" ? (
                        fleetSort.direction === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </TableHead>

                  <TableHead className="w-[100px] text-center text-xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-2 text-xs font-medium"
                      onClick={() => toggleFleetSort("status")}
                    >
                      Status
                      {fleetSort?.field === "status" ? (
                        fleetSort.direction === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </TableHead>

                  <TableHead className="text-xs">
                    {isAdmin ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 gap-1.5 px-2 text-xs font-medium"
                        onClick={() => toggleFleetSort("companyName")}
                      >
                        Company
                        {fleetSort?.field === "companyName" ? (
                          fleetSort.direction === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : (
                            <ArrowDown className="size-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    ) : (
                      "Company"
                    )}
                  </TableHead>

                  <TableHead className="text-xs">Client</TableHead>

                  <TableHead className="text-xs">Billed To</TableHead>

                  <TableHead className="text-xs">Last Change Oil</TableHead>

                  <TableHead className="text-xs">Cutoff Type</TableHead>

                  <TableHead className="w-[130px] text-center text-xs">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredTruckRows.map((r) => {
                  const client = r.client ?? r.notes ?? "";

                  return (
                    <TableRow key={r._id}>
                      {/* TRUCK */}
                      <TableCell className="pl-4 whitespace-nowrap text-sm font-medium">
                        {r.truckName}
                      </TableCell>

                      {/* STATUS */}
                      <TableCell className="text-center text-xs">
                        <Badge
                          variant="secondary"
                          className={cn(
                            r.status === "Active"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>

                      {/* COMPANY */}
                      <TableCell className="text-xs">
                        {r.companyName || "—"}
                      </TableCell>

                      {/* CLIENT */}
                      <TableCell className="text-xs">{client || "—"}</TableCell>

                      {/* BILLING */}
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.billingType === "direct"
                          ? `Direct (${client || "—"})`
                          : r.billedTo || "—"}
                      </TableCell>

                      {/* LAST CHANGE OIL */}
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {kmDisplay(r.lastChangeOil)}
                      </TableCell>

                      {/* CUTOFF TYPE */}
                      <TableCell className="whitespace-nowrap text-xs capitalize">
                        {r.cutoffType}
                      </TableCell>

                      {/* ACTIONS */}
                      <TableCell className="text-xs">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => openChangeOilHistory(r)}
                            aria-label="Change Oil"
                          >
                            <Wrench />
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => openEdit(r)}
                            aria-label="Edit Truck"
                          >
                            <Pencil />
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              setDeletePassword("");
                              setDeleteModal(r);
                            }}
                            aria-label="Delete Truck"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Truck Modal */}
      <>
        {/* ADD / EDIT TRUCK */}
        <Dialog
          open={truckModal}
          onOpenChange={(open) => {
            setTruckModal(open);

            if (!open) {
              setEditRow(null);
            }
          }}
        >
          <DialogContent
            className="sm:max-w-[700px]"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>
                {editRow
                  ? `Edit Vehicle – ${editRow.truckName}`
                  : form.companyName
                    ? `Add Vehicle – ${form.companyName}`
                    : "Add Vehicle"}
              </DialogTitle>
            </DialogHeader>

            {/* ✅ ORIGINAL FORM (UNCHANGED) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle Name</Label>

                <Input
                  value={form.truckName}
                  onChange={(e) =>
                    setForm({ ...form, truckName: e.target.value })
                  }
                  placeholder="e.g. AAA 1234"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Company Name</Label>

                {isManager ? (
                  <Input value={currentUser?.companyName || ""} disabled />
                ) : (
                  <Select
                    value={form.companyName}
                    onValueChange={(val) =>
                      setForm({
                        ...form,
                        companyName: val,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select company..." />
                    </SelectTrigger>

                    <SelectContent>
                      {companyOptions.map((company) => (
                        <SelectItem key={company} value={company}>
                          {company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>

                <Select
                  value={form.status}
                  onValueChange={(val) => setForm({ ...form, status: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Cutoff Type</Label>

                <Select
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
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {CUTOFF_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Billing Type</Label>

                <Select
                  value={form.billingType}
                  onValueChange={(val) =>
                    setForm((prev) => ({
                      ...prev,
                      billingType: val,
                      billedTo: val === "direct" ? "" : prev.billedTo,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {BILLING_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.billingType === "subcontracted" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Billed To</Label>

                  <Input
                    value={form.billedTo}
                    onChange={(e) =>
                      setForm({ ...form, billedTo: e.target.value })
                    }
                    placeholder="Company Name"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>

                <Input
                  value={form.client}
                  onChange={(e) => setForm({ ...form, client: e.target.value })}
                  placeholder="e.g. Shopee"
                />
              </div>

              {/* 🔥 KEEP YOUR WEEKLY / MONTHLY BLOCK EXACTLY */}
              {form.cutoffType === "weekly" ? (
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs">Cutoff Settings</Label>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["cutoffStart", "Cutoff Start"],
                      ["cutoffEnd", "Cutoff End"],
                      ["payday", "Payday"],
                      ["dayOff", "Day Off"],
                    ].map(([key, label]) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs">{label}</Label>

                        <Select
                          value={form[key as keyof typeof form]}
                          onValueChange={(val) =>
                            setForm({ ...form, [key]: val })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {DAY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs">Monthly Cutoff Settings</Label>

                  <div className="grid grid-cols-3 gap-3">
                    {["cutoffStart", "cutoffEnd", "payday"].map((key) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs">
                          {key === "cutoffStart"
                            ? "Cutoff Start"
                            : key === "cutoffEnd"
                              ? "Cutoff End"
                              : "Payday"}
                        </Label>

                        <Select
                          value={form[key as keyof typeof form]}
                          onValueChange={(val) =>
                            setForm({ ...form, [key]: val })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            {MONTH_DAY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        Monthly Cutoff:
                      </span>{" "}
                      1 to 31 covers the entire calendar month.
                    </p>

                    <p className="mt-1">
                      <span className="font-medium text-foreground">
                        Cross-Month Cutoff:
                      </span>{" "}
                      26 to 25 starts on the 26th of the current month and ends
                      on the 25th of the following month.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTruckModal(false);
                  setEditRow(null);
                }}
              >
                Cancel
              </Button>

              <Button type="button" onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : editRow ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CHANGE OIL HISTORY */}
        <Dialog
          open={!!changeOilModal}
          onOpenChange={(open) => {
            if (!open) {
              setChangeOilModal(null);
              setEditingOilRecordId(null);
              setDeleteOilRecordId(null);
              setOpenChangeOilDate(false);
            }
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
              <Card size="sm" className="gap-2">
                <CardHeader>
                  <CardTitle>Current Last Change Oil</CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="text-xl font-semibold tabular-nums">
                    {changeOilModal?.lastChangeOil != null
                      ? `${Number(changeOilModal.lastChangeOil).toLocaleString()} km`
                      : "No record"}
                  </div>
                </CardContent>
              </Card>

              {/* ADD RECORD */}
              <Card size="sm" className="gap-0">
                <CardHeader className="border-b">
                  <CardTitle>
                    {editingOilRecordId
                      ? "Edit Change Oil Record"
                      : "Add Change Oil Record"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Date</Label>

                      <Popover
                        open={openChangeOilDate}
                        onOpenChange={setOpenChangeOilDate}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={`w-full justify-start font-normal ${
                              !changeOilForm.date ? "text-muted-foreground" : ""
                            }`}
                          >
                            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />

                            <span className="truncate">
                              {changeOilForm.date
                                ? format(
                                    new Date(`${changeOilForm.date}T00:00:00`),
                                    "MMMM d, yyyy",
                                  )
                                : "Select date"}
                            </span>
                          </Button>
                        </PopoverTrigger>

                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              changeOilForm.date
                                ? new Date(`${changeOilForm.date}T00:00:00`)
                                : undefined
                            }
                            onSelect={(date) => {
                              if (!date) return;

                              setChangeOilForm((prev) => ({
                                ...prev,
                                date: format(date, "yyyy-MM-dd"),
                              }));

                              setOpenChangeOilDate(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Odometer</Label>

                      <div className="relative">
                        <Input
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
                          className="pr-12"
                        />

                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                          KM
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Notes</Label>

                      <Input
                        value={changeOilForm.notes}
                        onChange={(e) =>
                          setChangeOilForm((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-3 mt-3">
                    {editingOilRecordId && (
                      <Button
                        type="button"
                        variant="outline"
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
                      >
                        Cancel Edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={
                        editingOilRecordId
                          ? handleUpdateChangeOilRecord
                          : handleAddChangeOilRecord
                      }
                      disabled={changeOilLoading}
                    >
                      {editingOilRecordId ? (
                        <Pencil data-icon="inline-start" />
                      ) : (
                        <Plus data-icon="inline-start" />
                      )}

                      {changeOilLoading
                        ? "Saving..."
                        : editingOilRecordId
                          ? "Update Record"
                          : "Add Record"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* HISTORY */}
              <div className="space-y-2">
                <div className="text-sm font-medium">History</div>

                <div className="overflow-hidden rounded-md border">
                  {!changeOilModal?.changeOilHistory?.length ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No change oil history yet.
                    </div>
                  ) : (
                    <div className="[&>div]:max-h-[260px] [&>div]:overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="sticky top-0 z-20 bg-background hover:bg-background">
                            <TableHead className="text-xs">Date</TableHead>

                            <TableHead className="text-right text-xs">
                              Odometer
                            </TableHead>

                            <TableHead className="text-xs">Notes</TableHead>

                            <TableHead className="w-[90px] text-center text-xs">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {[...(changeOilModal.changeOilHistory || [])]
                            .sort(
                              (a, b) =>
                                new Date(b.date).getTime() -
                                new Date(a.date).getTime(),
                            )
                            .map((record) => (
                              <TableRow key={record._id}>
                                <TableCell className="whitespace-nowrap text-xs">
                                  {new Date(record.date).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "long",
                                      day: "numeric",
                                      year: "numeric",
                                    },
                                  )}
                                </TableCell>

                                <TableCell className="whitespace-nowrap text-right text-xs font-medium tabular-nums">
                                  {record.odometer != null
                                    ? `${Number(record.odometer).toLocaleString()} KM`
                                    : "—"}
                                </TableCell>

                                <TableCell className="text-xs">
                                  {record.notes || "—"}
                                </TableCell>

                                <TableCell className="w-[90px]">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon-sm"
                                      onClick={() =>
                                        handleEditChangeOilRecord(record)
                                      }
                                      aria-label="Edit record"
                                    >
                                      <Pencil />
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon-sm"
                                      onClick={() =>
                                        setDeleteOilRecordId(record._id)
                                      }
                                      aria-label="Delete record"
                                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setChangeOilModal(null);
                  setEditingOilRecordId(null);
                  setDeleteOilRecordId(null);
                  setOpenChangeOilDate(false);
                }}
              >
                Close
              </Button>
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteOilRecordId(null)}
                disabled={changeOilLoading}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteChangeOilRecord}
                disabled={changeOilLoading}
              >
                <Trash2 />
                {changeOilLoading ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DELETE TRUCK */}
        <Dialog
          open={!!deleteModal}
          onOpenChange={(open) => {
            if (!open && !deleteLoading) {
              setDeleteModal(null);
              setDeletePassword("");
            }
          }}
        >
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Delete truck?</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  You are about to permanently delete:
                </p>

                <p className="font-bold mt-1">{deleteModal?.truckName}</p>
              </div>

              <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-xs text-red-600 dark:text-red-400">
                  This will also permanently delete the truck's related trips
                  and expenses. This action cannot be undone.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Enter your password to confirm
                </Label>

                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  disabled={deleteLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && deletePassword.trim()) {
                      e.preventDefault();

                      document.getElementById("confirm-delete-truck")?.click();
                    }
                  }}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteModal(null);
                  setDeletePassword("");
                }}
                disabled={deleteLoading}
              >
                Cancel
              </Button>

              <Button
                id="confirm-delete-truck"
                type="button"
                variant="destructive"
                disabled={deleteLoading || !deletePassword.trim()}
                onClick={async () => {
                  if (!deleteModal || !deletePassword.trim()) {
                    return;
                  }

                  setDeleteLoading(true);

                  try {
                    await deleteTruck(deleteModal._id, deletePassword);

                    setDeleteModal(null);
                    setDeletePassword("");
                  } catch {
                    // Store already displays the backend error.
                    // Keep modal open so the user can retry.
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
              >
                <Trash2 />
                {deleteLoading ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </div>
  );
}
