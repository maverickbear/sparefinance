/**
 * Route Type Utilities
 * Determines route types for layout rendering decisions
 */

export interface RouteInfo {
  isApiRoute: boolean;
  isPublicPage: boolean;
  isWelcomePage: boolean;
  isDashboardRoute: boolean;
}

/**
 * Determine route information from pathname
 * @param pathname - Current pathname (can be null during SSR)
 * @returns Route information object
 */
export function getRouteInfo(pathname: string | null): RouteInfo {
  // During SSR/prerender (pathname is null), default to safe values
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
  const isDesignPage = pathname.startsWith("/design");
  
  const isPublicPage =
    isAuthPage ||
    isAcceptPage ||
    isLandingPage ||
    isPrivacyPolicyPage ||
    isTermsOfServicePage ||
    isFAQPage ||
    isSubscriptionSuccessPage ||
    isMaintenancePage ||
    isDesignPage;
  
  const isDashboardRoute = !isPublicPage && !isApiRoute && !isWelcomePage;

  return {
    isApiRoute,
    isPublicPage,
    isWelcomePage,
    isDashboardRoute,
  };
}

