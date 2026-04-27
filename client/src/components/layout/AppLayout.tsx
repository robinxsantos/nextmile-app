import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./Sidebar";
import { useAppStore } from "../../store/useAppStore";
import { cn } from "../../lib/utils";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import KeyboardShortcutsHelp from "../shared/KeyboardShortcutsHelp";

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/trips": "Trips",
  "/expenses": "Expenses",
  "/reports": "Reports",
  "/trucks": "Trucks",
};

export default function AppLayout() {
  const { sidebarCollapsed, theme, toggleSidebar } = useAppStore();
  const location = useLocation();
  const currentPageName = pageNames[location.pathname] || "Dashboard";
  const [openMobile, setOpenMobile] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Mobile overlay */}
      {/* Mobile overlay */}
      {openMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setOpenMobile(false)}
        />
      )}

      <Sidebar openMobile={openMobile} setOpenMobile={setOpenMobile} />

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3 bg-background border-b border-slate-200/80 dark:border-slate-700/90">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpenMobile(true)}
          className="rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-slate-200"
        >
          <Menu size={20} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg grid place-items-center font-black bg-primary text-primary-foreground text-sm">
            N
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-xs leading-none">
              NextmileOS
            </span>
            <span className="text-[0.65rem] text-slate-500 dark:text-slate-400 leading-none mt-0.5">
              {currentPageName}
            </span>
          </div>
        </div>
      </div>

      <main
        className={cn(
          "relative min-h-screen transition-all duration-300 ease-in-out p-4 lg:p-5",
          // Mobile: no offset, add top padding for mobile header
          "ml-0 pt-[72px] lg:pt-5",
          // Desktop: offset by sidebar width (ternary to avoid class conflict)
          sidebarCollapsed ? "lg:ml-[56px]" : "lg:ml-[260px]",
        )}
      >
        <div className="max-w-[1600px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <KeyboardShortcutsHelp />
    </div>
  );
}
