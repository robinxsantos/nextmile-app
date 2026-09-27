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
  Check,
  ChevronsUpDown,
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

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import EmptyState from "../components/shared/EmptyState";

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
  const [openCompanyFilter, setOpenCompanyFilter] = useState(false);
  const [openRole, setOpenRole] = useState(false);
  const [openFormCompany, setOpenFormCompany] = useState(false);
  const [openFormTruck, setOpenFormTruck] = useState(false);
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

  const inputClass =
    "w-full min-h-[44px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3.5 text-xs focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors";

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
      <div className="mb-4">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-[20px] font-bold tracking-[-0.03em]">
              User List
              {isManager && currentUser?.companyName
                ? ` – ${currentUser.companyName}`
                : ""}
            </h1>
          </div>
          <button
            onClick={openAdd}
            className="h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
          >
            <Plus size={18} /> Add User
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="mb-4 flex items-end gap-3">
          <div className="w-full sm:w-[280px]">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Company
            </label>

            <Popover
              open={openCompanyFilter}
              onOpenChange={setOpenCompanyFilter}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                >
                  <span className="truncate">
                    {companyFilter === "ALL" ? "All Companies" : companyFilter}
                  </span>

                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>

              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command>
                  <CommandInput
                    placeholder="Search company..."
                    className="text-xs"
                  />

                  <CommandEmpty className="text-xs">
                    No company found.
                  </CommandEmpty>

                  <CommandGroup>
                    <CommandItem
                      value="All Companies"
                      className="text-xs"
                      onSelect={() => {
                        setCompanyFilter("ALL");
                        setOpenCompanyFilter(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          companyFilter === "ALL" ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      All Companies
                    </CommandItem>

                    {companies.map((company) => (
                      <CommandItem
                        key={company._id}
                        value={company.companyName}
                        className="text-xs"
                        onSelect={() => {
                          setCompanyFilter(company.companyName);
                          setOpenCompanyFilter(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            companyFilter === company.companyName
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />

                        {company.companyName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <div className="border rounded-lg bg-background overflow-hidden">
        {/* Desktop Table */}
        <div className="overflow-auto bg-background hidden md:block">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {[
                  "Username",
                  "Display Name",
                  "Role",
                  "Company",
                  "Assigned Truck",
                  "License No.",
                  "Start Date",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 bg-muted/40 border-b border-slate-200 dark:border-slate-700 text-left text-xs font-semibold text-muted-foreground px-3 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon={Users}
                      title="No users found"
                      description={
                        isAdmin && companyFilter !== "ALL"
                          ? "No users are available for the selected company."
                          : "Create your first user account."
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u._id}
                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50"
                  >
                    <td className="text-left text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 font-mono font-semibold">
                      {u.username}
                    </td>
                    <td className="text-left text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 font-semibold">
                      {u.displayName}
                    </td>
                    <td className="text-left text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                          u.role === "admin"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : u.role === "manager"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {u.role === "employee" ? (
                          <LifeBuoy size={12} />
                        ) : u.role === "manager" ? (
                          <UserShield size={12} />
                        ) : (
                          <Shield size={12} />
                        )}

                        {u.role === "employee"
                          ? "Driver"
                          : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </span>
                    </td>
                    <td className="text-left text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      {u.companyName ? (
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {u.companyName}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="text-left text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      {u.truckName ? (
                        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <TruckIcon size={12} /> {u.truckName}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="text-left text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      {u.role === "employee" && u.licenseNumber ? (
                        <span className="font-medium">{u.licenseNumber}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">
                          —
                        </span>
                      )}
                    </td>

                    <td className="text-left text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">
                      {u.role !== "admin" && u.startDate ? (
                        new Date(u.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="text-left text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <span
                        className={cn(
                          "inline-flex min-w-[76px] rounded-md items-center justify-center px-2.5 py-1 text-[0.7rem] font-bold",
                          u.active
                            ? "bg-green-500/10 text-green-500"
                            : "bg-slate-400/10 text-slate-400",
                        )}
                      >
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-left text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      {isManager && u._id === currentUser?._id ? (
                        <span className="text-[11px] text-muted-foreground">
                          Your account
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            className="w-[34px] h-[34px] rounded-md inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-blue-500/10 hover:text-blue-600 transition-all"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            onClick={() => setDeleteModal(u)}
                            className="w-[34px] h-[34px] rounded-md inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-red-500/10 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="flex flex-col gap-3 md:hidden p-3">
          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description={
                isAdmin && companyFilter !== "ALL"
                  ? "No users are available for the selected company."
                  : "Create your first user account."
              }
            />
          ) : (
            filteredUsers.map((u) => (
              <div
                key={u._id}
                className="glass-card rounded-xl border border-slate-200 dark:border-slate-700 p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-sm">{u.displayName}</div>
                    <div className="text-xs font-mono text-slate-500">
                      @{u.username}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.72rem] font-bold ${
                      u.role === "admin"
                        ? "bg-purple-500/10 text-purple-600"
                        : u.role === "manager"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-blue-500/10 text-blue-600"
                    }`}
                  >
                    {u.role === "employee" ? (
                      <LifeBuoy size={12} />
                    ) : u.role === "manager" ? (
                      <UserShield size={12} />
                    ) : (
                      <Shield size={12} />
                    )}
                    {u.role === "employee"
                      ? "Driver"
                      : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                  </span>
                </div>
                {u.companyName && (
                  <div className="text-xs text-slate-500 mb-1">
                    {u.companyName}
                  </div>
                )}
                {u.truckName && (
                  <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <TruckIcon size={12} /> {u.truckName}
                  </div>
                )}
                {u.role === "employee" && u.licenseNumber && (
                  <div className="text-xs text-slate-500 mb-1">
                    License: {u.licenseNumber}
                  </div>
                )}

                {u.role !== "admin" && u.startDate && (
                  <div className="text-xs text-slate-500 mb-2">
                    Start Date:{" "}
                    {new Date(u.startDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                )}
                {isManager && u._id === currentUser?._id ? (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-muted-foreground">
                    Your account
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => openEdit(u)}
                      className="flex-1 h-9 rounded-xl inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-blue-500/10 hover:text-blue-600 transition-all text-xs font-semibold"
                    >
                      <Pencil size={14} /> Edit
                    </button>

                    <button
                      onClick={() => setDeleteModal(u)}
                      className="h-9 w-9 rounded-xl inline-flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-red-500/10 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <>
        {/* Add/Edit Modal */}
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
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  disabled={!!editUser}
                  className={inputClass + (editUser ? " opacity-50" : "")}
                  placeholder="e.g. juan"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Password{" "}
                  {!editUser && <span className="text-red-500">*</span>}
                  {editUser && (
                    <span className="text-slate-400 font-normal">
                      (leave blank to keep)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className={inputClass}
                  placeholder={editUser ? "••••••" : "Set password"}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm({ ...form, displayName: e.target.value })
                  }
                  className={inputClass}
                  placeholder="e.g. Juan Dela Cruz"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Role
                </label>
                <Popover open={openRole} onOpenChange={setOpenRole}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      className="w-full h-11 rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                    >
                      <span className="truncate">
                        {roleOptions.find((opt) => opt.value === form.role)
                          ?.label || "Select role"}
                      </span>

                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>

                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0 z-[9999]"
                    align="start"
                  >
                    <Command>
                      <CommandGroup>
                        {roleOptions.map((opt) => (
                          <CommandItem
                            key={opt.value}
                            value={opt.label}
                            className="text-xs"
                            onSelect={() => {
                              const val = opt.value;

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
                                startDate:
                                  val === "admin" ? "" : form.startDate,
                              });

                              setOpenRole(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                form.role === opt.value
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />

                            {opt.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* COMPANY */}
              {form.role === "manager" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    Company <span className="text-red-500">*</span>
                  </label>

                  {isManager ? (
                    <input
                      value={currentUser?.companyName || ""}
                      disabled
                      className={`${inputClass} opacity-60 cursor-not-allowed bg-muted`}
                    />
                  ) : (
                    <Popover
                      open={openFormCompany}
                      onOpenChange={setOpenFormCompany}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          role="combobox"
                          className="w-full h-11 rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                        >
                          <span
                            className={`truncate ${
                              !form.companyName ? "text-muted-foreground" : ""
                            }`}
                          >
                            {form.companyName || "Select company..."}
                          </span>

                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>

                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0 z-[9999]"
                        align="start"
                      >
                        <Command>
                          <CommandInput
                            placeholder="Search company..."
                            className="text-xs"
                          />

                          <CommandEmpty className="text-xs">
                            No company found.
                          </CommandEmpty>

                          <CommandGroup>
                            {companyOptions.map((company) => (
                              <CommandItem
                                key={company}
                                value={company}
                                className="text-xs"
                                onSelect={() => {
                                  setForm({
                                    ...form,
                                    companyName: company,
                                    truck: "none",
                                  });

                                  setOpenFormCompany(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    form.companyName === company
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />

                                {company}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}

              {/* EMPLOYEE COMPANY */}
              {form.role === "employee" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    Company
                  </label>

                  {isManager ? (
                    <input
                      value={currentUser?.companyName || ""}
                      disabled
                      className={`${inputClass} opacity-60`}
                    />
                  ) : (
                    <Popover
                      open={openFormCompany}
                      onOpenChange={setOpenFormCompany}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          role="combobox"
                          className="w-full h-11 rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring"
                        >
                          <span
                            className={`truncate ${
                              !form.companyName ? "text-muted-foreground" : ""
                            }`}
                          >
                            {form.companyName || "Select company..."}
                          </span>

                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>

                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0 z-[9999]"
                        align="start"
                      >
                        <Command>
                          <CommandInput
                            placeholder="Search company..."
                            className="text-xs"
                          />

                          <CommandEmpty className="text-xs">
                            No company found.
                          </CommandEmpty>

                          <CommandGroup>
                            {companyOptions.map((company) => (
                              <CommandItem
                                key={company}
                                value={company}
                                className="text-xs"
                                onSelect={() => {
                                  setForm({
                                    ...form,
                                    companyName: company,
                                    truck: "none",
                                  });

                                  setOpenFormCompany(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    form.companyName === company
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />

                                {company}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}

              {form.role !== "admin" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    Start Date <span className="text-red-500">*</span>
                  </label>

                  <Popover open={openStartDate} onOpenChange={setOpenStartDate}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`w-full h-11 rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring ${
                          !form.startDate ? "text-muted-foreground" : ""
                        }`}
                      >
                        <span>
                          {form.startDate
                            ? format(
                                new Date(`${form.startDate}T00:00:00`),
                                "MMM d, yyyy",
                              )
                            : "Select date"}
                        </span>

                        <CalendarDays className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>

                    <PopoverContent
                      className="w-auto p-0 z-[9999]"
                      align="start"
                    >
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
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    License Number <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    value={form.licenseNumber}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        licenseNumber: e.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Enter driver's license number"
                  />
                </div>
              )}

              {/* EMPLOYEE TRUCK */}
              {form.role === "employee" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    Assigned Truck <span className="text-red-500">*</span>
                  </label>

                  <Popover open={openFormTruck} onOpenChange={setOpenFormTruck}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        role="combobox"
                        disabled={isAdmin && !form.companyName}
                        className="w-full h-11 rounded-md border border-border bg-background px-3 text-xs flex items-center justify-between outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span
                          className={`truncate ${
                            form.truck === "none" ? "text-muted-foreground" : ""
                          }`}
                        >
                          {isAdmin && !form.companyName
                            ? "Select company first"
                            : truckSelectOptions.find(
                                (opt) => opt.value === form.truck,
                              )?.label || "Select truck..."}
                        </span>

                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>

                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0 z-[9999]"
                      align="start"
                    >
                      <Command>
                        <CommandInput
                          placeholder="Search truck..."
                          className="text-xs"
                        />

                        <CommandEmpty className="text-xs">
                          No truck found.
                        </CommandEmpty>

                        <CommandGroup>
                          {truckSelectOptions.map((opt) => (
                            <CommandItem
                              key={opt.value}
                              value={opt.label}
                              className="text-xs"
                              onSelect={() => {
                                setForm({
                                  ...form,
                                  truck: opt.value,
                                });

                                setOpenFormTruck(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  form.truck === opt.value
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />

                              {opt.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <button
                onClick={() => setModal(false)}
                className="px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Saving..." : editUser ? "Update" : "Create"}
              </button>
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
              <button
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                className="px-6 py-2.5 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
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
