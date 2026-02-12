"use client";

import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { Nav } from "@/components/nav";
import { BottomNav } from "@/components/bottom-nav";
import { MobileHeader } from "@/components/mobile-header";
import { CancelledSubscriptionBanner } from "@/components/common/cancelled-subscription-banner";
import { PausedSubscriptionBanner } from "@/src/presentation/components/features/subscriptions/paused-subscription-banner";

interface DashboardLayoutProps {
  children: React.ReactNode;
  isSidebarCollapsed: boolean;
  hasSubscription: boolean;
}

/**
 * Dashboard Layout Component
 * Main layout for authenticated users with subscription
 */
export function DashboardLayout({
  children,
  isSidebarCollapsed,
  hasSubscription,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Fixed Left (full height, desktop only) */}
      <Suspense fallback={<div className="w-64 lg:w-16 border-r bg-card" />}>
        <Nav />
      </Suspense>

      {/* Main Content Area - scrolls with the page (header + content) */}
      <div
        className={cn(
          "min-h-screen transition-all duration-300",
          "lg:ml-64",
          isSidebarCollapsed && "lg:!ml-16"
        )}
        style={{
          paddingBottom: "var(--bottom-nav-height, 0px)",
        }}
      >
        {/* Header - scrolls with content (not fixed/sticky) */}
        <MobileHeader hasSubscription={hasSubscription} />

        <main className="w-full max-w-full bg-white dark:bg-background">
          {/* Cancelled Subscription Banner - Inside Content Container */}
          {hasSubscription && (
            <CancelledSubscriptionBanner isSidebarCollapsed={isSidebarCollapsed} />
          )}
          {/* Paused Subscription Banner - Inside Content Container */}
          {hasSubscription && (
            <PausedSubscriptionBanner isSidebarCollapsed={isSidebarCollapsed} />
          )}
          {children}
        </main>
      </div>

      {/* Bottom Navigation - Fixed Bottom (mobile only) */}
      <BottomNav hasSubscription={hasSubscription} />
    </div>
  );
}

