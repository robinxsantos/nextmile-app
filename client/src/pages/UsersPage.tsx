import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Shield,
  LifeBuoy,
  UserShield,
  Truck as TruckIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import EmptyState from "../components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  Card,
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserRow {
  _id: string;
  username: string;
  displayName: string;
  role: "admin" | "manager" | "employee";
  companyName: string;
  truckName: string;
  truck:
    | string
    | {
        _id: string;
        truckName: string;
        companyName?: string;
      }
    | null;
  licenseNumber: string;
  startDate: string | null;
  active: boolean;
}

interface CompanyOption {
  _id: string;
  companyName: string;
  status: "Active" | "Inactive";
}

export default function UsersPage() {
  const { truckOptions, initApp } = useAppStore();
  const { user: currentUser } = useAuthStore();

  const isAdmin = currentUser?.role === "admin";
  const isManager = currentUser?.role === "manager";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [openStartDate, setOpenStartDate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<UserRow | null>(null);

  const [form, setForm] = useState({
    username: "",
    password: "",
    displayName: "",
    role: "employee",
    companyName: "",
    truck: "none",
    licenseNumber: "",
    startDate: "",
  });

  useEffect(() => {
    initApp();
  }, [initApp]);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/users");
      setUsers(data.rows || []);
    } catch {
      toast.error("Failed to load users");
    }
  };

  const fetchCompanies = async () => {
    // Manager does not need the master company list.
    // Their company is fixed from their authenticated account.
    if (!isAdmin) {
      return;
    }

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

  useEffect(() => {
    fetchUsers();

    if (isAdmin) {
      fetchCompanies();
    }
  }, [isAdmin]);

  const openAdd = () => {
    setEditUser(null);

    setForm({
      username: "",
      password: "",
      displayName: "",
      role: "employee",
      companyName: isManager ? currentUser?.companyName || "" : "",
      truck: "none",
      licenseNumber: "",
      startDate: "",
    });

    setModal(true);
  };

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    const truckId =
      typeof u.truck === "object" && u.truck
        ? u.truck._id
        : typeof u.truck === "string"
          ? u.truck
          : "none";
    setForm({
      username: u.username,
      password: "",
      displayName: u.displayName,
      role: u.role,
      companyName: isManager
        ? currentUser?.companyName || ""
        : u.companyName || "",
      truck: truckId,
      licenseNumber: u.licenseNumber || "",
      startDate: u.startDate
        ? new Date(u.startDate).toISOString().slice(0, 10)
        : "",
    });

    setModal(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.displayName.trim()) {
      toast.error("Username and display name are required");
      return;
    }
    if (!editUser && !form.password) {
      toast.error("Password is required for new users");
      return;
    }

    if (form.role === "manager" && !form.companyName.trim()) {
      toast.error("Company is required for managers");
      return;
    }

    if (form.role === "employee" && (!form.truck || form.truck === "none")) {
      toast.error("Truck is required for employees");
      return;
    }

    if (form.role !== "admin" && !form.startDate) {
      toast.error("Start date is required");
      return;
    }

    if (form.role === "employee" && !form.licenseNumber.trim()) {
      toast.error("License number is required for drivers");
      return;
    }

    setLoading(true);
    try {
      if (editUser) {
        const payload: Record<string, unknown> = {
          displayName: form.displayName,
          role: form.role,
          startDate: form.role === "admin" ? null : form.startDate,
          licenseNumber:
            form.role === "employee" ? form.licenseNumber.trim() : "",
        };

        if (form.role === "manager") {
          payload.companyName = form.companyName;
          payload.truck = null;
        }

        if (form.role === "employee") {
          payload.companyName = form.companyName;
          payload.truck = form.truck;
        }

        if (form.role === "admin") {
          payload.companyName = "";
          payload.truck = null;
        }
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editUser._id}`, payload);
        toast.success("User updated");
      } else {
        await api.post("/users", {
          username: form.username,
          password: form.password,
          displayName: form.displayName,
          role: form.role,

          companyName:
            form.role === "manager" || form.role === "employee"
              ? form.companyName
              : "",

          truck: form.role === "employee" ? form.truck : null,

          licenseNumber:
            form.role === "employee" ? form.licenseNumber.trim() : "",

          startDate: form.role === "admin" ? null : form.startDate,
        });
        toast.success("User created");
      }
      setModal(false);
      fetchUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to save user";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await api.delete(`/users/${deleteModal._id}`);
      toast.success("User deleted");
      setDeleteModal(null);
      fetchUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to delete user";
      toast.error(msg);
    }
  };

  const roleOptions = isAdmin
    ? [
        { value: "admin", label: "Admin" },
        { value: "manager", label: "Manager" },
        { value: "employee", label: "Driver" },
      ]
    : [
        { value: "manager", label: "Manager" },
        { value: "employee", label: "Driver" },
      ];

  const companyOptions = Array.from(
    new Set([
      ...companies
        .filter((company) => company.status === "Active")
        .map((company) => company.companyName),
      ...(editUser?.companyName ? [editUser.companyName] : []),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const filteredTruckOptions = truckOptions.filter((t) => {
    if (isManager) {
      return (
        String(t.companyName || "")
          .trim()
          .toLowerCase() ===
        String(currentUser?.companyName || "")
          .trim()
          .toLowerCase()
      );
    }

    if (!form.companyName) {
      return false;
    }

    return (
      String(t.companyName || "")
        .trim()
        .toLowerCase() === form.companyName.trim().toLowerCase()
    );
  });

  const truckSelectOptions = filteredTruckOptions.map((t) => ({
    value: t._id,
    label: t.truckName,
  }));

  const filteredUsers =
    isAdmin && companyFilter !== "ALL"
      ? users.filter(
          (user) =>
            user.companyName.trim().toLowerCase() ===
            companyFilter.trim().toLowerCase(),
        )
      : users;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={openAdd}>
          <Plus data-icon="inline-start" />
          Add User
        </Button>
      </div>

      <Card size="sm" className="!gap-0 overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>User Records</CardTitle>
              <CardDescription>User accounts and assignments.</CardDescription>
            </div>

            {isAdmin && (
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ALL">All Companies</SelectItem>

                  {companies.map((company) => (
                    <SelectItem key={company._id} value={company.companyName}>
                      {company.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>

        {/* Desktop Table */}
        <div className="[&>div]:max-h-[calc(100vh-280px)] [&>div]:overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 z-20 bg-background hover:bg-background">
                <TableHead className="pl-4 text-xs">Username</TableHead>
                <TableHead className="text-xs">Display Name</TableHead>
                <TableHead className="text-xs text-center">Role</TableHead>
                <TableHead className="text-xs">Company</TableHead>
                <TableHead className="text-xs">Assigned Truck</TableHead>
                <TableHead className="text-xs">License No.</TableHead>
                <TableHead className="text-xs">Start Date</TableHead>
                <TableHead className="w-[100px] text-center text-xs">
                  Status
                </TableHead>
                <TableHead className="w-[100px] text-center text-xs">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <EmptyState
                      icon={Users}
                      title="No users found"
                      description={
                        isAdmin && companyFilter !== "ALL"
                          ? "No users are available for the selected company."
                          : "Create your first user account."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u._id}>
                    <TableCell className="pl-4 text-xs font-mono font-medium">
                      {u.username}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px]">
                            {u.displayName
                              .split(" ")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase())
                              .join("") || "U"}
                          </AvatarFallback>
                        </Avatar>

                        <span className="font-medium">{u.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "gap-1 font-normal",
                          u.role === "admin"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : u.role === "manager"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                        )}
                      >
                        {u.role === "employee" ? (
                          <LifeBuoy className="size-3" />
                        ) : u.role === "manager" ? (
                          <UserShield className="size-3" />
                        ) : (
                          <Shield className="size-3" />
                        )}

                        {u.role === "employee"
                          ? "Driver"
                          : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.companyName ? (
                        <span className="font-medium">{u.companyName}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.truckName ? (
                        <span className="inline-flex items-center gap-1">
                          {u.truckName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.role === "employee" && u.licenseNumber ? (
                        <span>{u.licenseNumber}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-xs">
                      {u.role !== "admin" && u.startDate ? (
                        new Date(u.startDate).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      <Badge
                        variant="secondary"
                        className={cn(
                          u.active
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {u.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {isManager && u._id === currentUser?._id ? (
                        <span className="text-xs text-muted-foreground">
                          Your account
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => openEdit(u)}
                            aria-label="Edit user"
                          >
                            <Pencil />
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setDeleteModal(u)}
                            aria-label="Delete user"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <>
        <Dialog open={modal} onOpenChange={setModal}>
          <DialogContent
            className="sm:max-w-[700px]"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>
                {editUser ? `Edit User – ${editUser.displayName}` : "Add User"}
              </DialogTitle>
            </DialogHeader>

            {/* 🔥 ORIGINAL BODY — UNCHANGED */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Username <span className="text-destructive">*</span>
                </Label>

                <Input
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  disabled={!!editUser}
                  placeholder="e.g. juan"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Password{" "}
                  {!editUser && <span className="text-destructive">*</span>}
                  {editUser && (
                    <span className="font-normal text-muted-foreground">
                      (leave blank to keep)
                    </span>
                  )}
                </Label>

                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder={editUser ? "••••••" : "Set password"}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Display Name <span className="text-destructive">*</span>
                </Label>

                <Input
                  value={form.displayName}
                  onChange={(e) =>
                    setForm({ ...form, displayName: e.target.value })
                  }
                  placeholder="e.g. Juan Dela Cruz"
                />
              </div>

              {/* ROLE */}
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>

                <Select
                  value={form.role}
                  onValueChange={(val) => {
                    setForm({
                      ...form,
                      role: val,
                      companyName:
                        val === "admin"
                          ? ""
                          : isManager
                            ? currentUser?.companyName || ""
                            : val === "employee"
                              ? ""
                              : form.companyName,
                      truck: "none",
                      licenseNumber:
                        val === "employee" ? form.licenseNumber : "",
                      startDate: val === "admin" ? "" : form.startDate,
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>

                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* COMPANY */}
              {form.role === "manager" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Company <span className="text-destructive">*</span>
                  </Label>

                  {isManager ? (
                    <Input value={currentUser?.companyName || ""} disabled />
                  ) : (
                    <Select
                      value={form.companyName}
                      onValueChange={(company) =>
                        setForm({
                          ...form,
                          companyName: company,
                          truck: "none",
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
              )}

              {/* EMPLOYEE COMPANY */}
              {form.role === "employee" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Company <span className="text-destructive">*</span>
                  </Label>

                  {isManager ? (
                    <Input value={currentUser?.companyName || ""} disabled />
                  ) : (
                    <Select
                      value={form.companyName}
                      onValueChange={(company) =>
                        setForm({
                          ...form,
                          companyName: company,
                          truck: "none",
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
              )}

              {form.role !== "admin" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Start Date <span className="text-destructive">*</span>
                  </Label>

                  <Popover open={openStartDate} onOpenChange={setOpenStartDate}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start font-normal",
                          !form.startDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />

                        <span className="truncate">
                          {form.startDate
                            ? format(
                                new Date(`${form.startDate}T00:00:00`),
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
                          form.startDate
                            ? new Date(`${form.startDate}T00:00:00`)
                            : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;

                          setForm({
                            ...form,
                            startDate: format(date, "yyyy-MM-dd"),
                          });

                          setOpenStartDate(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* DRIVER LICENSE */}
              {form.role === "employee" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    License Number <span className="text-destructive">*</span>
                  </Label>

                  <Input
                    value={form.licenseNumber}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        licenseNumber: e.target.value,
                      })
                    }
                    placeholder="Enter driver's license number"
                  />
                </div>
              )}

              {/* EMPLOYEE TRUCK */}
              {form.role === "employee" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Assigned Truck <span className="text-destructive">*</span>
                  </Label>

                  <Select
                    value={form.truck}
                    onValueChange={(truck) =>
                      setForm({
                        ...form,
                        truck,
                      })
                    }
                    disabled={isAdmin && !form.companyName}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          isAdmin && !form.companyName
                            ? "Select company first"
                            : "Select truck..."
                        }
                      />
                    </SelectTrigger>

                    <SelectContent>
                      {truckSelectOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModal(false)}
              >
                Cancel
              </Button>

              <Button type="button" onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : editUser ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteModal} onOpenChange={() => setDeleteModal(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete user?</DialogTitle>
            </DialogHeader>

            {/* 🔥 ORIGINAL BODY — UNCHANGED */}
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete
            </p>
            <p className="font-semibold mt-1">
              {deleteModal?.displayName} (@{deleteModal?.username})?
            </p>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteModal(null)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 />
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </div>
  );
}
