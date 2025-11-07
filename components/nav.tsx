"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Receipt, Target, FolderTree, Wallet, TrendingUp, FileText, Moon, Sun, User, Settings, LogOut, CreditCard, PiggyBank, Users, ChevronLeft, ChevronRight, HelpCircle, Shield, FileText as FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlanBadge } from "@/components/common/plan-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navSections = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    title: "Money Management",
    items: [
      { href: "/transactions", label: "Transactions", icon: Receipt },
      { href: "/budgets", label: "Budgets", icon: Target },
      { href: "/categories", label: "Categories", icon: FolderTree },
      { href: "/accounts", label: "Accounts", icon: Wallet },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/goals", label: "Goals", icon: PiggyBank },
      { href: "/debts", label: "Debts", icon: CreditCard },
      { href: "/investments", label: "Investments", icon: TrendingUp },
    ],
  },
];

interface UserData {
  user: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  } | null;
  plan: {
    name: "free" | "basic" | "premium";
  } | null;
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name[0].toUpperCase();
}

// Context for sidebar collapsed state
const SidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface NavProps {
  hasSubscription?: boolean;
}

export function Nav({ hasSubscription = true }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  console.log("[NAV] Render:", { hasSubscription, pathname });

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(isCollapsed));
    // Dispatch event for layout-wrapper to listen
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { isCollapsed } }));
  }, [isCollapsed]);

  // Fetch user data - always run hooks, but only fetch if hasSubscription
  useEffect(() => {
    console.log("[NAV] useEffect triggered:", { hasSubscription });
    if (!hasSubscription) {
      console.log("[NAV] No subscription, skipping user data fetch");
      setLoading(false);
      setUserData(null);
      return;
    }

    console.log("[NAV] Fetching user data");
    async function fetchUserData() {
      try {
        const { getUserClient } = await import("@/lib/api/user-client");
        const data = await getUserClient();
        console.log("[NAV] User data fetched:", data);
        setUserData(data);
      } catch (error) {
        console.error("[NAV] Error fetching user data:", error);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();

    // Listen for profile updates
    const handleProfileUpdate = () => {
      console.log("[NAV] Profile update event received");
      fetchUserData();
    };
    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, [hasSubscription]);

  // Don't render Nav if user doesn't have subscription
  // But all hooks must be called before this return
  if (!hasSubscription) {
    console.log("[NAV] Returning null (no subscription)");
    return null;
  }

  console.log("[NAV] Rendering nav component");

  const handleLogout = async () => {
    try {
      const { signOutClient } = await import("@/lib/api/auth-client");
      const result = await signOutClient();
      
      // Always redirect to login (even if there's an error)
      router.push("/auth/login");
      window.location.href = "/auth/login";
      
      if (result.error) {
        console.error("Failed to sign out:", result.error);
      }
    } catch (error) {
      console.error("Error signing out:", error);
      // Still redirect to login even if there's an error
      router.push("/auth/login");
      window.location.href = "/auth/login";
    }
  };

  const user = userData?.user;
  const plan = userData?.plan;

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <TooltipProvider>
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300 hidden md:block",
            isCollapsed ? "w-16" : "w-64"
          )}
        >
          <div className="flex h-full flex-col">
            <div
              className={cn(
                "flex h-16 items-center border-b px-4",
                isCollapsed ? "justify-center" : "justify-between"
              )}
            >
              {!isCollapsed && (
                <Link href="/" className="text-xl font-bold">
                  Spare Finance
                </Link>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={isCollapsed ? "right" : "bottom"}>
                  {isCollapsed ? "Expand menu" : "Collapse menu"}
                </TooltipContent>
              </Tooltip>
            </div>

            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
              {navSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  {!isCollapsed && (
                    <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {section.title}
                    </h3>
                  )}
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));
                    const linkElement = (
                      <Link
                        href={item.href}
                        onClick={(e) => {
                          if (!hasSubscription) {
                            e.preventDefault();
                            router.push("/select-plan");
                          }
                        }}
                        className={cn(
                          "flex items-center rounded-[12px] text-sm font-medium transition-all duration-200 ease-in-out",
                          !hasSubscription && "opacity-50 cursor-not-allowed",
                          isActive
                            ? "bg-primary text-primary-foreground translate-x-0"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-1 translate-x-0",
                          isCollapsed
                            ? "justify-center px-3 py-2"
                            : "space-x-3 px-3 py-2"
                        )}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    );

                    if (isCollapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                          <TooltipContent side="right">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return <div key={item.href}>{linkElement}</div>;
                  })}
                </div>
              ))}
            </nav>

            <div className="border-t p-3">
              {loading ? (
                <div
                  className={cn(
                    "flex items-center",
                    isCollapsed ? "justify-center" : "space-x-3 px-3 py-2"
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  {!isCollapsed && (
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-20 bg-muted rounded-[12px] animate-pulse" />
                      <div className="h-2 w-16 bg-muted rounded-[12px] animate-pulse" />
                    </div>
                  )}
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full h-auto p-2",
                        isCollapsed ? "justify-center" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center w-full",
                          isCollapsed ? "justify-center" : "space-x-3"
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          {user?.avatarUrl ? (
                            <>
                              <img
                                src={user.avatarUrl}
                                alt={user.name || "User"}
                                className="h-8 w-8 rounded-full object-cover border"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const initialsContainer =
                                    e.currentTarget.nextElementSibling;
                                  if (initialsContainer) {
                                    (initialsContainer as HTMLElement).style.display =
                                      "flex";
                                  }
                                }}
                              />
                              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground hidden items-center justify-center text-xs font-semibold border">
                                {getInitials(user?.name)}
                              </div>
                            </>
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold border">
                              {getInitials(user?.name)}
                            </div>
                          )}
                        </div>
                        {!isCollapsed && (
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-medium truncate">
                              {user?.name || "User"}
                            </div>
                            {plan && (
                              <div className="mt-0.5">
                                <PlanBadge
                                  plan={plan.name}
                                  className="text-[10px] px-1.5 py-0"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild className="mb-1">
                      <Link href="/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="mb-1">
                      <Link href="/help-support" className="cursor-pointer">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        <span>Help & Support</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="mb-1">
                      <Link href="/privacy-policy" className="cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Privacy Policy</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="mb-1">
                      <Link href="/terms-of-use" className="cursor-pointer">
                        <FileTextIcon className="mr-2 h-4 w-4" />
                        <span>Terms of Use</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        setTheme(theme === "dark" ? "light" : "dark")
                      }
                      className="mb-1"
                    >
                      <div className="relative mr-2 h-4 w-4">
                        <Sun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      </div>
                      <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive cursor-pointer"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </aside>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

