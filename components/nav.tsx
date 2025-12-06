"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, createContext, useContext, memo, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Receipt, Target, FolderTree, TrendingUp, FileText, CreditCard, PiggyBank, Users, User, ChevronLeft, ChevronRight, ChevronDown, Settings2, Wallet, Calendar, Repeat, Tag, Mail, Star, Search, Palette, Calculator } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { useAuthSafe } from "@/contexts/auth-context";
import { UserMenuClient } from "@/components/nav/user-menu-client";
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
  {
    title: "Settings",
    items: [
      { href: "/settings", label: "My Account", icon: User },
    ],
  },
];

// Context for sidebar collapsed state
const SidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

/**
 * NavComponent
 * 
 * Presentation Layer component - only renders UI, no business logic
 * 
 * Architecture:
 * - Uses AuthContext and SubscriptionContext for state (consumes only)
 * - No cache implementation (cache is in Application/Infrastructure layers)
 * - No business logic (gating decisions are made in layouts/guards)
 * - Client island (UserMenuClient) handles interactive parts
 */
function NavComponent() {
  const pathname = usePathname();
  const router = useRouter();
  
  // Use Context only for reading state (role for portal management visibility)
  // All other user/subscription data is handled by UserMenuClient
  const { role } = useAuthSafe();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showPortalManagementItems, setShowPortalManagementItems] = useState(false);

  const isSuperAdmin = role === "super_admin";

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


  // Set Portal Management section as collapsed by default when user is super admin
  useEffect(() => {
    if (isSuperAdmin) {
      setCollapsedSections(prev => {
        const next = new Set(prev);
        next.add("Portal Management");
        return next;
      });
    }
  }, [isSuperAdmin]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);


  // Portal Management items (without the toggle button)
  const portalManagementItems = [
    { href: "/portal-management/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/portal-management/users", label: "Users", icon: Users },
    { href: "/portal-management/promo-codes", label: "Promo Codes", icon: Tag },
    { href: "/portal-management/system-entities", label: "System Entities", icon: FolderTree },
    { href: "/portal-management/contact-forms", label: "Contact Forms", icon: Mail },
    { href: "/portal-management/feedback", label: "Feedback", icon: Star },
    { href: "/portal-management/plans", label: "Plans", icon: CreditCard },
    { href: "/portal-management/subscription-services", label: "Subscription Services", icon: Settings2 },
    { href: "/portal-management/tax-rates", label: "Tax Rates", icon: Calculator },
    { href: "/portal-management/seo", label: "SEO Settings", icon: Search },
    { href: "/design", label: "Design System", icon: Palette },
  ];

  // Build nav sections - add portal management items directly to base sections
  const navSections = useMemo((): NavSection[] => {
    if (!isSuperAdmin) {
      return baseNavSections;
    }

    // Always show portal management items as a regular section when super admin
    return [
      {
        title: "Portal Management",
        items: portalManagementItems,
      },
      ...baseNavSections,
    ];
  }, [isSuperAdmin]);

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
                  <Logo variant="icon" color="auto" width={40} height={40} priority />
                </Link>
              ) : (
                <Link href="/dashboard" prefetch={true} className="flex items-center justify-center w-full h-full">
                  <Logo variant="wordmark" color="auto" width={200} height={53} priority />
                </Link>
              )}
            </div>

            <nav className={cn(
              "flex-1 space-y-5 px-3 py-4",
              isCollapsed ? "overflow-visible" : "overflow-y-auto"
            )}>
              {navSections.map((section) => {
                const isSectionCollapsed = collapsedSections.has(section.title);
                return (
                <div key={section.title} className="space-y-1">
                  {!isCollapsed && (
                    <button
                      onClick={() => {
                        setCollapsedSections(prev => {
                          const next = new Set(prev);
                          if (next.has(section.title)) {
                            next.delete(section.title);
                          } else {
                            next.add(section.title);
                          }
                          return next;
                        });
                      }}
                      className="flex items-center justify-between w-full px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      <span>{section.title}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          isSectionCollapsed && "rotate-[-90deg]"
                        )}
                      />
                    </button>
                  )}
                  <div className={cn(
                    "transition-all duration-200 ease-in-out",
                    isSectionCollapsed ? "max-h-0 overflow-hidden opacity-0" : "max-h-[500px] opacity-100"
                  )}>
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
                              "flex items-center rounded-lg text-sm font-medium transition-all duration-200 ease-in-out justify-center px-3 py-2 w-full",
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
                            "flex items-center justify-between w-full rounded-lg text-sm font-medium transition-all duration-200 ease-in-out px-3 py-2",
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
                            className="flex items-center rounded-lg text-sm font-medium transition-all duration-200 ease-in-out justify-center px-3 py-2 w-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
                          className="flex items-center space-x-3 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
                        className={cn(
                          "flex items-center rounded-lg text-sm font-medium transition-all duration-200 ease-in-out",
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
                </div>
              );
              })}
            </nav>

            {/* User Menu Client Island - handles all user/subscription UI */}
            <UserMenuClient isCollapsed={isCollapsed} />
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

