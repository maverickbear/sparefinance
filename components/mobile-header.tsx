"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, LayoutDashboard, Receipt, Target, FolderTree, TrendingUp, FileText, Moon, Sun, Settings, LogOut, CreditCard, PiggyBank, Users, HelpCircle, Shield, FileText as FileTextIcon, Settings2, MessageSquare, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/common/logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logger } from "@/lib/utils/logger";

// Base nav sections (without Portal Management)
const baseNavSections = [
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
      { href: "/categories", label: "Categories", icon: FolderTree },
      { href: "/accounts", label: "Accounts", icon: Wallet },
      { href: "/members", label: "Households", icon: Users },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/planning/budgets", label: "Budgets", icon: Target },
      { href: "/planning/goals", label: "Goals", icon: PiggyBank },
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
  subscription?: {
    status: "active" | "trialing" | "cancelled" | "past_due";
    trialEndDate?: string | null;
    trialStartDate?: string | null;
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

// Use shared cache from nav.tsx if available, otherwise create new one
const getNavUserDataCache = () => {
  if (typeof window !== 'undefined' && (window as any).navUserDataCache) {
    return (window as any).navUserDataCache;
  }
  
  const cache = {
    data: null as UserData | null,
    promise: null as Promise<UserData> | null,
    timestamp: 0,
    TTL: 5 * 60 * 1000, // 5 minutes cache
    role: null as "admin" | "member" | "super_admin" | null,
    roleTimestamp: 0,
  };
  
  if (typeof window !== 'undefined') {
    (window as any).navUserDataCache = cache;
  }
  
  return cache;
};

interface MobileHeaderProps {
  hasSubscription?: boolean;
}

export function MobileHeader({ hasSubscription = true }: MobileHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const log = logger.withPrefix("MOBILE-HEADER");

  // Fetch user data - always run hooks, but only fetch if hasSubscription
  useEffect(() => {
    if (!hasSubscription) {
      setLoading(false);
      setUserData(null);
      return;
    }

    async function fetchUserData() {
      const navUserDataCache = getNavUserDataCache();
      
      // Check cache first
      const now = Date.now();
      if (navUserDataCache.data && (now - navUserDataCache.timestamp) < navUserDataCache.TTL) {
        // Use cached data
        setUserData(navUserDataCache.data);
        if (navUserDataCache.role && (now - navUserDataCache.roleTimestamp) < navUserDataCache.TTL) {
          setIsSuperAdmin(navUserDataCache.role === "super_admin");
        }
        setLoading(false);
        return;
      }

      // Reuse in-flight request if exists
      if (navUserDataCache.promise) {
        try {
          setLoading(true);
          const result = await navUserDataCache.promise;
          setUserData(result);
          if (navUserDataCache.role) {
            setIsSuperAdmin(navUserDataCache.role === "super_admin");
          }
          setLoading(false);
          return;
        } catch (error) {
          log.error("Cached promise failed:", error);
        }
      }
      try {
        setLoading(true);
        
        // Create fetch promise and cache it
        const fetchPromise = (async () => {
          const { getUserClient } = await import("@/lib/api/user-client");
          const { getUserRoleClient } = await import("@/lib/api/members-client");
          const [data, role] = await Promise.all([
            getUserClient(),
            getUserRoleClient(),
          ]);
          
          const result: UserData = data;
          
          // Update cache
          navUserDataCache.data = result;
          navUserDataCache.timestamp = Date.now();
          navUserDataCache.role = role;
          navUserDataCache.roleTimestamp = Date.now();
          navUserDataCache.promise = null;
          
          return result;
        })();

        // Cache the promise
        navUserDataCache.promise = fetchPromise;

        const data = await fetchPromise;
        setUserData(data);
        setIsSuperAdmin(navUserDataCache.role === "super_admin");
      } catch (error) {
        log.error("Error fetching user data:", error);
        setUserData(null);
        setIsSuperAdmin(false);
        navUserDataCache.promise = null;
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();

    // Listen for profile updates to update cache
    const handleProfileUpdate = (event: CustomEvent) => {
      const navUserDataCache = getNavUserDataCache();
      const updatedProfile = event.detail;
      
      // Update cache directly if we have cached data
      if (navUserDataCache.data && navUserDataCache.data.user) {
        navUserDataCache.data.user = {
          ...navUserDataCache.data.user,
          name: updatedProfile.name,
          avatarUrl: updatedProfile.avatarUrl,
        };
        navUserDataCache.timestamp = Date.now();
        // Update state immediately
        setUserData({ ...navUserDataCache.data });
      } else {
        // If no cache, invalidate and reload
        navUserDataCache.data = null;
        navUserDataCache.timestamp = 0;
        navUserDataCache.promise = null;
        fetchUserData();
      }
    };
    window.addEventListener("profile-saved", handleProfileUpdate as EventListener);

    return () => {
      window.removeEventListener("profile-saved", handleProfileUpdate as EventListener);
    };
  }, [hasSubscription, log]);

  // Don't render MobileHeader if user doesn't have subscription
  if (!hasSubscription) {
    return null;
  }

  const handleLogout = async () => {
    try {
      const { signOutClient } = await import("@/lib/api/auth-client");
      const result = await signOutClient();
      
      // Always redirect to landing page (even if there's an error)
      router.push("/");
      window.location.href = "/";
      
      if (result.error) {
        log.error("Failed to sign out:", result.error);
      }
    } catch (error) {
      log.error("Error signing out:", error);
      // Still redirect to landing page even if there's an error
      router.push("/");
      window.location.href = "/";
    }
  };

  const user = userData?.user;

  // Build nav sections dynamically - add Portal Management if super_admin
  const navSections = useMemo(() => isSuperAdmin
    ? [
        {
          title: "Portal Management",
          items: [
            { href: "/portal-management", label: "Portal Management", icon: Settings2 },
          ],
        },
        ...baseNavSections,
      ]
    : baseNavSections, [isSuperAdmin]);

  const handleNavClick = () => {
    setIsOpen(false);
  };

  // Get page title based on pathname
  const getPageTitle = () => {
    const routeMap: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/transactions": "Transactions",
      "/accounts": "Accounts",
      "/categories": "Categories",
      "/members": "Households",
      "/planning/budgets": "Budgets",
      "/planning/goals": "Goals",
      "/debts": "Debts",
      "/investments": "Investments",
      "/reports": "Reports",
      "/settings": "Settings",
      "/billing": "Billing",
      "/profile": "Profile",
      "/feedback": "Feedback",
      "/help-support": "Help & Support",
      "/portal-management": "Portal Management",
    };

    // Check exact match first
    if (routeMap[pathname]) {
      return routeMap[pathname];
    }

    // Check if pathname starts with any route
    for (const [route, title] of Object.entries(routeMap)) {
      if (pathname.startsWith(route)) {
        return title;
      }
    }

    // Default to "Dashboard"
    return "Dashboard";
  };

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-40 bg-card lg:hidden" 
      id="mobile-header"
      style={{ '--mobile-header-height': '3rem' } as React.CSSProperties}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3 min-h-[44px]">
          <Link href="/dashboard" prefetch={true} className="p-0 flex items-center">
            <Logo variant="icon" color="auto" width={32} height={32} />
          </Link>
          <h1 className="text-base font-semibold p-0 flex items-center">
            {getPageTitle()}
          </h1>
        </div>
        
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-screen overflow-y-auto">
              <nav className="flex-1 space-y-6 px-3 py-4">
                {navSections.map((section) => (
                  <div key={section.title} className="space-y-1">
                    <h3 className="px-3 pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {section.title}
                    </h3>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      // Extract base path without query params for comparison
                      const basePath = item.href.split("?")[0];
                      const isActive =
                        pathname === item.href ||
                        pathname === basePath ||
                        (basePath !== "/" && pathname.startsWith(basePath));
                      
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={true}
                          onClick={handleNavClick}
                          className={cn(
                            "flex items-center space-x-3 rounded-[12px] px-3 py-2 text-sm font-medium transition-all duration-200 ease-in-out",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              <div className="p-3 border-t">
                {loading ? (
                  <div className="flex items-center space-x-3 px-3 py-2">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-20 bg-muted rounded-[12px] animate-pulse" />
                      <div className="h-2 w-16 bg-muted rounded-[12px] animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full h-auto p-2 border border-border shadow justify-start"
                      >
                        <div className="flex items-center space-x-3 w-full">
                          <div className="relative flex-shrink-0">
                            {user?.avatarUrl ? (
                              <>
                                <img
                                  src={user.avatarUrl}
                                  alt={user.name || "User"}
                                  className="h-10 w-10 rounded-full object-cover border"
                                  loading="eager"
                                  decoding="async"
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
                                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground hidden items-center justify-center text-xs font-semibold border">
                                  {getInitials(user?.name)}
                                </div>
                              </>
                            ) : user?.name ? (
                              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold border">
                                {getInitials(user.name)}
                              </div>
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-medium truncate">
                              {user?.name || "User"}
                            </div>
                            {user?.email && (
                              <div className="mt-0.5 text-xs text-muted-foreground truncate">
                                {user.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem asChild className="mb-1">
                        <Link href="/settings" prefetch={true} className="cursor-pointer" onClick={handleNavClick}>
                          <Settings className="mr-2 h-4 w-4" />
                          <span>My Account</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="mb-1">
                        <Link href="/feedback" prefetch={true} className="cursor-pointer" onClick={handleNavClick}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          <span>Feedback</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="mb-1">
                        <Link href="/help-support" prefetch={true} className="cursor-pointer" onClick={handleNavClick}>
                          <HelpCircle className="mr-2 h-4 w-4" />
                          <span>Help & Support</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="mb-1">
                        <Link href="/privacy-policy" prefetch={true} target="_blank" rel="noopener noreferrer" className="cursor-pointer" onClick={handleNavClick}>
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Privacy Policy</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="mb-1">
                        <Link href="/terms-of-service" prefetch={true} target="_blank" rel="noopener noreferrer" className="cursor-pointer" onClick={handleNavClick}>
                          <FileTextIcon className="mr-2 h-4 w-4" />
                          <span>Terms of Service</span>
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
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

