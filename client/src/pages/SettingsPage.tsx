import { useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import { User, Lock, Save, Building2 } from "lucide-react";
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
              <CardHeader>
                <CardTitle>Companies</CardTitle>

                <CardDescription>
                  Manage the companies available throughout the application.
                </CardDescription>
              </CardHeader>

              <Separator />

              <CardContent className="pt-6">
                <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
                  <Building2 className="mb-3 h-8 w-8 text-muted-foreground" />

                  <p className="text-sm font-medium">Company management</p>

                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Company management will be configured here next.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
