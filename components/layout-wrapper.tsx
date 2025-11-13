"use client";

import { Nav } from "@/components/nav";
import { BottomNav } from "@/components/bottom-nav";
import { MobileHeader } from "@/components/mobile-header";
import { MobileBanner } from "@/components/mobile-banner";
import { DesktopHeader } from "@/components/desktop-header";
import { useFixedElementsHeight } from "@/hooks/use-fixed-elements-height";
import { useEffect, useState } from "react";
import { useSubscriptionContext } from "@/contexts/subscription-context";
import { usePathname } from "next/navigation";
import { logger } from "@/lib/utils/logger";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hasSubscription, checking } = useSubscriptionContext();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Calculate fixed elements height (header + banner)
  useFixedElementsHeight();
  
  // Determine route types
  const isApiRoute = pathname?.startsWith("/api");
  const isAuthPage = pathname?.startsWith("/auth");
  const isAcceptPage = pathname?.startsWith("/members/accept");
  const isSelectPlanPage = pathname === "/select-plan";
  const isWelcomePage = pathname === "/welcome";
  const isLandingPage = pathname === "/";
  const isPricingPage = pathname === "/pricing";
  const isPrivacyPolicyPage = pathname === "/privacy-policy";
  const isTermsOfServicePage = pathname === "/terms-of-service";
  const isFAQPage = pathname === "/faq";
  const isSubscriptionSuccessPage = pathname === "/subscription/success";
  const isPublicPage = isAuthPage || isAcceptPage || isLandingPage || isPricingPage || isPrivacyPolicyPage || isTermsOfServicePage || isFAQPage || isSubscriptionSuccessPage;
  const isDashboardRoute = !isPublicPage && !isApiRoute && !isSelectPlanPage && !isWelcomePage;
  
  const log = logger.withPrefix("LAYOUT-WRAPPER");

  // Listen for sidebar toggle events
  useEffect(() => {
    // Load initial state from localStorage
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setIsSidebarCollapsed(saved === "true");
    }

    const handleSidebarToggle = (event: CustomEvent<{ isCollapsed: boolean }>) => {
      setIsSidebarCollapsed(event.detail.isCollapsed);
    };

    window.addEventListener("sidebar-toggle", handleSidebarToggle as EventListener);

    return () => {
      window.removeEventListener("sidebar-toggle", handleSidebarToggle as EventListener);
    };
  }, []);

  log.log("Render:", {
    pathname,
    checking,
    hasSubscription,
    isPublicPage,
    isDashboardRoute,
  });

  // Render API routes and public pages without nav
  if (isApiRoute || isPublicPage) {
    return <>{children}</>;
  }

  // If checking and we're NOT on dashboard route, show loading state
  if (checking && !isSelectPlanPage && !isWelcomePage && !isDashboardRoute) {
    return (
      <>
        <Nav hasSubscription={false} />
        <BottomNav hasSubscription={false} />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </>
    );
  }

  // If on select-plan or welcome page, show full screen without nav
  if (isSelectPlanPage || isWelcomePage) {
    return (
      <>
        <Nav hasSubscription={false} />
        <BottomNav hasSubscription={false} />
        {children}
      </>
    );
  }

  // If no subscription and not on dashboard route, show full screen without nav
  // (shouldn't reach here due to redirect, but handle it gracefully)
  if (!hasSubscription && !isDashboardRoute) {
    return (
      <>
        <Nav hasSubscription={false} />
        <BottomNav hasSubscription={false} />
        {children}
      </>
    );
  }

  // Normal layout with nav for users with subscription or optimistically for dashboard routes
  const showNav = hasSubscription || isDashboardRoute;
  return (
    <>
      <MobileHeader hasSubscription={showNav} />
      <MobileBanner hasSubscription={showNav} />
      <DesktopHeader hasSubscription={showNav} />
      <div className="flex">
        <Nav hasSubscription={showNav} />
        <main
          className={`flex-1 pb-16 lg:pb-0 transition-all duration-300 bg-white dark:bg-background z-0 ${
            isSidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
          }`}
        >
          <div 
            className="w-full container mx-auto px-4 sm:px-6 lg:px-8 pb-6 z-0"
            style={{
              paddingTop: 'var(--fixed-elements-height, 0px)',
            }}
          >
            {children}
          </div>
        </main>
      </div>
      <BottomNav hasSubscription={showNav} />
    </>
  );
}

