"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, createContext, useContext, memo, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/utils/logger";
import { LayoutDashboard, Receipt, Target, FolderTree, TrendingUp, FileText, Moon, Sun, User, Settings, LogOut, CreditCard, PiggyBank, Users, ChevronLeft, ChevronRight, HelpCircle, Shield, FileText as FileTextIcon, Settings2, MessageSquare, Wallet, Calendar, Repeat, Tag, Mail, Star, ChevronDown } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { TrialWidget, calculateTrialDaysRemaining, calculateTrialProgress } from "@/components/billing/trial-widget";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Nav item type definition
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isToggle?: boolean;
  isBack?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Base nav sections (without Portal Management)
const baseNavSections: NavSection[] = [
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
      { href: "/accounts", label: "Bank Accounts", icon: Wallet },
      { href: "/transactions", label: "Transactions", icon: Receipt },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/planned-payment", label: "Planned Payments", icon: Calendar },
      { href: "/categories", label: "Categories", icon: FolderTree },
      { href: "/members", label: "Household", icon: Users },
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
    id: string;
    name: string;
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

// Global cache for user data in Nav (shared across all instances)
const navUserDataCache = {
  data: null as UserData | null,
  promise: null as Promise<UserData> | null,
  timestamp: 0,
  TTL: 5 * 60 * 1000, // 5 minutes cache
  role: null as "admin" | "member" | "super_admin" | null,
  roleTimestamp: 0,
};

// Extend Window interface for navUserDataCache
declare global {
  interface Window {
    navUserDataCache?: typeof navUserDataCache;
  }
}

// Expose cache for preloading during login
if (typeof window !== 'undefined') {
  window.navUserDataCache = navUserDataCache;
}

function NavComponent({ hasSubscription = true }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showPortalManagementItems, setShowPortalManagementItems] = useState(false);

  const log = logger.withPrefix("NAV");

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  // Auto-show Portal Management items if on portal-management page
  useEffect(() => {
    if (pathname.startsWith("/portal-management")) {
      setShowPortalManagementItems(true);
    }
  }, [pathname]);

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(isCollapsed));
    // Dispatch event for layout-wrapper to listen
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { isCollapsed } }));
  }, [isCollapsed]);

  // Fetch user data - always run hooks, but only fetch if hasSubscription
  useEffect(() => {
    if (!hasSubscription) {
      setLoading(false);
      setUserData(null);
      return;
    }

    async function fetchUserData() {
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
  }, [hasSubscription]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Don't render Nav if user doesn't have subscription
  // But all hooks must be called before this return
  if (!hasSubscription) {
    return null;
  }

  const handleLogout = useCallback(async () => {
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
  }, [router, log]);

  const user = userData?.user;

  // Portal Management items
  const portalManagementSections: NavSection[] = [
    {
      title: "Portal Management",
      items: [
        { href: "/portal-management", label: "Portal Management", icon: Settings2, isToggle: true, isBack: true },
        { href: "/portal-management/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/portal-management/users", label: "Users", icon: Users },
        { href: "/portal-management/promo-codes", label: "Promo Codes", icon: Tag },
        { href: "/portal-management/system-entities", label: "System Entities", icon: FolderTree },
        { href: "/portal-management/contact-forms", label: "Contact Forms", icon: Mail },
        { href: "/portal-management/feedback", label: "Feedback", icon: Star },
        { href: "/portal-management/plans", label: "Plans", icon: CreditCard },
        { href: "/portal-management/subscription-services", label: "Subscription Services", icon: Settings2 },
      ],
    },
  ];

  // Build nav sections - toggle between normal and portal management items
  const navSections = useMemo((): NavSection[] => {
    if (!isSuperAdmin) {
      return baseNavSections;
    }

    if (showPortalManagementItems) {
      return portalManagementSections;
    }

    return [
        {
          title: "Portal Management",
          items: [
          { href: "/portal-management", label: "Portal Management", icon: Settings2, isToggle: true },
          ],
        },
        ...baseNavSections,
    ];
  }, [isSuperAdmin, showPortalManagementItems]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <TooltipProvider>
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300 hidden lg:block",
            isCollapsed ? "w-16 overflow-visible" : "w-64 overflow-hidden"
          )}
          onMouseEnter={() => {
            // Clear any existing timeout
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
            setIsHovered(true);
          }}
          onMouseLeave={() => {
            // Keep button visible for 2 seconds after mouse leaves
            hoverTimeoutRef.current = setTimeout(() => {
              setIsHovered(false);
              hoverTimeoutRef.current = null;
            }, 2000);
          }}
        >
          <div className={cn("flex h-full flex-col", isCollapsed && "overflow-visible")}>
            <div
              className={cn(
                "flex h-16 min-h-[64px] items-center border-b px-4 relative justify-center"
              )}
            >
              {isCollapsed ? (
                <Link href="/dashboard" prefetch={true} className="flex items-center justify-center w-full h-full">
                  <Logo variant="icon" color="auto" width={40} height={40} />
                </Link>
              ) : (
                <Link href="/dashboard" prefetch={true} className="flex items-center justify-center w-full h-full">
                  <Logo variant="wordmark" color="auto" width={150} height={40} />
                </Link>
              )}
            </div>

            <nav className={cn(
              "flex-1 space-y-5 px-3 py-4",
              isCollapsed ? "overflow-visible" : "overflow-y-auto"
            )}>
              {navSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  {!isCollapsed && (
                    <h3 className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {section.title}
                    </h3>
                  )}
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isToggle = item.isToggle;
                    const isBack = item.isBack;
                    
                    // Handle Portal Management toggle button (show normal items)
                    if (isToggle && !isBack) {
                      const isActive = pathname.startsWith("/portal-management");
                      
                      if (isCollapsed) {
                        const toggleButton = (
                          <button
                            onClick={() => {
                              setShowPortalManagementItems(!showPortalManagementItems);
                              if (!showPortalManagementItems) {
                                router.push("/portal-management/dashboard");
                              }
                            }}
                            className={cn(
                              "flex items-center rounded-[12px] text-sm font-medium transition-all duration-200 ease-in-out justify-center px-3 py-2 w-full",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <Icon className="h-5 w-5 flex-shrink-0" />
                          </button>
                        );
                        return (
                          <Tooltip key="portal-management-toggle">
                            <TooltipTrigger asChild>
                              <div className="relative">
                                {toggleButton}
                                <TooltipContent side="right">
                                  Portal Management
                                </TooltipContent>
                              </div>
                            </TooltipTrigger>
                          </Tooltip>
                        );
                      }
                      
                      return (
                        <button
                          key="portal-management-toggle"
                          onClick={() => {
                            setShowPortalManagementItems(!showPortalManagementItems);
                            if (!showPortalManagementItems) {
                              router.push("/portal-management/dashboard");
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between w-full rounded-[12px] text-sm font-medium transition-all duration-200 ease-in-out px-3 py-2",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <div className="flex items-center space-x-3">
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            <span>{item.label}</span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              showPortalManagementItems && "rotate-180"
                            )}
                          />
                        </button>
                      );
                    }
                    
                    // Handle back button (show normal items again)
                    if (isToggle && isBack) {
                      if (isCollapsed) {
                        const backButton = (
                          <button
                            onClick={() => {
                              setShowPortalManagementItems(false);
                              router.push("/dashboard");
                            }}
                            className="flex items-center rounded-[12px] text-sm font-medium transition-all duration-200 ease-in-out justify-center px-3 py-2 w-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          >
                            <ChevronLeft className="h-5 w-5 flex-shrink-0" />
                          </button>
                        );
                        return (
                          <Tooltip key="portal-management-back">
                            <TooltipTrigger asChild>
                              <div className="relative">
                                {backButton}
                                <TooltipContent side="right">
                                  Back to Main Menu
                                </TooltipContent>
                              </div>
                            </TooltipTrigger>
                          </Tooltip>
                        );
                      }
                      
                      return (
                        <button
                          key="portal-management-back"
                          onClick={() => {
                            setShowPortalManagementItems(false);
                            router.push("/dashboard");
                          }}
                          className="flex items-center space-x-3 rounded-[12px] text-sm font-medium transition-all duration-200 ease-in-out px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <ChevronLeft className="h-5 w-5 flex-shrink-0" />
                          <span>Back to Main Menu</span>
                        </button>
                      );
                    }
                    
                    // Handle Portal Management items (regular links now)
                    
                    // Regular link item
                    const basePath = item.href.split("?")[0];
                    const isActive =
                      pathname === item.href ||
                      pathname === basePath ||
                      (basePath !== "/" && pathname.startsWith(basePath));
                    
                    const linkElement = (
                      <Link
                        href={item.href}
                        prefetch={true}
                        onClick={(e) => {
                          if (!hasSubscription) {
                            e.preventDefault();
                            router.push("/dashboard");
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
                          <TooltipTrigger asChild>
                            <div className="relative">
                              {linkElement}
                              <TooltipContent side="right">
                                {item.label}
                              </TooltipContent>
                            </div>
                          </TooltipTrigger>
                        </Tooltip>
                      );
                    }

                    return <div key={item.href}>{linkElement}</div>;
                  })}
                </div>
              ))}
            </nav>

            {/* Trial Widget - Show if user is in trial */}
            {!loading && userData && userData.subscription?.status === "trialing" && !isCollapsed && (
              <TrialWidget
                daysRemaining={calculateTrialDaysRemaining(userData.subscription.trialEndDate)}
                progress={calculateTrialProgress(userData.subscription.trialStartDate, userData.subscription.trialEndDate)}
                trialStartDate={userData.subscription.trialStartDate}
                trialEndDate={userData.subscription.trialEndDate}
                planName={userData.plan?.name}
              />
            )}


            <div className="p-3">
              {loading ? (
                <div
                  className={cn(
                    "flex items-center",
                    isCollapsed ? "justify-center" : "space-x-3 px-3 py-2"
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
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
                      className={cn(
                        "w-full h-auto p-2 border border-border shadow",
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
                        {!isCollapsed && (
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-medium truncate">
                              {user?.name || (
                                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                              )}
                            </div>
                            {user?.email && (
                              <div className="mt-0.5 text-xs text-muted-foreground truncate">
                                {user.email}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild className="mb-1">
                      <Link href="/settings" prefetch={true} className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>My Account</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="mb-1">
                      <Link href="/feedback" prefetch={true} className="cursor-pointer">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        <span>Feedback</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="mb-1">
                      <Link href="/help-support" prefetch={true} className="cursor-pointer">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        <span>Help & Support</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="mb-1">
                      <Link href="/privacy-policy" prefetch={true} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Privacy Policy</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="mb-1">
                      <Link href="/terms-of-service" prefetch={true} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
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
        </aside>
        {/* Toggle button rendered outside aside to avoid overflow clipping */}
        {isHovered && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "fixed top-4 h-5 w-5 z-[50] bg-card border border-border shadow-sm hidden lg:flex items-center justify-center transition-opacity duration-200",
                  isCollapsed ? "left-16" : "left-64",
                  isHovered ? "opacity-100" : "opacity-0"
                )}
                style={{ transform: 'translateX(-50%)' }}
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronLeft className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isCollapsed ? "right" : "bottom"}>
              {isCollapsed ? "Expand menu" : "Collapse menu"}
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

// Memoize Nav component to prevent unnecessary re-renders
export const Nav = memo(NavComponent);

