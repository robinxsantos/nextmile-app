import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { useAppStore } from "../store/useAppStore";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Shield,
  Truck as TruckIcon,
} from "lucide-react";
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

interface UserRow {
  _id: string;
  username: string;
  displayName: string;
  role: string;
  truckName: string;
  truck: string | { _id: string; truckName: string } | null;
  active: boolean;
}

export default function UsersPage() {
  const { truckOptions, initApp } = useAppStore();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<UserRow | null>(null);

  const [form, setForm] = useState({
    username: "",
    password: "",
    displayName: "",
    role: "employee",
    truck: "none",
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

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAdd = () => {
    setEditUser(null);
    setForm({
      username: "",
      password: "",
      displayName: "",
      role: "employee",
      truck: "",
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
      truck: truckId,
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

    setLoading(true);
    try {
      if (editUser) {
        const payload: Record<string, unknown> = {
          displayName: form.displayName,
          role: form.role,
          truck: form.truck || null,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editUser._id}`, payload);
        toast.success("User updated");
      } else {
        await api.post("/users", {
          username: form.username,
          password: form.password,
          displayName: form.displayName,
          role: form.role,
          truck: form.truck || null,
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
    "w-full min-h-[44px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors";

  const roleOptions = [
    { value: "admin", label: "🛡️ Admin" },
    { value: "employee", label: "🚛 Driver" },
  ];

  const truckSelectOptions = [
    { value: "none", label: "No assigned truck" },
    ...truckOptions.map((t) => ({
      value: t._id,
      label: t.truckName,
    })),
  ];

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-[1.45rem] font-bold tracking-tight">
              User Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Create and manage employee accounts.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="h-10 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
          >
            <Plus size={18} /> Add User
          </button>
        </div>
      </div>

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
                  "Assigned Truck",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 bg-muted/40 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-semibold text-muted-foreground px-3 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <Users size={40} className="mx-auto mb-3 opacity-30" />
                    <div className="font-semibold">No users found</div>
                    <div className="text-sm">
                      Create your first user account
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u._id}
                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50"
                  >
                    <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 font-mono font-semibold">
                      {u.username}
                    </td>
                    <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 font-semibold">
                      {u.displayName}
                    </td>
                    <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[0.72rem] font-bold ${u.role === "admin" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}
                      >
                        <Shield size={12} /> {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
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
                    <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[0.65rem] font-bold ${u.active ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}
                      >
                        {u.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="text-center text-xs px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="flex flex-col gap-3 md:hidden p-3">
          {users.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <div className="font-semibold">No users found</div>
            </div>
          ) : (
            users.map((u) => (
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.72rem] font-bold ${u.role === "admin" ? "bg-purple-500/10 text-purple-600" : "bg-blue-500/10 text-blue-600"}`}
                  >
                    <Shield size={12} /> {u.role.toUpperCase()}
                  </span>
                </div>
                {u.truckName && (
                  <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <TruckIcon size={12} /> {u.truckName}
                  </div>
                )}
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

              <div className="col-span-2">
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
                <UiSelect
                  value={form.role}
                  onValueChange={(val) => setForm({ ...form, role: val })}
                >
                  <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent className="z-[9999]">
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </UiSelect>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Assigned Truck
                </label>
                <UiSelect
                  value={form.truck}
                  onValueChange={(val) => setForm({ ...form, truck: val })}
                >
                  <SelectTrigger className="w-full min-h-[44px] px-3.5 text-sm">
                    <SelectValue placeholder="Select truck..." />
                  </SelectTrigger>

                  <SelectContent className="z-[9999]">
                    {truckSelectOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </UiSelect>
              </div>
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
