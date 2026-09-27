import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./Sidebar";
import { useAppStore } from "../../store/useAppStore";
import { useAuthStore } from "../../store/useAuthStore";
import { cn } from "../../lib/utils";
import { Menu, ChevronsUpDown, Check, Truck } from "lucide-react";
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
import { Button } from "@/components/ui/button";

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/trips": "Trips",
  "/expenses": "Expenses",
  "/payments": "Payments",
  "/collections": "Collections",
  "/reports": "Reports",
  "/trucks": "Trucks",
  "/users": "Users",
  "/settings": "Settings",
};

export default function AppLayout() {
  const {
    sidebarCollapsed,
    theme,
    selectedTruck,
    setSelectedTruck,
    truckOptions,
  } = useAppStore();
  const { user } = useAuthStore();

  const canSwitchTruck = user?.role === "admin" || user?.role === "manager";

  const location = useLocation();
  const currentPageName = pageNames[location.pathname] || "Dashboard";
  const [openMobile, setOpenMobile] = useState(false);
  const [openTruckSelector, setOpenTruckSelector] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="min-h-screen bg-[#fcfcfc] dark:bg-zinc-900 text-foreground transition-colors duration-200">
      {/* Mobile overlay */}
      {/* Mobile overlay */}
      {openMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setOpenMobile(false)}
        />
      )}

      <Sidebar openMobile={openMobile} setOpenMobile={setOpenMobile} />

      {/* DESKTOP TOP BAR */}
      <header
        className={cn(
          "hidden lg:grid fixed top-0 right-0 z-40 h-14",
          "grid-cols-[1fr_auto_1fr] items-center",
          "border-b border-border bg-[#fcfcfc] dark:bg-zinc-900",
          "transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "left-[64px]" : "left-[240px]",
        )}
      >
        {/* LEFT: TRUCK CONTEXT */}
        <div className="flex h-full items-center px-4">
          {canSwitchTruck ? (
            <Popover
              open={openTruckSelector}
              onOpenChange={setOpenTruckSelector}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  className="inline-flex h-9 max-w-[260px] items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <Truck className="h-4 w-4 shrink-0" />

                  <span className="truncate">
                    {truckOptions.find((truck) => truck._id === selectedTruck)
                      ?.truckName || "All Trucks"}
                  </span>

                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-[260px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Find truck..."
                    className="text-xs"
                  />

                  <CommandEmpty className="text-xs">
                    No truck found.
                  </CommandEmpty>

                  <CommandGroup>
                    <CommandItem
                      value="All Trucks"
                      className="text-xs"
                      onSelect={() => {
                        setSelectedTruck("");
                        setOpenTruckSelector(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          !selectedTruck ? "opacity-100" : "opacity-0",
                        )}
                      />
                      All Trucks
                    </CommandItem>

                    {truckOptions.map((truck) => (
                      <CommandItem
                        key={truck._id}
                        value={truck.truckName}
                        className="text-xs"
                        onSelect={() => {
                          setSelectedTruck(truck._id);
                          setOpenTruckSelector(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTruck === truck._id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />

                        {truck.truckName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="inline-flex h-9 max-w-[260px] items-center gap-2 px-2 text-sm font-medium">
              <Truck className="h-4 w-4 shrink-0" />

              <span className="truncate">
                {truckOptions.find((truck) => truck._id === selectedTruck)
                  ?.truckName || "Assigned Truck"}
              </span>
            </div>
          )}
        </div>

        {/* CENTER: PAGE TITLE */}
        <div className="text-sm font-normal text-foreground">
          {currentPageName}
        </div>

        {/* RIGHT: CURRENT DATE */}
        <div className="flex h-full items-center justify-end px-4">
          <span className="text-sm font-normal text-muted-foreground">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </span>
        </div>
      </header>

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
            <span className="font-bold text-xs leading-none">NextmileOS</span>
            <span className="text-[0.65rem] text-slate-500 dark:text-slate-400 leading-none mt-0.5">
              {currentPageName}
            </span>
          </div>
        </div>
      </div>

      <main
        className={cn(
          "relative min-h-screen bg-[#fcfcfc] dark:bg-zinc-900 transition-all duration-300 ease-in-out p-4 lg:p-5",
          // Mobile: no offset, add top padding for mobile header
          "ml-0 pt-[72px] lg:pt-[76px]",
          // Desktop: offset by sidebar width (ternary to avoid class conflict)
          sidebarCollapsed ? "lg:ml-[64px]" : "lg:ml-[240px]",
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
    </div>
  );
}
