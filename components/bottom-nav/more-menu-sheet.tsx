"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthSafe } from "@/contexts/auth-context";
import { useSubscriptionSafe } from "@/contexts/subscription-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Wallet,
  PiggyBank,
  CreditCard,
  FolderTree,
  Users,
  Settings,
  Target,
  Calendar,
  Repeat,
  HelpCircle,
  MessageSquare,
  User,
  DollarSign,
  Edit,
  CheckCircle2,
  ArrowRight,
  Bell,
  FileText,
  Lightbulb,
  LayoutDashboard,
  Tag,
  Mail,
  Star,
  Calculator,
  Search,
  Palette,
  Shield,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useTheme } from "next-themes";
import { logger } from "@/src/infrastructure/utils/logger";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

// Helper function to build nav categories for the consumer app
function buildNavCategories(): NavCategory[] {
  const categories: NavCategory[] = [
    {
      title: "Overview",
      items: [
        { href: "/reports", label: "Reports", icon: FileText },
        { href: "/insights", label: "Insights", icon: Lightbulb },
      ],
    },
    {
      title: "Money Management",
      items: [
        { href: "/accounts", label: "Bank Accounts", icon: Wallet },
        { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
        { href: "/planned-payment", label: "Planned Payments", icon: Calendar },
        { href: "/settings/categories", label: "Categories", icon: FolderTree },
        { href: "/settings/household", label: "Household", icon: Users },
      ],
    },
    {
      title: "Planning",
      items: [
        { href: "/planning/budgets", label: "Budgets", icon: Target },
        { href: "/planning/goals", label: "Goals", icon: PiggyBank },
        { href: "/debts", label: "Debts", icon: CreditCard },
      ],
    },
    {
      title: "Account & Settings",
      items: [
        { href: "/settings/myaccount", label: "My Account", icon: User },
        { href: "/settings/billing", label: "Billing", icon: DollarSign },
        { href: "/help-support", label: "Help & Support", icon: HelpCircle },
        { href: "/feedback", label: "Feedback", icon: MessageSquare },
      ],
    },
  ];

  // Add Legal & Preferences section (theme toggle for all users)
  const legalItems: NavItem[] = [
    { href: "/privacy-policy", label: "Privacy Policy", icon: Shield },
    { href: "/terms-of-service", label: "Terms of Service", icon: FileText },
    { href: "#", label: "Theme", icon: Sun },
  ];

  categories.push({
    title: "Legal & Preferences",
    items: legalItems,
  });

  return categories;
}

interface UserProfile {
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function calculateProfileProgress(profile: UserProfile | null): number {
  if (!profile) return 0;
  
  let completed = 0;
  const total = 3;
  
  if (profile.name && profile.name.trim() !== "") completed++;
  if (profile.email && profile.email.trim() !== "") completed++;
  if (profile.avatarUrl) completed++;
  
  return Math.round((completed / total) * 100);
}

interface PlanInfo {
  plan: {
    id: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
  } | null;
  subscription: {
    status: "active" | "trialing" | "cancelled" | "past_due" | "unpaid";
    trialEndDate?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
  } | null;
  interval: "month" | "year" | null;
}

interface MoreMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasSubscription?: boolean;
}

export function MoreMenuSheet({
  open,
  onOpenChange,
  hasSubscription = true,
}: MoreMenuSheetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // Use Context instead of local state and fetch
  const { user, checking: checkingAuth } = useAuthSafe();
  const { subscription, plan, checking: checkingSubscription } = useSubscriptionSafe();
  
  // Derive data from Context
  const loading = checkingAuth || checkingSubscription;
  const log = logger.withPrefix("MORE-MENU");
  
  // Build nav categories for consumer app
  const navCategories = buildNavCategories();
  
  // Build userProfile from Context
  const userProfile: UserProfile | null = user ? {
    name: user.name ?? null,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
  } : null;
  
  // Build planInfo from Context
  // Note: interval is not in Subscription domain type, so we default to "month"
  // If interval is needed, it can be fetched separately or added to SubscriptionContext
  const planInfo: PlanInfo | null = plan && subscription ? {
    plan: {
      id: plan.id,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
    },
    subscription: {
      status: subscription.status,
      trialEndDate: subscription.trialEndDate?.toString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
    interval: "month" as const, // Default to month, can be enhanced later if needed
  } : null;

  const isActive = (href: string) => {
    const basePath = href.split("?")[0];
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/" || pathname.startsWith("/dashboard");
    }
    return pathname === basePath || pathname === href || (basePath !== "/" && pathname.startsWith(basePath));
  };

  const handleItemClick = (href: string) => {
    onOpenChange(false);
    if (!hasSubscription) {
      router.push("/dashboard");
      return;
    }
  };

  const handleLogout = async () => {
    try {
      onOpenChange(false);
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

  const profileProgress = calculateProfileProgress(userProfile);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="max-h-[90vh] flex flex-col p-0"
      >
        <SheetTitle className="sr-only">More Menu</SheetTitle>
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 relative">
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="space-y-6 px-6 overflow-y-auto flex-1 pb-6">
          {/* Profile Header */}
          <div className="flex items-center gap-4 pt-2">
            <div className="relative flex-shrink-0">
              {userProfile?.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt={userProfile.name || "User"}
                  className="w-16 h-16 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                  <span className="text-lg font-semibold text-primary">
                    {getInitials(userProfile?.name)}
                  </span>
                </div>
              )}
              {hasSubscription && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                  <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">
                {userProfile?.name || "User"}
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {userProfile?.email || ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
              onClick={() => {
                onOpenChange(false);
                router.push("/settings/myaccount");
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>

          {/* Availability/Notifications Section */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Notifications</span>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
            />
          </div>

          {/* Profile Progress Banner */}
          {profileProgress < 100 && (
            <Card className="bg-sentiment-warning/90 dark:bg-sentiment-warning/80 border-0">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="relative flex-shrink-0 w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.3)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="white"
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - profileProgress / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{profileProgress}%</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">
                    Update your profile now!
                  </p>
                  <p className="text-xs text-white/90">
                    Complete your profile for better experience
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 flex-shrink-0"
                  onClick={() => {
                    onOpenChange(false);
                    router.push("/settings/myaccount");
                  }}
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Menu Categories */}
          {navCategories.map((category) => (
            <div key={category.title} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                {category.title}
              </h3>
              <div className="border border-border rounded-lg overflow-hidden">
                {category.items.map((item, index) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const isLast = index === category.items.length - 1;
                  
                  // Handle theme toggle in Legal & Preferences
                  if (category.title === "Legal & Preferences" && item.label === "Theme") {
                    return (
                      <button
                        key="theme-toggle"
                        onClick={() => {
                          setTheme(theme === "dark" ? "light" : "dark");
                        }}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 w-full",
                          "transition-all duration-200",
                          "hover:bg-muted/50 active:scale-[0.98]",
                          !isLast && "border-b border-border",
                          "text-foreground"
                        )}
                      >
                        <div className="p-1.5 rounded-lg transition-colors flex-shrink-0 bg-muted">
                          {theme === "dark" ? (
                            <Sun className="h-4 w-4" />
                          ) : (
                            <Moon className="h-4 w-4" />
                          )}
                        </div>
                        <span className="text-sm font-medium flex-1 text-left">
                          {theme === "dark" ? "Light Mode" : "Dark Mode"}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    );
                  }
                  
                  // Handle "soon" items - render as disabled button instead of link
                  if (item.soon) {
                    return (
                      <div
                        key={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2",
                          "transition-all duration-200",
                          "opacity-60 cursor-not-allowed",
                          !isLast && "border-b border-border",
                          "text-muted-foreground"
                        )}
                      >
                        <div className="p-1.5 rounded-lg transition-colors flex-shrink-0 bg-muted">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium flex-1">
                          {item.label}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                          SOON
                        </span>
                      </div>
                    );
                  }
                  
                  // Handle external links (Privacy Policy, Terms of Service)
                  const isExternal = item.href === "/privacy-policy" || item.href === "/terms-of-service";
                  
                  if (isExternal) {
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        prefetch={true}
                        onClick={() => handleItemClick(item.href)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2",
                          "transition-all duration-200",
                          "hover:bg-muted/50 active:scale-[0.98]",
                          !isLast && "border-b border-border",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-foreground"
                        )}
                      >
                        <div
                          className={cn(
                            "p-1.5 rounded-lg transition-colors flex-shrink-0",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span
                          className={cn(
                            "text-sm font-medium flex-1",
                            active && "text-primary"
                          )}
                        >
                          {item.label}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    );
                  }
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      onClick={(e) => {
                        if (!hasSubscription) {
                          e.preventDefault();
                          router.push("/dashboard");
                        } else {
                          handleItemClick(item.href);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2",
                        "transition-all duration-200",
                        "hover:bg-muted/50 active:scale-[0.98]",
                        !isLast && "border-b border-border",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "p-1.5 rounded-lg transition-colors flex-shrink-0",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span
                        className={cn(
                          "text-sm font-medium flex-1",
                          active && "text-primary"
                        )}
                      >
                        {item.label}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Logout Button */}
          <div className="space-y-2 pt-4 border-t">
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={handleLogout}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 w-full",
                  "transition-all duration-200",
                  "hover:bg-muted/50 active:scale-[0.98]",
                  "text-destructive"
                )}
              >
                <div className="p-1.5 rounded-lg transition-colors flex-shrink-0 bg-destructive/10">
                  <LogOut className="h-4 w-4 text-destructive" />
                </div>
                <span className="text-sm font-medium flex-1 text-left">
                  Log out
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}

