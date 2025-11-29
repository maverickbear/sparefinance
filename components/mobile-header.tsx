"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LayoutDashboard, Receipt, Target, FolderTree, TrendingUp, FileText, Moon, Sun, Settings, LogOut, CreditCard, PiggyBank, Users, HelpCircle, Shield, FileText as FileTextIcon, Settings2, MessageSquare, Wallet, Calendar, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/common/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logger } from "@/src/infrastructure/utils/logger";


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
          // Fetch user data and role in parallel using API routes
          const [userResponse, membersResponse] = await Promise.all([
            fetch("/api/v2/user"),
            fetch("/api/v2/members"),
          ]);
          
          if (!userResponse.ok || !membersResponse.ok) {
            throw new Error("Failed to fetch user data");
          }
          
          const [userData, membersData] = await Promise.all([
            userResponse.json(),
            membersResponse.json(),
          ]);
          
          const result: UserData = {
            user: userData.user,
            plan: userData.plan,
            subscription: userData.subscription,
          };
          
          const role = membersData.userRole;
          
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
      const response = await fetch("/api/v2/auth/sign-out", {
        method: "POST",
      });

      // Always redirect to landing page (even if there's an error)
      router.push("/");
      window.location.href = "/";
      
      if (!response.ok) {
        const error = await response.json();
        log.error("Failed to sign out:", error.error || "Unknown error");
      }
    } catch (error) {
      log.error("Error signing out:", error);
      // Still redirect to landing page even if there's an error
      router.push("/");
      window.location.href = "/";
    }
  };

  const user = userData?.user;

  // Get page title based on pathname
  const getPageTitle = () => {
    // Special case for dashboard - show personalized welcome
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard")) {
      const firstName = userData?.user?.name?.split(' ')[0] || 'there';
      return `Welcome, ${firstName}`;
    }

    const routeMap: Record<string, string> = {
      "/transactions": "Transactions",
      "/planned-payment": "Planned Payments",
      "/accounts": "Bank Accounts",
      "/subscriptions": "Subscriptions",
      "/categories": "Categories",
      "/members": "Household",
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
      className="bg-card lg:hidden sticky top-0 z-40" 
      id="mobile-header"
      style={{ 
        '--mobile-header-height': '3rem',
      } as React.CSSProperties}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3 min-h-[44px] flex-1">
          <Link href="/dashboard" prefetch={true} className="p-0 flex items-center">
            <Logo variant="icon" color="auto" width={32} height={32} />
          </Link>
          <h1 className="text-base font-semibold p-0 flex items-center">
            {getPageTitle()}
          </h1>
        </div>
      </div>
    </header>
  );
}

