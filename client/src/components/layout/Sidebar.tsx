import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
  Users,
  CreditCard,
  LogOut,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { cn } from "../../lib/utils";

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
          "fixed top-0 left-0 h-screen z-50 flex flex-col gap-4 p-4 border-r transition-all duration-300 ease-in-out",
          "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200/80 dark:border-slate-700/80",
          "shadow-[4px_0_20px_rgba(15,23,42,0.05)] dark:shadow-[4px_0_20px_rgba(0,0,0,0.2)]",
          "hidden lg:flex",
          sidebarCollapsed ? "lg:w-[56px] lg:px-1.5" : "lg:w-[260px]",
          isOpen && "!flex w-[280px]",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-700/60",
            sidebarCollapsed ? "flex-col" : "justify-between",
          )}
        >
          {isOpen && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl grid place-items-center font-black text-white bg-gradient-to-br from-blue-600 to-blue-700 shadow-md flex-shrink-0 text-sm">
                N
              </div>
              <div className="min-w-0">
                <div className="font-bold tracking-tight leading-none text-sm text-slate-900 dark:text-slate-100">
                  NEXTMILE
                </div>
                <div className="text-[0.65rem] text-slate-400 mt-0.5">
                  Trucking Services
                </div>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="hidden lg:grid w-9 h-9 rounded-xl place-items-center font-black text-white bg-gradient-to-br from-blue-600 to-blue-700 shadow-md text-sm">
              N
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className={cn(
              "hidden lg:grid w-8 h-8 rounded-lg place-items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0",
              sidebarCollapsed && "w-9 mt-1",
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
          <button
            onClick={toggleSidebar}
            className="lg:hidden w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 pt-0.5 flex-1 relative">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive =
              location.pathname === to ||
              (to === "/" && location.pathname === "/");

            return (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => {
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl font-medium text-sm transition-all duration-150 group z-10",
                  sidebarCollapsed ? "justify-center p-2" : "px-3 py-2.5",
                  isActive
                    ? "text-white"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-blue-600 rounded-xl shadow-md shadow-blue-600/20"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon
                  size={20}
                  strokeWidth={2}
                  className="flex-shrink-0 relative z-10"
                />
                {isOpen && <span className="relative z-10">{label}</span>}
                {sidebarCollapsed && (
                  <span className="hidden lg:block absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-[60]">
                    {label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div
          className={cn(
            "pt-3 border-t border-slate-200/60 dark:border-slate-700/60",
            sidebarCollapsed && "flex flex-col items-center",
          )}
        >
          <button
            onClick={toggleTheme}
            className={cn(
              "w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl shadow-sm flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors mb-3",
              sidebarCollapsed ? "justify-center p-2" : "px-3 py-2.5",
            )}
          >
            {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            {isOpen && (
              <span className="text-xs font-medium">
                {theme === "dark" ? "Dark" : "Light"} Mode
              </span>
            )}
          </button>

          {isOpen && user && (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user.displayName}
                </div>
                <div className="text-[0.65rem] text-slate-400 mt-0.5 flex items-center">
                  <span
                    className={cn(
                      "inline-block w-1.5 h-1.5 rounded-full mr-1.5 shadow-sm",
                      admin ? "bg-purple-500" : "bg-green-500",
                    )}
                  />
                  {admin ? "Admin" : "Driver"}
                </div>
              </div>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}

          {sidebarCollapsed && (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-9 h-9 rounded-lg grid place-items-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 10, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-red-500/10 text-red-500 grid place-items-center flex-shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Sign out?
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Are you sure you want to log out of your account?
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
