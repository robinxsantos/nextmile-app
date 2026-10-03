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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
import { Badge } from "@/components/ui/badge";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const [companyDateSort, setCompanyDateSort] = useState<"asc" | "desc" | null>(
    null,
  );
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

  const sortedCompanies = [...companies].sort((a, b) => {
    if (!companyDateSort) return 0;

    const result =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    return companyDateSort === "asc" ? result : -result;
  });

  const toggleCompanyDateSort = () => {
    setCompanyDateSort((current) => {
      if (!current) return "asc";
      if (current === "asc") return "desc";
      return null;
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="profile" className="space-y-5">
        <div className="flex justify-center">
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
        </div>

        {/* PROFILE */}
        <TabsContent value="profile">
          <Card size="sm" className="mx-auto max-w-3xl !gap-0 overflow-hidden">
            <CardHeader className="border-b">
              <div>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Manage your personal account information.
                </CardDescription>
              </div>
            </CardHeader>

            <form onSubmit={handleUpdateProfile}>
              <CardContent className="space-y-5 py-5">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>

                  <Input id="username" value={user?.username || ""} disabled />

                  <p className="text-xs text-muted-foreground">
                    Your username cannot be changed.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="displayName">
                    Display Name <span className="text-destructive">*</span>
                  </Label>

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
                  <Save data-icon="inline-start" />
                  {savingProfile ? "Saving..." : "Save changes"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* SECURITY */}
        <TabsContent value="security">
          <Card size="sm" className="mx-auto max-w-3xl !gap-0 overflow-hidden">
            <CardHeader className="border-b">
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Update the password used to sign in to your account.
                </CardDescription>
              </div>
            </CardHeader>

            <form onSubmit={handleChangePassword}>
              <CardContent className="space-y-5 py-5">
                <div className="grid gap-2">
                  <Label htmlFor="currentPassword">
                    Current Password <span className="text-destructive">*</span>
                  </Label>

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
                  <Label htmlFor="newPassword">
                    New Password <span className="text-destructive">*</span>
                  </Label>

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
                  <Label htmlFor="confirmPassword">
                    Confirm New Password{" "}
                    <span className="text-destructive">*</span>
                  </Label>

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
                  <Lock data-icon="inline-start" />
                  {savingPassword ? "Changing..." : "Change password"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* COMPANIES — ADMIN ONLY */}
        {isAdmin && (
          <TabsContent value="companies">
            <Card
              size="sm"
              className="mx-auto max-w-3xl !gap-0 overflow-hidden"
            >
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
                <div>
                  <CardTitle>Companies</CardTitle>

                  <CardDescription>
                    Manage the companies available throughout the application.
                  </CardDescription>
                </div>

                <Button
                  type="button"
                  onClick={openAddCompany}
                  className="shrink-0"
                >
                  <Plus data-icon="inline-start" />
                  Add company
                </Button>
              </CardHeader>

              {loadingCompanies ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Loading companies...
                </div>
              ) : companies.length === 0 ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
                  <Building2 className="mb-3 h-8 w-8 text-muted-foreground" />

                  <p className="text-sm font-medium">No companies yet</p>

                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Add your first company to start assigning trucks and users.
                  </p>
                </div>
              ) : (
                <div className="[&>div]:max-h-[calc(100vh-320px)] [&>div]:overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="sticky top-0 z-20 bg-background hover:bg-background">
                        <TableHead className="pl-4 text-xs">Company</TableHead>

                        <TableHead className="text-xs">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="-ml-2 h-8 gap-1.5 px-2 text-xs font-medium"
                            onClick={toggleCompanyDateSort}
                          >
                            Date Added
                            {companyDateSort === "asc" ? (
                              <ArrowUp className="size-3.5" />
                            ) : companyDateSort === "desc" ? (
                              <ArrowDown className="size-3.5" />
                            ) : (
                              <ArrowUpDown className="size-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        </TableHead>

                        <TableHead className="w-[100px] text-center text-xs">
                          Status
                        </TableHead>

                        <TableHead className="w-[100px] text-center text-xs">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {sortedCompanies.map((company) => (
                        <TableRow key={company._id}>
                          <TableCell className="pl-4 text-xs font-medium">
                            {company.companyName}
                          </TableCell>

                          <TableCell className="whitespace-nowrap text-xs">
                            {new Date(company.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </TableCell>

                          <TableCell className="text-center text-xs">
                            <Badge
                              variant="secondary"
                              className={
                                company.status === "Active"
                                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                  : "text-muted-foreground"
                              }
                            >
                              {company.status}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={() => openEditCompany(company)}
                                aria-label="Edit company"
                              >
                                <Pencil />
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={() => setDeleteCompany(company)}
                                aria-label="Delete company"
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
              {editingCompany ? "Edit Company" : "Add Company"}
            </DialogTitle>

            <DialogDescription>
              {editingCompany
                ? "Update the company name or status."
                : "Create a company that can be assigned to trucks and users."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="companyName">
                Company Name <span className="text-destructive">*</span>
              </Label>

              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Nextmile Trucking Services"
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
