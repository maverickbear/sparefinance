"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Receipt, Target, FolderTree, Wallet, TrendingUp, FileText, PiggyBank, CreditCard } from "lucide-react";

// Organized by: Overview, Money Management, Planning
const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/budgets", label: "Budgets", icon: Target },
  { href: "/goals", label: "Goals", icon: PiggyBank },
  { href: "/debts", label: "Debts", icon: CreditCard },
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
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
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className={cn("text-[10px]", isActive && "text-primary")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

