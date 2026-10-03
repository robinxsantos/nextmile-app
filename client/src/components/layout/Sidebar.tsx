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
  Sun,
  Moon,
  Users,
  CreditCard,
  WalletCards,
  LogOut,
  Settings,
  ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import LogoLight from "../../assets/logo-light.png";
import LogoDark from "../../assets/logo-dark.png";
import LogoSquareLight from "../../assets/1x1-light.png";
import LogoSquareDark from "../../assets/1x1-dark.png";

type UserRole = "admin" | "manager" | "employee";

type NavSection = "main" | "operations" | "finance" | "administration";

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  roles: UserRole[];
  section: NavSection;
};

const allNavItems: NavItem[] = [
  {
    to: "/",
    icon: LayoutDashboard,
    label: "Overview",
    roles: ["admin", "manager"],
    section: "main",
  },
  {
    to: "/trips",
    icon: Route,
    label: "Trips",
    roles: ["admin", "manager", "employee"],
    section: "operations",
  },
  {
    to: "/expenses",
    icon: HandCoins,
    label: "Expenses",
    roles: ["admin", "manager"],
    section: "operations",
  },
  {
    to: "/payments",
    icon: CreditCard,
    label: "Payments",
    roles: ["admin", "manager"],
    section: "finance",
  },
  {
    to: "/collections",
    icon: WalletCards,
    label: "Collections",
    roles: ["admin", "manager"],
    section: "finance",
  },
  {
    to: "/reports",
    icon: BarChart3,
    label: "Reports",
    roles: ["admin", "manager"],
    section: "finance",
  },
  {
    to: "/trucks",
    icon: Truck,
    label: "Fleet",
    roles: ["admin", "manager"],
    section: "administration",
  },
  {
    to: "/users",
    icon: Users,
    label: "Users",
    roles: ["admin", "manager"],
    section: "administration",
  },
  {
    to: "/settings",
    icon: Settings,
    label: "Settings",
    roles: ["admin", "manager", "employee"],
    section: "administration",
  },
];

const navSections = [
  {
    key: "main" as const,
    label: "",
  },
  {
    key: "operations" as const,
    label: "Operations",
  },
  {
    key: "finance" as const,
    label: "Finance",
  },
  {
    key: "administration" as const,
    label: "Administration",
  },
];

export default function Sidebar() {
  const { theme, toggleTheme } = useAppStore();
  const { user, logout } = useAuthStore();

  const location = useLocation();
  const navigate = useNavigate();

  const [logoutOpen, setLogoutOpen] = useState(false);

  const navItems = allNavItems.filter((item) =>
    user ? item.roles.includes(user.role) : false,
  );

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: navItems.filter((item) => item.section === section.key),
    }))
    .filter((section) => section.items.length > 0);

  const handleLogout = () => {
    setLogoutOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  const displayName = user?.displayName || "User";
  const role = user?.role || "";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <>
      <ShadcnSidebar collapsible="icon">
        {/* HEADER */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="hover:bg-transparent active:bg-transparent"
              >
                <div className="flex min-w-0 flex-1 items-center group-data-[collapsible=icon]:justify-center">
                  <img
                    src={LogoLight}
                    alt="Nextmile"
                    className="h-9 w-auto group-data-[collapsible=icon]:hidden dark:hidden"
                  />

                  <img
                    src={LogoDark}
                    alt="Nextmile"
                    className="hidden h-9 w-auto group-data-[collapsible=icon]:hidden dark:block"
                  />

                  <img
                    src={LogoSquareLight}
                    alt="Nextmile"
                    className="hidden size-6 object-contain group-data-[collapsible=icon]:block dark:group-data-[collapsible=icon]:hidden"
                  />

                  <img
                    src={LogoSquareDark}
                    alt="Nextmile"
                    className="hidden size-6 object-contain dark:group-data-[collapsible=icon]:block"
                  />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* NAVIGATION */}
        <SidebarContent>
          {visibleSections.map((section) => (
            <SidebarGroup key={section.key} className="py-1.5">
              {section.label && (
                <SidebarGroupLabel className="text-sm font-medium text-sidebar-foreground">
                  {section.label}
                </SidebarGroupLabel>
              )}

              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map(({ to, icon: Icon, label }) => {
                    const isActive = location.pathname === to;

                    return (
                      <SidebarMenuItem key={to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={label}
                        >
                          <NavLink to={to} end={to === "/"}>
                            <Icon />
                            <span>{label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* FOOTER */}
        <SidebarFooter>
          <SidebarMenu>
            {/* THEME */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={toggleTheme}
                tooltip={theme === "dark" ? "Dark Mode" : "Light Mode"}
                className="cursor-pointer"
              >
                {theme === "dark" ? <Moon /> : <Sun />}

                <span className="group-data-[collapsible=icon]:hidden">
                  {theme === "dark" ? "Dark Mode" : "Light Mode"}
                </span>

                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={toggleTheme}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Toggle dark mode"
                  className="ml-auto group-data-[collapsible=icon]:hidden"
                />
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* USER */}
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex h-12 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg text-xs">
                      {initials || "U"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">{displayName}</span>

                    <span className="truncate text-xs capitalize text-muted-foreground">
                      {role}
                    </span>
                  </div>

                  <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="min-w-56"
                  side="right"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <Avatar className="size-8 rounded-lg">
                        <AvatarFallback className="rounded-lg text-xs">
                          {initials || "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">
                          {displayName}
                        </span>

                        <span className="truncate text-xs capitalize text-muted-foreground">
                          {role}
                        </span>

                        {user?.companyName && (
                          <span className="truncate text-xs text-muted-foreground">
                            {user.companyName}
                          </span>
                        )}
                      </div>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setLogoutOpen(true)}
                    >
                      <LogOut />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </ShadcnSidebar>

      {/* SIGN OUT CONFIRMATION */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Sign out?</AlertDialogTitle>

            <AlertDialogDescription>
              Are you sure you want to sign out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction variant="destructive" onClick={handleLogout}>
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
