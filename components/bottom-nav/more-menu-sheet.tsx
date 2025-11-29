"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
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
  TrendingUp,
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
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    title: "Money Management",
    items: [
      { href: "/accounts", label: "Bank Accounts", icon: Wallet },
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
  {
    title: "Account & Settings",
    items: [
      { href: "/profile", label: "Profile", icon: User },
      { href: "/settings", label: "My Account", icon: Settings },
      { href: "/billing", label: "Billing", icon: DollarSign },
      { href: "/help-support", label: "Help & Support", icon: HelpCircle },
      { href: "/feedback", label: "Feedback", icon: MessageSquare },
    ],
  },
];

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
    status: "active" | "trialing" | "cancelled" | "past_due";
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
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      async function fetchData() {
        setLoading(true);
        try {
          // Fetch user profile
          const userResponse = await fetch("/api/v2/user");
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setUserProfile({
              name: userData.user?.name || null,
              email: userData.user?.email || "",
              avatarUrl: userData.user?.avatarUrl || null,
            });
          }

          // Fetch plan info if has subscription
          if (hasSubscription) {
            const planResponse = await fetch("/api/billing/subscription?includeStripe=false&includeLimits=false");
            if (planResponse.ok) {
              const planData = await planResponse.json();
              setPlanInfo({
                plan: planData.plan,
                subscription: planData.subscription,
                interval: planData.interval,
              });
            }
          }
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setLoading(false);
        }
      }
      fetchData();
    } else {
      setPlanInfo(null);
      setUserProfile(null);
    }
  }, [open, hasSubscription]);

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
                router.push("/profile");
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
            <Card className="bg-[#8B4513] dark:bg-[#6B3410] border-0">
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
                    router.push("/profile");
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

        </div>
      </SheetContent>
    </Sheet>
  );
}

