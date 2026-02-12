"use client";

import { memo, useMemo, useRef, useEffect } from "react";
import { useFixedElementsHeight } from "@/hooks/use-fixed-elements-height";
import { useSubscriptionSafe } from "@/contexts/subscription-context";
import { usePathnameSafe } from "@/hooks/use-pathname-safe";
import { logger } from "@/src/infrastructure/utils/logger";
import { getRouteInfo } from "@/src/presentation/utils/route-utils";
import { useLayoutFixed } from "@/src/presentation/hooks/use-layout-fixed";
import { useSidebarState } from "@/src/presentation/hooks/use-sidebar-state";
import { useProfilePreload } from "@/src/presentation/hooks/use-profile-preload";
import { PublicLayout } from "@/src/presentation/components/layout/public-layout";
import { DashboardLayout } from "@/src/presentation/components/layout/dashboard-layout";

export const LayoutWrapper = memo(function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use safe pathname hook to avoid accessing uncached data during prerender
  const pathname = usePathnameSafe();
  
  // Use safe hook to avoid errors when SubscriptionProvider is not available
  const context = useSubscriptionSafe();
  const subscription = context.subscription;
  const checking = context.checking;
  const hasSubscription = !!subscription;
  
  // Calculate fixed elements height (header + banner)
  useFixedElementsHeight();
  
  // Preload profile data in background
  useProfilePreload();
  
  // Determine route types using centralized utility
  const routeInfo = useMemo(() => getRouteInfo(pathname), [pathname]);
  const { isApiRoute, isPublicPage, isWelcomePage, isDashboardRoute, isAdminRoute } = routeInfo;
  
  // Manage sidebar state
  const { isSidebarCollapsed } = useSidebarState();
  
  // Headers scroll with the page; body is allowed to scroll (no layout-fixed).
  useLayoutFixed(false);
  
  const log = logger.withPrefix("LAYOUT-WRAPPER");
  
  // Track previous render values to only log when they change
  const prevRenderValuesRef = useRef<{
    pathname: string | null;
    checking: boolean;
    hasSubscription: boolean;
    isPublicPage: boolean;
    isDashboardRoute: boolean;
  } | null>(null);

  // Debug log - only log when values actually change
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const currentValues = {
        pathname,
        checking,
        hasSubscription,
        isPublicPage,
        isDashboardRoute,
      };

      const prevValues = prevRenderValuesRef.current;

      // Only log if values have changed
      if (
        !prevValues ||
        prevValues.pathname !== currentValues.pathname ||
        prevValues.checking !== currentValues.checking ||
        prevValues.hasSubscription !== currentValues.hasSubscription ||
        prevValues.isPublicPage !== currentValues.isPublicPage ||
        prevValues.isDashboardRoute !== currentValues.isDashboardRoute
      ) {
        log.debug("Render (values changed):", currentValues);
        prevRenderValuesRef.current = currentValues;
      }
    }
  }, [pathname, checking, hasSubscription, isPublicPage, isDashboardRoute, log]);

  // During SSR/prerender (pathname is null), render children without layout
  if (!pathname) {
    return <>{children}</>;
  }

  // Render API routes, public pages, and admin portal without consumer nav (admin has its own layout)
  if (isApiRoute || isPublicPage || isAdminRoute) {
    return <>{children}</>;
  }

  // If on welcome page or no subscription, show public layout
  if (isWelcomePage || (!hasSubscription && !isDashboardRoute)) {
    return <PublicLayout hasSubscription={false}>{children}</PublicLayout>;
  }

  // Normal dashboard layout for users with subscription or optimistically for dashboard routes
  const showNav = hasSubscription || isDashboardRoute;

  return (
    <DashboardLayout
      isSidebarCollapsed={isSidebarCollapsed}
      hasSubscription={showNav}
    >
      {children}
    </DashboardLayout>
  );
});

