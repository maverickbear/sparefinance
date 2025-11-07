"use client";

import { usePathname, useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { BottomNav } from "@/components/bottom-nav";
import { useEffect, useState, useRef } from "react";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const subscriptionCheckedRef = useRef(false);
  const checkingRef = useRef(false);
  const isApiRoute = pathname?.startsWith("/api");
  const isAuthPage = pathname?.startsWith("/auth");
  const isAcceptPage = pathname?.startsWith("/members/accept");
  const isSelectPlanPage = pathname === "/select-plan";
  const isWelcomePage = pathname === "/welcome";
  const isLandingPage = pathname === "/";
  const isPricingPage = pathname === "/pricing";

  console.log("[LAYOUT-WRAPPER] Render:", {
    pathname,
    isAuthPage,
    isAcceptPage,
    isSelectPlanPage,
    isWelcomePage,
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
      subscriptionChecked: subscriptionCheckedRef.current,
    });

    // Skip subscription check for public pages (auth, accept, landing, pricing) and API routes
    if (isApiRoute || isAuthPage || isAcceptPage || isLandingPage || isPricingPage) {
      console.log("[LAYOUT-WRAPPER] Skipping subscription check for public page or API route");
      setChecking(false);
      setHasSubscription(false);
      return;
    }

    // For protected routes, check subscription immediately
    // If we're on a protected route, assume user has subscription optimistically
    const isProtectedRoute = !isSelectPlanPage && !isWelcomePage;
    const isDashboardRoute = !isAuthPage && !isAcceptPage && !isLandingPage && !isPricingPage && !isApiRoute;
    
    if (isProtectedRoute) {
      // If we're on a dashboard route, show nav optimistically while checking
      if (isDashboardRoute && !subscriptionCheckedRef.current) {
        console.log("[LAYOUT-WRAPPER] Dashboard route detected, showing nav optimistically");
        setHasSubscription(true); // Optimistic update
        setChecking(true);
      }
      
      // Check subscription immediately (no delay for better UX)
      if (!subscriptionCheckedRef.current) {
        console.log("[LAYOUT-WRAPPER] Checking subscription immediately");
        checkSubscription();
      } else {
        console.log("[LAYOUT-WRAPPER] Already checked subscription, skipping");
        setChecking(false);
      }
    } else {
      // For select-plan and welcome pages, we still check subscription but don't block
      console.log("[LAYOUT-WRAPPER] Checking subscription for select-plan/welcome page");
      checkSubscription();
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
    try {
      console.log("[LAYOUT-WRAPPER] checkSubscription: Fetching /api/billing/plans");
      const response = await fetch("/api/billing/plans");
      console.log("[LAYOUT-WRAPPER] checkSubscription: Response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("[LAYOUT-WRAPPER] checkSubscription: Response data:", data);
        // If user has a current plan, they can access the dashboard
        // Note: currentPlanId should always be set (at least "free") if user is authenticated
        if (data.currentPlanId) {
          console.log("[LAYOUT-WRAPPER] checkSubscription: Subscription found, currentPlanId:", data.currentPlanId);
          setHasSubscription(true);
          subscriptionCheckedRef.current = true;
          // If user is on select-plan page and already has a plan, redirect to dashboard
          if (isSelectPlanPage) {
            console.log("[LAYOUT-WRAPPER] checkSubscription: User has plan, redirecting from select-plan to dashboard");
            router.push("/dashboard");
            return;
          }
        } else {
          // User is authenticated but has no plan, redirect to select-plan
          console.log("[LAYOUT-WRAPPER] checkSubscription: No subscription found, currentPlanId:", data.currentPlanId);
          if (!isSelectPlanPage && !isWelcomePage) {
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
        if (!isApiRoute && !isAuthPage && !isAcceptPage && !isSelectPlanPage && !isWelcomePage && !isLandingPage && !isPricingPage) {
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
        
        // For errors, assume no subscription to avoid issues
        setHasSubscription(false);
        subscriptionCheckedRef.current = true;
        
        // Only redirect if we're not already on select-plan or welcome page
        // and if it's not a temporary error (5xx)
        if (!isSelectPlanPage && !isWelcomePage && response.status >= 400 && response.status < 500) {
          console.log("[LAYOUT-WRAPPER] checkSubscription: Client error, redirecting to /select-plan");
          router.push("/select-plan");
          return;
        }
      }
    } catch (error) {
      console.error("[LAYOUT-WRAPPER] checkSubscription: Error:", error);
      // For errors, assume no subscription to avoid issues
      setHasSubscription(false);
      subscriptionCheckedRef.current = true;
      
      // Only redirect on network errors if we're not already on select-plan or welcome page
      if (!isSelectPlanPage && !isWelcomePage) {
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
  const isDashboardRoute = pathname?.startsWith("/dashboard") && !isAuthPage && !isAcceptPage;
  const shouldShowNav = !isApiRoute && !isAuthPage && !isAcceptPage && !isSelectPlanPage && !isWelcomePage && !isLandingPage && !isPricingPage && (hasSubscription || (isDashboardRoute && checking));

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

  // Render API routes and public pages (landing, pricing, auth, accept) without nav
  if (isApiRoute || isAuthPage || isAcceptPage || isLandingPage || isPricingPage) {
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
  const showNav = hasSubscription || (isDashboardRoute && checking);
  console.log("[LAYOUT-WRAPPER] Rendering normal layout with nav", { showNav, hasSubscription, isDashboardRoute, checking });
  return (
    <>
      <div className="flex min-h-screen">
        <Nav hasSubscription={showNav} />
        <main
          className={`flex-1 pb-16 md:pb-0 transition-all duration-300 ${
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

