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
import { useAuthSafe } from "@/contexts/auth-context";
import { useSubscriptionSafe } from "@/contexts/subscription-context";


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

/**
 * MobileHeader
 * 
 * Uses AuthContext and SubscriptionContext for user data (single source of truth)
 * No longer makes direct API calls - all data comes from Context
 */
export function MobileHeader({ hasSubscription = true }: MobileHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  
  // Use Context instead of local state and fetch
  // Use Safe versions to handle cases where providers might not be available (public pages)
  const { user, role, checking: checkingAuth } = useAuthSafe();
  const { subscription, plan, checking: checkingSubscription } = useSubscriptionSafe();
  
  const log = logger.withPrefix("MOBILE-HEADER");
  
  // Derive data from Context
  const loading = checkingAuth || checkingSubscription;
  const isSuperAdmin = role === "super_admin";
  
  // Build UserData from Context (for compatibility with existing code)
  const userData: UserData | null = user ? {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
    },
    plan: plan ? {
      id: plan.id,
      name: plan.name,
    } : null,
    subscription: subscription ? {
      status: subscription.status,
      trialEndDate: subscription.trialEndDate ?? null,
      trialStartDate: subscription.trialStartDate ?? null,
    } : null,
  } : null;

  // Listen for profile updates to refresh AuthContext
  const { refetch: refetchAuth } = useAuthSafe();
  
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent) => {
      // Profile was updated - refresh auth context to get latest user data
      refetchAuth();
    };
    
    window.addEventListener("profile-saved", handleProfileUpdate as EventListener);
    return () => {
      window.removeEventListener("profile-saved", handleProfileUpdate as EventListener);
    };
  }, [refetchAuth]);

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

  // Get page title based on pathname
  const getPageTitle = () => {
    // Special case for dashboard - show personalized welcome
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard")) {
      const firstName = user?.name?.split(' ')[0] || 'there';
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
      "/portal-management/seo": "SEO Settings",
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
            <Logo variant="icon" color="auto" width={32} height={32} priority />
          </Link>
          <h1 className="text-base font-semibold p-0 flex items-center">
            {getPageTitle()}
          </h1>
        </div>
      </div>
    </header>
  );
}

