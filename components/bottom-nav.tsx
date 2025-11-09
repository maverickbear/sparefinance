"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  FileText,
  PiggyBank,
  CreditCard,
  TrendingUp,
  FolderTree,
  Users,
  Settings,
  User,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Main navigation items (always visible - 5 items + More button)
const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/reports", label: "Reports", icon: FileText },
];

// Additional navigation items (shown in "More" submenu)
const moreNavItems = [
  { href: "/debts", label: "Debts", icon: CreditCard },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/members", label: "Members", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/profile", label: "Profile", icon: User },
];

interface BottomNavProps {
  hasSubscription?: boolean;
}

export function BottomNav({ hasSubscription = true }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  console.log("[BOTTOM-NAV] Render:", { hasSubscription, pathname });

  // Don't render BottomNav if user doesn't have subscription
  if (!hasSubscription) {
    console.log("[BOTTOM-NAV] Returning null (no subscription)");
    return null;
  }

  console.log("[BOTTOM-NAV] Rendering bottom nav component");

  const handleItemClick = (href: string) => {
    if (!hasSubscription) {
      router.push("/select-plan");
      return;
    }
  };

  const isActive = (href: string) => {
    const basePath = href.split("?")[0];
    // Special handling for dashboard route
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/" || pathname.startsWith("/dashboard");
    }
    return pathname === basePath || pathname === href || (basePath !== "/" && pathname.startsWith(basePath));
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="flex h-16 items-center justify-around">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => {
                if (!hasSubscription) {
                  e.preventDefault();
                  router.push("/select-plan");
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors",
                !hasSubscription && "opacity-50 cursor-not-allowed",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-primary")} />
              <span className={cn("text-[10px]", active && "text-primary")}>{item.label}</span>
            </Link>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors",
                "text-muted-foreground hover:text-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px]">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            sideOffset={8}
            className="mb-2 w-56"
          >
            {moreNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link
                    href={item.href}
                    onClick={(e) => {
                      if (!hasSubscription) {
                        e.preventDefault();
                        router.push("/select-plan");
                      } else {
                        handleItemClick(item.href);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer",
                      active && "text-primary"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active && "text-primary")} />
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}

