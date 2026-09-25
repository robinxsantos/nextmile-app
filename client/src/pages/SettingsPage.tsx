import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import {
  User,
  Lock,
  Save,
  Building2,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CompanyRow {
  _id: string;
  companyName: string;
  status: "Active" | "Inactive";
  createdAt: string;
}

export default function SettingsPage() {
  const { user, checkAuth } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const roleLabel =
    user?.role === "admin"
      ? "Admin"
      : user?.role === "manager"
        ? "Manager"
        : "Employee";

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyStatus, setCompanyStatus] = useState<"Active" | "Inactive">(
    "Active",
  );
  const [savingCompany, setSavingCompany] = useState(false);
  const [deleteCompany, setDeleteCompany] = useState<CompanyRow | null>(null);
  const [deletingCompany, setDeletingCompany] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    setSavingProfile(true);
    try {
      await api.put("/auth/profile", { displayName: displayName.trim() });
      await checkAuth(); // refresh user data
      toast.success("Profile updated!");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to update profile";
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      toast.error("New password must be at least 4 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      toast.success("Password changed!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to change password";
      toast.error(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const fetchCompanies = async () => {
    if (!isAdmin) return;

    setLoadingCompanies(true);

    try {
      const { data } = await api.get("/companies");
      setCompanies(data.rows || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load companies";

      toast.error(msg);
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchCompanies();
    }
  }, [isAdmin]);

  const openAddCompany = () => {
    setEditingCompany(null);
    setCompanyName("");
    setCompanyStatus("Active");
    setCompanyModal(true);
  };

  const openEditCompany = (company: CompanyRow) => {
    setEditingCompany(company);
    setCompanyName(company.companyName);
    setCompanyStatus(company.status);
    setCompanyModal(true);
  };

  const handleSaveCompany = async () => {
    if (!companyName.trim()) {
      toast.error("Company name is required.");
      return;
    }

    setSavingCompany(true);

    try {
      const payload = {
        companyName: companyName.trim(),
        status: companyStatus,
      };

      if (editingCompany) {
        await api.put(`/companies/${editingCompany._id}`, payload);

        toast.success("Company updated");
      } else {
        await api.post("/companies", payload);
        toast.success("Company created");
      }

      setCompanyModal(false);
      await fetchCompanies();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to save company";

      toast.error(msg);
    } finally {
      setSavingCompany(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deleteCompany) return;

    setDeletingCompany(true);

    try {
      await api.delete(`/companies/${deleteCompany._id}`);

      toast.success("Company deleted");
      setDeleteCompany(null);

      await fetchCompanies();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to delete company";

      toast.error(msg);
    } finally {
      setDeletingCompany(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and application settings.
        </p>
      </div>

      <Separator />

      <Tabs defaultValue="profile" className="space-y-5">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>

          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>

          {isAdmin && (
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="h-4 w-4" />
              Companies
            </TabsTrigger>
          )}
        </TabsList>

        {/* PROFILE */}
        <TabsContent value="profile">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Profile</CardTitle>

              <CardDescription>
                Manage your personal account information.
              </CardDescription>
            </CardHeader>

            <Separator />

            <form onSubmit={handleUpdateProfile}>
              <CardContent className="space-y-5 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>

                  <Input id="username" value={user?.username || ""} disabled />

                  <p className="text-xs text-muted-foreground">
                    Your username cannot be changed.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="displayName">Display Name</Label>

                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>

                  <Input id="role" value={roleLabel} disabled />
                </div>

                {user?.companyName && (
                  <div className="grid gap-2">
                    <Label htmlFor="company">Company</Label>

                    <Input id="company" value={user.companyName} disabled />
                  </div>
                )}
              </CardContent>

              <CardFooter className="justify-end border-t px-6 py-4">
                <Button type="submit" disabled={savingProfile}>
                  <Save className="mr-2 h-4 w-4" />

                  {savingProfile ? "Saving..." : "Save changes"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* SECURITY */}
        <TabsContent value="security">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Security</CardTitle>

              <CardDescription>
                Update the password used to sign in to your account.
              </CardDescription>
            </CardHeader>

            <Separator />

            <form onSubmit={handleChangePassword}>
              <CardContent className="space-y-5 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="currentPassword">Current Password</Label>

                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="newPassword">New Password</Label>

                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />

                  <p className="text-xs text-muted-foreground">
                    Password must be at least 4 characters.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>

                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                </div>
              </CardContent>

              <CardFooter className="justify-end border-t px-6 py-4">
                <Button type="submit" disabled={savingPassword}>
                  <Lock className="mr-2 h-4 w-4" />

                  {savingPassword ? "Changing..." : "Change password"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* COMPANIES — ADMIN ONLY */}
        {isAdmin && (
          <TabsContent value="companies">
            <Card className="max-w-3xl">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Companies</CardTitle>

                  <CardDescription className="mt-1">
                    Manage the companies available throughout the application.
                  </CardDescription>
                </div>

                <Button
                  type="button"
                  onClick={openAddCompany}
                  className="shrink-0"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add company
                </Button>
              </CardHeader>

              <Separator />

              <CardContent className="py-6">
                {loadingCompanies ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Loading companies...
                  </div>
                ) : companies.length === 0 ? (
                  <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
                    <Building2 className="mb-3 h-8 w-8 text-muted-foreground" />

                    <p className="text-sm font-medium">No companies yet</p>

                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Add your first company to start assigning trucks and
                      users.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-md border">
                    {companies.map((company, index) => (
                      <div
                        key={company._id}
                        className={`flex items-center justify-between gap-4 px-4 py-3 ${
                          index !== companies.length - 1 ? "border-b" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {company.companyName}
                          </div>

                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Added{" "}
                            {new Date(company.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`inline-flex min-w-[70px] justify-center px-2.5 py-1 text-xs font-medium ${
                              company.status === "Active"
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {company.status}
                          </span>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => openEditCompany(company)}
                            title="Edit company"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setDeleteCompany(company)}
                            title="Delete company"
                            className="hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      {/* ADD / EDIT COMPANY */}
      <Dialog
        open={companyModal}
        onOpenChange={(open) => {
          if (!savingCompany) {
            setCompanyModal(open);

            if (!open) {
              setEditingCompany(null);
              setCompanyName("");
              setCompanyStatus("Active");
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Edit company" : "Add company"}
            </DialogTitle>

            <DialogDescription>
              {editingCompany
                ? "Update the company name or status."
                : "Create a company that can be assigned to trucks and users."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="companyName">Company Name</Label>

              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. StarTrak Trucking Services"
                disabled={savingCompany}
              />
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>

              <Select
                value={companyStatus}
                onValueChange={(value) =>
                  setCompanyStatus(value as "Active" | "Inactive")
                }
                disabled={savingCompany}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>

                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingCompany}
              onClick={() => setCompanyModal(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={savingCompany || !companyName.trim()}
              onClick={handleSaveCompany}
            >
              {savingCompany
                ? "Saving..."
                : editingCompany
                  ? "Save changes"
                  : "Create company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* DELETE COMPANY */}
      <Dialog
        open={!!deleteCompany}
        onOpenChange={(open) => {
          if (!open && !deletingCompany) {
            setDeleteCompany(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete company?</DialogTitle>

            <DialogDescription>
              This will permanently remove the company from the company list.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">{deleteCompany?.companyName}</p>
          </div>

          <p className="text-sm text-muted-foreground">
            A company cannot be deleted while it is still assigned to a truck or
            user.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletingCompany}
              onClick={() => setDeleteCompany(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={deletingCompany}
              onClick={handleDeleteCompany}
            >
              {deletingCompany ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
