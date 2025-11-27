"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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

interface BottomNavProps {
  hasSubscription?: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type: "link" | "button";
  onClick?: () => void;
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
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/" || pathname.startsWith("/dashboard");
    }
    return pathname === basePath || pathname === href || (basePath !== "/" && pathname.startsWith(basePath));
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!hasSubscription) {
      e.preventDefault();
      router.push("/dashboard");
    }
  };

  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      type: "link",
    },
    {
      href: "/transactions",
      label: "Transactions",
      icon: Receipt,
      type: "link",
    },
    {
      href: "#",
      label: "Add",
      icon: Plus,
      type: "button",
      onClick: () => setIsAddSheetOpen(true),
    },
    {
      href: "/reports",
      label: "Reports",
      icon: FileText,
      type: "link",
    },
    {
      href: "#",
      label: "More",
      icon: MoreHorizontal,
      type: "button",
      onClick: () => setIsMoreSheetOpen(true),
    },
  ];

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card lg:hidden"
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.type === "link" ? isActive(item.href) : false;
            const isAddButton = item.label === "Add";

            if (item.type === "button") {
              if (isAddButton) {
                return (
                  <div
                    key={item.label}
                    className="flex flex-1 flex-col items-center justify-center gap-1 flex-basis-0 min-h-[44px] py-2"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={item.onClick}
                      disabled={!hasSubscription}
                      className={cn(
                        "rounded-full h-10 w-10 bg-primary text-primary-foreground",
                        "hover:bg-primary/90 active:scale-95",
                        "transition-all duration-200",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      )}
                      aria-label="Add transaction"
                    >
                      <Icon className="h-5 w-5" />
                    </Button>
                  </div>
                );
              }

              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  disabled={!hasSubscription}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-1 flex-basis-0 min-h-[44px] py-2",
                    "text-xs font-medium transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] leading-tight">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={(e) => handleLinkClick(e, item.href)}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 flex-basis-0 min-h-[44px] py-2",
                  "text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  !hasSubscription && "opacity-50 cursor-not-allowed",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active && "text-primary"
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-[10px] leading-tight transition-colors",
                    active && "text-primary"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AddTransactionSheet
        open={isAddSheetOpen}
        onOpenChange={setIsAddSheetOpen}
      />

      <MoreMenuSheet
        open={isMoreSheetOpen}
        onOpenChange={setIsMoreSheetOpen}
        hasSubscription={hasSubscription}
      />
    </>
  );
}
