"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { AddTransactionSheet } from "@/components/bottom-nav/add-transaction-sheet";
import { MoreMenuSheet } from "@/components/bottom-nav/more-menu-sheet";
import { useState } from "react";

interface BottomNavProps {
  hasSubscription?: boolean;
}

export function BottomNav({ hasSubscription = true }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  // Don't render BottomNav if user doesn't have subscription
  if (!hasSubscription) {
    return null;
  }

  const isActive = (href: string) => {
    const basePath = href.split("?")[0];
    // Special handling for dashboard route
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/" || pathname.startsWith("/dashboard");
    }
    return pathname === basePath || pathname === href || (basePath !== "/" && pathname.startsWith(basePath));
  };

  return (
    <>
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card lg:hidden">
      <div className="flex h-16 items-center">
          {/* Left group: Dashboard and Transactions */}
          <div className="flex flex-1 items-center">
            <Link
              href="/dashboard"
              prefetch={true}
              onClick={(e) => {
                if (!hasSubscription) {
                  e.preventDefault();
                  router.push("/dashboard");
                }
              }}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 flex-basis-0 py-2 min-h-[44px] text-xs font-medium transition-colors",
                !hasSubscription && "opacity-50 cursor-not-allowed",
                isActive("/dashboard") ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutDashboard className={cn("h-5 w-5", isActive("/dashboard") && "text-primary")} />
              <span className={cn("text-[10px] leading-tight", isActive("/dashboard") && "text-primary")}>Dashboard</span>
            </Link>

            <Link
              href="/transactions"
              prefetch={true}
              onClick={(e) => {
                if (!hasSubscription) {
                  e.preventDefault();
                  router.push("/dashboard");
                }
              }}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 flex-basis-0 py-2 min-h-[44px] text-xs font-medium transition-colors",
                !hasSubscription && "opacity-50 cursor-not-allowed",
                isActive("/transactions") ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Receipt className={cn("h-5 w-5", isActive("/transactions") && "text-primary")} />
              <span className={cn("text-[10px] leading-tight", isActive("/transactions") && "text-primary")}>Transactions</span>
            </Link>
          </div>

          {/* Add Button - Circle only, centered */}
          <Button
            variant="ghost"
            onClick={() => {
              if (hasSubscription) {
                setIsAddSheetOpen(true);
              }
            }}
            disabled={!hasSubscription}
            size="icon"
            className={cn(
              "rounded-full h-12 w-12 bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0",
              !hasSubscription && "opacity-50 cursor-not-allowed"
            )}
          >
            <Plus className="h-6 w-6" />
          </Button>

          {/* Right group: Reports and More */}
          <div className="flex flex-1 items-center">
            <Link
              href="/reports"
              prefetch={true}
              onClick={(e) => {
                if (!hasSubscription) {
                  e.preventDefault();
                  router.push("/dashboard");
                }
              }}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 flex-basis-0 py-2 min-h-[44px] text-xs font-medium transition-colors",
                !hasSubscription && "opacity-50 cursor-not-allowed",
                isActive("/reports") ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className={cn("h-5 w-5", isActive("/reports") && "text-primary")} />
              <span className={cn("text-[10px] leading-tight", isActive("/reports") && "text-primary")}>Reports</span>
            </Link>

            <button
              onClick={() => setIsMoreSheetOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-1 flex-basis-0 h-auto min-h-[44px] py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] leading-tight">More</span>
            </button>
          </div>
      </div>
    </nav>

    {/* Add Transaction Sheet */}
    <AddTransactionSheet
      open={isAddSheetOpen}
      onOpenChange={setIsAddSheetOpen}
    />

    {/* More Menu Sheet */}
    <MoreMenuSheet
      open={isMoreSheetOpen}
      onOpenChange={setIsMoreSheetOpen}
      hasSubscription={hasSubscription}
    />
    </>
  );
}

