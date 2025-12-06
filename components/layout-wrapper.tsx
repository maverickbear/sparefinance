"use client";

import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { BottomNav } from "@/components/bottom-nav";
import { MobileHeader } from "@/components/mobile-header";
import { CancelledSubscriptionBanner } from "@/components/common/cancelled-subscription-banner";
import { PausedSubscriptionBanner } from "@/src/presentation/components/features/subscriptions/paused-subscription-banner";
import { useFixedElementsHeight } from "@/hooks/use-fixed-elements-height";
import { useEffect, useState, memo, useMemo, useRef } from "react";
import { useSubscriptionContext, useSubscriptionSafe } from "@/contexts/subscription-context";
import { usePathnameSafe } from "@/hooks/use-pathname-safe";
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
  // Use safe pathname hook to avoid accessing uncached data during prerender
  const pathname = usePathnameSafe();
  // Use safe hook to avoid errors when SubscriptionProvider is not available (public pages, prerendering)
  // This prevents "uncached data accessed" errors during build time
  const context = useSubscriptionSafe();
  const subscription = context.subscription;
  const checking = context.checking;
  const hasSubscription = !!subscription;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Calculate fixed elements height (header + banner)
  useFixedElementsHeight();
  
  // Preload profile data in background
  useProfilePreload();
  
  // Determine route types - memoized to avoid recalculation
  // During SSR/prerender (pathname is null), default to safe values that won't break rendering
  const routeInfo = useMemo(() => {
    // If pathname is not available (during SSR/prerender), use safe defaults
    if (!pathname) {
      return {
        isApiRoute: false,
        isPublicPage: false,
        isWelcomePage: false,
        isDashboardRoute: false,
      };
    }
    
    const isApiRoute = pathname.startsWith("/api");
    const isAuthPage = pathname.startsWith("/auth");
    const isAcceptPage = pathname.startsWith("/members/accept");
    const isWelcomePage = pathname === "/welcome";
    const isLandingPage = pathname === "/";
    const isPrivacyPolicyPage = pathname === "/privacy-policy";
    const isTermsOfServicePage = pathname === "/terms-of-service";
    const isFAQPage = pathname === "/faq";
    const isSubscriptionSuccessPage = pathname === "/subscription/success";
    const isMaintenancePage = pathname === "/maintenance";
    const isPublicPage = isAuthPage || isAcceptPage || isLandingPage || isPrivacyPolicyPage || isTermsOfServicePage || isFAQPage || isSubscriptionSuccessPage || isMaintenancePage;
    const isDashboardRoute = !isPublicPage && !isApiRoute && !isWelcomePage;
    
    return {
      isApiRoute,
      isPublicPage,
      isWelcomePage,
      isDashboardRoute,
    };
  }, [pathname]);
  
  const { isApiRoute, isPublicPage, isWelcomePage, isDashboardRoute } = routeInfo;
  
  const log = logger.withPrefix("LAYOUT-WRAPPER");
  
  // Track previous render values to only log when they change
  const prevRenderValuesRef = useRef<{
    pathname: string | null;
    checking: boolean;
    hasSubscription: boolean;
    isPublicPage: boolean;
    isDashboardRoute: boolean;
  } | null>(null);

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
  // Only apply to protected pages (not public pages, API routes, or welcome)
  const shouldUseFixedLayout = !isApiRoute && !isPublicPage && !isWelcomePage && (hasSubscription || isDashboardRoute);
  
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

  // Debug log - only log when values actually change (not on every render)
  // This reduces console noise from React Strict Mode double renders
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const currentValues = {
        pathname,
        checking,
        hasSubscription,
        isPublicPage,
        isDashboardRoute,
      };
      
      const prevValues = prevRenderValuesRef.current;
      
      // Only log if values have changed
      if (!prevValues || 
          prevValues.pathname !== currentValues.pathname ||
          prevValues.checking !== currentValues.checking ||
          prevValues.hasSubscription !== currentValues.hasSubscription ||
          prevValues.isPublicPage !== currentValues.isPublicPage ||
          prevValues.isDashboardRoute !== currentValues.isDashboardRoute) {
        log.debug("Render (values changed):", currentValues);
        prevRenderValuesRef.current = currentValues;
      }
    }
  }, [pathname, checking, hasSubscription, isPublicPage, isDashboardRoute, log]);

  // During SSR/prerender (pathname is null), render children without layout
  // This prevents errors during build time
  if (!pathname) {
    return <>{children}</>;
  }

  // Render API routes and public pages without nav
  if (isApiRoute || isPublicPage) {
    return <>{children}</>;
  }

  // Removed loading state that blocks navigation - allow instant navigation
  // Subscription check happens in background and doesn't block navigation

  // If on welcome page, show full screen without nav
  if (isWelcomePage) {
    return (
      <>
        <Nav />
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
        <Nav />
        <BottomNav hasSubscription={false} />
        {children}
      </>
    );
  }

  // Normal layout with nav for users with subscription or optimistically for dashboard routes
  const showNav = hasSubscription || isDashboardRoute;
  
  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      {/* Sidebar - Fixed Left (full height, desktop only) */}
      <Suspense fallback={<div className="w-64 lg:w-16 border-r bg-card" />}>
        <Nav />
      </Suspense>
      
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

