"use client";

import { usePathname, useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { BottomNav } from "@/components/bottom-nav";
import { MobileHeader } from "@/components/mobile-header";
import { useEffect, useState, useRef } from "react";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Determine if this is a dashboard route early to set initial state correctly
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
  const isPublicPage = isAuthPage || isAcceptPage || isLandingPage || isPricingPage || isPrivacyPolicyPage || isTermsOfServicePage || isFAQPage;
  const isDashboardRoute = !isPublicPage && !isApiRoute && !isSelectPlanPage && !isWelcomePage;
  
  // Initialize hasSubscription optimistically for dashboard routes to prevent menu from disappearing on reload
  const [checking, setChecking] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(isDashboardRoute);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const subscriptionCheckedRef = useRef(false);
  const checkingRef = useRef(false);
  const lastCheckedPathnameRef = useRef<string | null>(null);

  console.log("[LAYOUT-WRAPPER] Render:", {
    pathname,
    isAuthPage,
    isAcceptPage,
    isSelectPlanPage,
    isWelcomePage,
    isLandingPage,
    isPricingPage,
    isPrivacyPolicyPage,
    isTermsOfServicePage,
    isFAQPage,
    isPublicPage,
    checking,
    hasSubscription,
    subscriptionChecked: subscriptionCheckedRef.current,
  });

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

  useEffect(() => {
    console.log("[LAYOUT-WRAPPER] useEffect triggered:", {
      pathname,
      isAuthPage,
      isAcceptPage,
      isSelectPlanPage,
      isWelcomePage,
      isPublicPage,
      subscriptionChecked: subscriptionCheckedRef.current,
      lastCheckedPathname: lastCheckedPathnameRef.current,
    });

    // Skip subscription check for public pages (auth, accept, landing, pricing, privacy-policy, terms-of-service, faq) and API routes
    if (isApiRoute || isPublicPage) {
      console.log("[LAYOUT-WRAPPER] Skipping subscription check for public page or API route");
      setChecking(false);
      setHasSubscription(false);
      lastCheckedPathnameRef.current = pathname;
      return;
    }

    // If we already checked for this pathname, skip
    if (lastCheckedPathnameRef.current === pathname && subscriptionCheckedRef.current) {
      console.log("[LAYOUT-WRAPPER] Already checked for this pathname, skipping");
      setChecking(false);
      return;
    }

    // For protected routes, check subscription immediately
    // If we're on a protected route, assume user has subscription optimistically
    const isProtectedRoute = !isSelectPlanPage && !isWelcomePage;
    
    if (isProtectedRoute) {
      // If we're on a dashboard route, show nav optimistically while checking
      // Always set optimistic state for dashboard routes to prevent menu from disappearing
      if (isDashboardRoute) {
        console.log("[LAYOUT-WRAPPER] Dashboard route detected, showing nav optimistically");
        setHasSubscription(true); // Optimistic update - always show menu on dashboard
        if (!subscriptionCheckedRef.current) {
          setChecking(true);
        }
      }
      
      // Check subscription immediately (no delay for better UX)
      if (!subscriptionCheckedRef.current && !checkingRef.current) {
        console.log("[LAYOUT-WRAPPER] Checking subscription immediately");
        checkSubscription();
      } else {
        console.log("[LAYOUT-WRAPPER] Already checking or checked subscription, skipping");
        // Don't set checking to false if we're on dashboard route - keep optimistic state
        if (!isDashboardRoute) {
          setChecking(false);
        }
      }
    } else {
      // For select-plan and welcome pages, we still check subscription but don't block
      // Only check if we haven't checked for this pathname yet
      if (lastCheckedPathnameRef.current !== pathname && !checkingRef.current) {
        console.log("[LAYOUT-WRAPPER] Checking subscription for select-plan/welcome page");
        checkSubscription();
      } else {
        console.log("[LAYOUT-WRAPPER] Already checking or checked for this pathname, skipping");
        setChecking(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function checkSubscription() {
    // Prevent concurrent calls
    if (checkingRef.current) {
      console.log("[LAYOUT-WRAPPER] checkSubscription: Already checking, skipping");
      return;
    }
    
    console.log("[LAYOUT-WRAPPER] checkSubscription: Starting check");
    checkingRef.current = true;
    const currentPathname = pathname;
    lastCheckedPathnameRef.current = currentPathname;
    
    try {
      console.log("[LAYOUT-WRAPPER] checkSubscription: Fetching /api/billing/plans");
      const response = await fetch("/api/billing/plans");
      console.log("[LAYOUT-WRAPPER] checkSubscription: Response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("[LAYOUT-WRAPPER] checkSubscription: Response data:", data);
        // If user has a current plan, they can access the dashboard
        // If currentPlanId is undefined, user must select a plan on /select-plan page
        if (data.currentPlanId) {
          console.log("[LAYOUT-WRAPPER] checkSubscription: Subscription found, currentPlanId:", data.currentPlanId);
          setHasSubscription(true);
          subscriptionCheckedRef.current = true;
          // If user is on select-plan page and already has a plan, redirect to dashboard
          // Only redirect if we're still on the same pathname (avoid redirect loops)
          if (isSelectPlanPage && pathname === currentPathname) {
            console.log("[LAYOUT-WRAPPER] checkSubscription: User has plan, redirecting from select-plan to dashboard");
            router.push("/dashboard");
            return;
          }
        } else {
          // User is authenticated but has no plan, redirect to select-plan
          console.log("[LAYOUT-WRAPPER] checkSubscription: No subscription found, currentPlanId:", data.currentPlanId);
          // Only redirect if we're still on the same pathname and not already on select-plan/welcome
          if (!isSelectPlanPage && !isWelcomePage && pathname === currentPathname) {
            console.log("[LAYOUT-WRAPPER] checkSubscription: Redirecting to /select-plan");
            router.push("/select-plan");
            return;
          }
          setHasSubscription(false);
          subscriptionCheckedRef.current = true;
        }
      } else if (response.status === 401) {
        // User is not authenticated - this is OK for public pages
        console.log("[LAYOUT-WRAPPER] checkSubscription: User not authenticated (401)");
        setHasSubscription(false);
        subscriptionCheckedRef.current = true;
        // Only redirect to login if we're on a protected page (not public pages)
        // Only redirect if we're still on the same pathname
        if (!isApiRoute && !isPublicPage && !isSelectPlanPage && !isWelcomePage && pathname === currentPathname) {
          const currentPath = pathname || "/";
          console.log("[LAYOUT-WRAPPER] checkSubscription: Redirecting to login, path:", currentPath);
          router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
          return;
        }
      } else {
        // If API returns an error, log it but don't redirect immediately
        // This could be a temporary network issue
        console.error("[LAYOUT-WRAPPER] checkSubscription: API returned error status:", response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error("[LAYOUT-WRAPPER] checkSubscription: Error data:", errorData);
        
        // For errors on dashboard routes, keep menu visible optimistically
        // Only set to false if we're not on a dashboard route
        if (!isDashboardRoute) {
          setHasSubscription(false);
        }
        subscriptionCheckedRef.current = true;
        
        // Only redirect if we're not already on select-plan or welcome page
        // and if it's not a temporary error (5xx)
        // Only redirect if we're still on the same pathname
        if (!isSelectPlanPage && !isWelcomePage && response.status >= 400 && response.status < 500 && pathname === currentPathname) {
          console.log("[LAYOUT-WRAPPER] checkSubscription: Client error, redirecting to /select-plan");
          router.push("/select-plan");
          return;
        }
      }
    } catch (error) {
      console.error("[LAYOUT-WRAPPER] checkSubscription: Error:", error);
      // For errors on dashboard routes, keep menu visible optimistically
      // Only set to false if we're not on a dashboard route
      if (!isDashboardRoute) {
        setHasSubscription(false);
      }
      subscriptionCheckedRef.current = true;
      
      // Only redirect on network errors if we're not already on select-plan or welcome page
      // Only redirect if we're still on the same pathname
      if (!isSelectPlanPage && !isWelcomePage && pathname === currentPathname) {
        // Check if it's a network error
        if (error instanceof TypeError && error.message.includes("fetch")) {
          console.log("[LAYOUT-WRAPPER] checkSubscription: Network error, redirecting to /select-plan");
          router.push("/select-plan");
          return;
        }
      }
    } finally {
      console.log("[LAYOUT-WRAPPER] checkSubscription: Finished, setting checking to false");
      setChecking(false);
      checkingRef.current = false;
    }
  }

  // Always render Nav and BottomNav to maintain consistent hook order
  // They will return null internally if hasSubscription is false or on auth pages
  // Show nav optimistically if we're on a dashboard route and checking
  const shouldShowNav = !isApiRoute && !isPublicPage && !isSelectPlanPage && !isWelcomePage && (hasSubscription || isDashboardRoute);

  console.log("[LAYOUT-WRAPPER] Render decision:", {
    shouldShowNav,
    checking,
    hasSubscription,
    isAuthPage,
    isAcceptPage,
    isSelectPlanPage,
    isWelcomePage,
    isApiRoute,
    isDashboardRoute,
  });

  // Render API routes and public pages (landing, pricing, auth, accept, privacy-policy, terms-of-service, faq) without nav
  if (isApiRoute || isPublicPage) {
    console.log("[LAYOUT-WRAPPER] Rendering public page or API route");
    return <>{children}</>;
  }

  // If checking and we're NOT on dashboard route, show loading state
  if (checking && !isSelectPlanPage && !isWelcomePage && !isDashboardRoute) {
    console.log("[LAYOUT-WRAPPER] Rendering loading state");
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
    console.log("[LAYOUT-WRAPPER] Rendering select-plan/welcome page");
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
    console.log("[LAYOUT-WRAPPER] Rendering no subscription state");
    return (
      <>
        <Nav hasSubscription={false} />
        <BottomNav hasSubscription={false} />
        {children}
      </>
    );
  }

  // Normal layout with nav for users with subscription or optimistically for dashboard routes
  // Always show nav on dashboard routes to prevent it from disappearing on reload
  const showNav = hasSubscription || isDashboardRoute;
  console.log("[LAYOUT-WRAPPER] Rendering normal layout with nav", { showNav, hasSubscription, isDashboardRoute, checking });
  return (
    <>
      <MobileHeader hasSubscription={showNav} />
      <div className="flex min-h-screen">
        <Nav hasSubscription={showNav} />
        <main
          className={`flex-1 pb-16 md:pb-0 pt-16 md:pt-0 transition-all duration-300 ${
            isSidebarCollapsed ? "md:ml-16" : "md:ml-64"
          }`}
        >
          <div className="container mx-auto px-4 py-4 md:py-8">{children}</div>
        </main>
      </div>
      <BottomNav hasSubscription={showNav} />
    </>
  );
}

