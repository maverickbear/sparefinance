"use client";

import { Nav } from "@/components/nav";
import { BottomNav } from "@/components/bottom-nav";
import { MobileHeader } from "@/components/mobile-header";
import { CancelledSubscriptionBanner } from "@/components/common/cancelled-subscription-banner";
import { PausedSubscriptionBanner } from "@/src/presentation/components/features/subscriptions/paused-subscription-banner";
import { useFixedElementsHeight } from "@/hooks/use-fixed-elements-height";
import { useEffect, useState, memo, useMemo } from "react";
import { useSubscriptionContext } from "@/contexts/subscription-context";
import { usePathname } from "next/navigation";
import { logger } from "@/src/infrastructure/utils/logger";
import { cn } from "@/lib/utils";

// Preload profile data hook - loads profile in background when app starts
function useProfilePreload() {
  useEffect(() => {
    // Preload profile data in background when app loads
    // This ensures profile data is ready when user navigates to settings
    // The cache in settings/page.tsx will handle this efficiently
    const preloadProfile = async () => {
      try {
        await fetch("/api/v2/profile");
      } catch (error) {
        // Silently fail - data will load when needed
        console.debug("Profile preload failed:", error);
      }
    };

    // Small delay to not block initial page load
    const timer = setTimeout(preloadProfile, 300);
    return () => clearTimeout(timer);
  }, []);
}

export const LayoutWrapper = memo(function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Try to get subscription context, but handle case where it might not be available (public pages)
  let subscription = null;
  let checking = false;
  try {
    const context = useSubscriptionContext();
    subscription = context.subscription;
    checking = context.checking;
  } catch {
    // SubscriptionProvider not available (public pages)
  }
  const hasSubscription = !!subscription;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Calculate fixed elements height (header + banner)
  useFixedElementsHeight();
  
  // Preload profile data in background
  useProfilePreload();
  
  // Determine route types - memoized to avoid recalculation
  const routeInfo = useMemo(() => {
    const isApiRoute = pathname?.startsWith("/api");
    const isAuthPage = pathname?.startsWith("/auth");
    const isAcceptPage = pathname?.startsWith("/members/accept");
    const isSelectPlanPage = pathname === "/select-plan";
    const isWelcomePage = pathname === "/welcome";
    const isLandingPage = pathname === "/";
    const isPrivacyPolicyPage = pathname === "/privacy-policy";
    const isTermsOfServicePage = pathname === "/terms-of-service";
    const isFAQPage = pathname === "/faq";
    const isSubscriptionSuccessPage = pathname === "/subscription/success";
    const isMaintenancePage = pathname === "/maintenance";
    const isPublicPage = isAuthPage || isAcceptPage || isLandingPage || isPrivacyPolicyPage || isTermsOfServicePage || isFAQPage || isSubscriptionSuccessPage || isMaintenancePage;
    const isDashboardRoute = !isPublicPage && !isApiRoute && !isSelectPlanPage && !isWelcomePage;
    
    return {
      isApiRoute,
      isPublicPage,
      isSelectPlanPage,
      isWelcomePage,
      isDashboardRoute,
    };
  }, [pathname]);
  
  const { isApiRoute, isPublicPage, isSelectPlanPage, isWelcomePage, isDashboardRoute } = routeInfo;
  
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

  // Add class to body/html to prevent scroll - must be called before any conditional returns
  // Only apply to protected pages (not public pages, API routes, select-plan, or welcome)
  const shouldUseFixedLayout = !isApiRoute && !isPublicPage && !isSelectPlanPage && !isWelcomePage && (hasSubscription || isDashboardRoute);
  
  useEffect(() => {
    if (shouldUseFixedLayout) {
      document.body.classList.add('layout-fixed');
      document.documentElement.classList.add('layout-fixed');
      return () => {
        document.body.classList.remove('layout-fixed');
        document.documentElement.classList.remove('layout-fixed');
      };
    } else {
      // Ensure classes are removed if we're not using fixed layout
      document.body.classList.remove('layout-fixed');
      document.documentElement.classList.remove('layout-fixed');
    }
  }, [shouldUseFixedLayout]);

  // Removed debug log to improve performance - only log in development if needed
  if (process.env.NODE_ENV === 'development') {
    log.debug("Render:", {
      pathname,
      checking,
      hasSubscription,
      isPublicPage,
      isDashboardRoute,
    });
  }

  // Render API routes and public pages without nav
  if (isApiRoute || isPublicPage) {
    return <>{children}</>;
  }

  // Removed loading state that blocks navigation - allow instant navigation
  // Subscription check happens in background and doesn't block navigation

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
  
  // Debug: Log subscription status for banner visibility
  if (process.env.NODE_ENV === 'development') {
    log.debug("Banner visibility check:", {
      showNav,
      hasSubscription,
      subscriptionStatus: subscription?.status,
      isDashboardRoute,
    });
  }
  
  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      {/* Sidebar - Fixed Left (full height, desktop only) */}
      <Nav hasSubscription={showNav} />
      
      {/* Main Content Area */}
      <div
        className={cn(
          "flex flex-col h-full overflow-hidden transition-all duration-300",
          "lg:ml-64",
          isSidebarCollapsed && "lg:!ml-16"
        )}
      >
        {/* Headers - Fixed Top */}
        <MobileHeader hasSubscription={showNav} />
        
        {/* Content Container - Scrollable */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-background"
          style={{
            paddingBottom: 'var(--bottom-nav-height, 0px)',
          }}
        >
          <div className="w-full max-w-full">
            {/* Cancelled Subscription Banner - Inside Content Container */}
            {showNav && <CancelledSubscriptionBanner isSidebarCollapsed={isSidebarCollapsed} />}
            {/* Paused Subscription Banner - Inside Content Container */}
            {showNav && <PausedSubscriptionBanner isSidebarCollapsed={isSidebarCollapsed} />}
            {children}
          </div>
        </main>
      </div>
      
      {/* Bottom Navigation - Fixed Bottom (mobile only) */}
      <BottomNav hasSubscription={showNav} />
    </div>
  );
});

