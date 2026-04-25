import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "../../store/useAppStore";
import { useAuthStore } from "../../store/useAuthStore";
import {
  LayoutDashboard,
  Route,
  HandCoins,
  BarChart3,
  Truck,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Users,
  CreditCard,
  LogOut,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const allNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", adminOnly: true },
  { to: "/trips", icon: Route, label: "Trips", adminOnly: false },
  { to: "/expenses", icon: HandCoins, label: "Expenses", adminOnly: true },
  { to: "/reports", icon: BarChart3, label: "Reports", adminOnly: true },
  { to: "/payments", icon: CreditCard, label: "Payments", adminOnly: true },
  { to: "/trucks", icon: Truck, label: "Trucks", adminOnly: true },
  { to: "/users", icon: Users, label: "Users", adminOnly: true },
  { to: "/settings", icon: Settings, label: "Settings", adminOnly: false },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useAppStore();
  const { user, logout, isAdmin } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isOpen = !sidebarCollapsed;

  const admin = isAdmin();
  const navItems = admin
    ? allNavItems
    : allNavItems.filter((item) => !item.adminOnly);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen z-50 flex flex-col",
          "bg-[#fcfcfc] dark:bg-zinc-900",
          "border-r border-zinc-200 dark:border-zinc-800",
          "hidden lg:flex",
          sidebarCollapsed ? "w-[64px]" : "w-[240px]",
        )}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-200 dark:border-zinc-800">
          {!sidebarCollapsed && (
            <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              NextmileOS
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="text-zinc-500"
          >
            {sidebarCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </Button>
        </div>

        {/* NAV */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive =
              location.pathname === to ||
              (to === "/" && location.pathname === "/");

            return (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={cn(
                  "flex items-center gap-3 rounded-md text-sm transition-colors",
                  sidebarCollapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {!sidebarCollapsed && <span>{label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* FOOTER */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-2 space-y-2">
          <Button
            variant="outline"
            size="lg"
            onClick={toggleTheme}
            className={cn(
              "w-full justify-start",
              sidebarCollapsed && "justify-center",
            )}
          >
            {theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}

            {!sidebarCollapsed && (
              <span className="ml-2">
                {theme === "dark" ? "Dark Mode" : "Light Mode"}
              </span>
            )}
          </Button>

          {!sidebarCollapsed && (
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 mb-2">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {user?.displayName || "—"}
              </div>
              <div className="text-xs text-zinc-500 capitalize">
                {user?.role || "—"}
              </div>
            </div>
          )}

          <Button
            variant="destructive"
            size="lg"
            onClick={() => setShowLogoutConfirm(true)}
            className={cn(
              "w-full justify-start text-red-500 hover:text-red-600",
              sidebarCollapsed && "justify-center",
            )}
          >
            <LogOut className="h-4 w-4" />

            {!sidebarCollapsed && <span className="ml-2">Logout</span>}
          </Button>
        </div>
      </aside>

      {/* LOGOUT MODAL */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowLogoutConfirm(false);
                handleLogout();
              }}
            >
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
