import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { useAppStore } from "../../store/useAppStore";
import { useAuthStore } from "../../store/useAuthStore";
import { Check, ChevronsUpDown, Truck } from "lucide-react";
import { cn } from "../../lib/utils";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  CommandList,
} from "@/components/ui/command";

const pageNames: Record<string, string> = {
  "/": "Overview",
  "/trips": "Trips",
  "/expenses": "Expenses",
  "/payments": "Payments",
  "/collections": "Collections",
  "/reports": "Reports",
  "/trucks": "Fleet Management",
  "/users": "User Management",
  "/settings": "Settings",
};

export default function AppLayout() {
  const { theme, selectedTruck, setSelectedTruck, truckOptions } =
    useAppStore();

  const { user } = useAuthStore();

  const location = useLocation();

  const currentPageName = pageNames[location.pathname] || "Dashboard";

  const canSwitchTruck = user?.role === "admin" || user?.role === "manager";
  const [openTruckSelector, setOpenTruckSelector] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const selectedTruckOption = truckOptions.find(
    (truck) => truck._id === selectedTruck,
  );

  const selectedTruckName = selectedTruckOption?.truckName || "All Trucks";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar />

        <SidebarInset>
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            {/* LEFT */}
            <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />

              <Separator
                orientation="vertical"
                className="data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              />

              {canSwitchTruck ? (
                <div className="flex items-center gap-2">
                  <Popover
                    open={openTruckSelector}
                    onOpenChange={setOpenTruckSelector}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        role="combobox"
                        aria-expanded={openTruckSelector}
                        className="max-w-[220px] justify-between"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Truck className="size-4 shrink-0" />

                          <span className="truncate">{selectedTruckName}</span>
                        </span>

                        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-[260px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Find truck..." />

                        <CommandList>
                          <CommandEmpty>No truck found.</CommandEmpty>

                          <CommandGroup>
                            <CommandItem
                              value="All Trucks"
                              onSelect={() => {
                                setSelectedTruck("");
                                setOpenTruckSelector(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "size-4",
                                  !selectedTruck ? "opacity-100" : "opacity-0",
                                )}
                              />

                              <span>All Trucks</span>
                            </CommandItem>

                            {truckOptions.map((truck) => (
                              <CommandItem
                                key={truck._id}
                                value={truck.truckName}
                                onSelect={() => {
                                  setSelectedTruck(truck._id);
                                  setOpenTruckSelector(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "size-4 shrink-0",
                                    selectedTruck === truck._id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium">
                                    {truck.truckName}
                                  </div>

                                  {truck.billingType && (
                                    <div className="truncate text-xs text-muted-foreground">
                                      {truck.billingType === "direct"
                                        ? "Direct Client"
                                        : "Subcontracted"}
                                    </div>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {selectedTruckOption?.billingType && (
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {selectedTruckOption.billingType === "direct"
                        ? "Direct Client"
                        : "Subcontracted"}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2 px-2 text-sm font-medium">
                  <Truck className="size-4 shrink-0" />

                  <span className="truncate">
                    {selectedTruckOption?.truckName || "Assigned Truck"}
                  </span>

                  {selectedTruckOption?.billingType && (
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {selectedTruckOption.billingType === "direct"
                        ? "Direct Client"
                        : "Subcontracted"}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* CENTER */}
            <div className="hidden shrink-0 text-sm font-medium md:block">
              {currentPageName}
            </div>

            {/* RIGHT */}
            <div className="flex flex-1 items-center justify-end px-4">
              <span className="hidden truncate text-sm font-medium sm:block">
                {user?.companyName || ""}
              </span>
            </div>
          </header>

          <main className="flex flex-1 flex-col p-4">
            <div className="mx-auto w-full max-w-[1600px]">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
