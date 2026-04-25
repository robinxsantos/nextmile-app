import { useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import { User, Lock, Save } from "lucide-react";

export default function SettingsPage() {
  const { user, checkAuth } = useAuthStore();

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

  const inputClass =
    "w-full h-11 rounded-md border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:border-ring outline-none transition-colors";

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-[1.45rem] font-bold tracking-tight">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Update your profile and change your password.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[0.72rem] font-bold tracking-wider uppercase text-muted-foreground">
              Account
            </div>
            <div className="font-bold text-sm">@{user?.username}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-stretch">
        {/* Profile Section */}
        <div className="border rounded-lg bg-background p-5 flex flex-col h-full">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-md bg-blue-600/10 dark:bg-blue-500/15 grid place-items-center text-blue-600 dark:text-blue-400">
              <User size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Profile</h2>
              <p className="text-xs text-slate-500">Update your display name</p>
            </div>
          </div>

          <form
            onSubmit={handleUpdateProfile}
            className="flex flex-col gap-4 flex-1"
          >
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Username
              </label>
              <input
                type="text"
                value={user?.username || ""}
                disabled
                className={inputClass + " opacity-50 cursor-not-allowed"}
              />
              <p className="text-[0.65rem] text-slate-400 mt-1">
                Username cannot be changed
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Role
              </label>
              <input
                type="text"
                value={user?.role === "admin" ? "Admin" : "Driver"}
                disabled
                className={inputClass + " opacity-50 cursor-not-allowed"}
              />
            </div>
            <div className="flex-1" />
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full min-h-[44px] rounded-md bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-[0_10px_20px_rgba(37,99,235,0.18)] hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <Save size={16} />{" "}
              {savingProfile ? "Saving..." : "Update Profile"}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="border rounded-lg bg-background p-5 flex flex-col h-full">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-md bg-amber-500/10 grid place-items-center text-amber-600 dark:text-amber-400">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Change Password
              </h2>
              <p className="text-xs text-muted-foreground">
                Update your login credentials
              </p>
            </div>
          </div>

          <form
            onSubmit={handleChangePassword}
            className="flex flex-col gap-4 flex-1"
          >
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter new password"
              />
            </div>
            <div className="flex-1" />
            <button
              type="submit"
              disabled={savingPassword}
              className="w-full min-h-[44px] rounded-md bg-gradient-to-br from-amber-500 to-amber-600 text-white text-sm font-semibold shadow-[0_10px_20px_rgba(245,158,11,0.18)] hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <Lock size={16} />{" "}
              {savingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
