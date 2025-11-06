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
  const subscriptionCheckedRef = useRef(false);
  const checkingRef = useRef(false);
  const isAuthPage = pathname?.startsWith("/auth");
  const isAcceptPage = pathname?.startsWith("/members/accept");
  const isSelectPlanPage = pathname === "/select-plan";
  const isWelcomePage = pathname === "/welcome";

  useEffect(() => {
    // Check subscription for authenticated users
    // Only check once per session unless on select-plan or welcome page
    if (!isAuthPage && !isAcceptPage && !isSelectPlanPage && !isWelcomePage) {
      // Only check if we haven't checked before
      if (!subscriptionCheckedRef.current) {
        checkSubscription();
      } else {
        setChecking(false);
      }
    } else {
      // For select-plan and welcome pages, we still check subscription but don't block
      if (isSelectPlanPage || isWelcomePage) {
        checkSubscription();
      } else {
        setChecking(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function checkSubscription() {
    // Prevent concurrent calls
    if (checkingRef.current) {
      return;
    }
    
    checkingRef.current = true;
    try {
      const response = await fetch("/api/billing/plans");
      if (response.ok) {
        const data = await response.json();
        // If user has a current plan, they can access the dashboard
        // Note: currentPlanId should always be set (at least "free") if user is authenticated
        if (data.currentPlanId) {
          console.log("[LAYOUT] Subscription found, currentPlanId:", data.currentPlanId);
          setHasSubscription(true);
          subscriptionCheckedRef.current = true;
          // If user is on select-plan page and already has a plan, redirect to dashboard
          if (isSelectPlanPage) {
            console.log("[LAYOUT] User has plan, redirecting from select-plan to dashboard");
            router.push("/");
            return;
          }
        } else {
          // User is authenticated but has no plan, redirect to select-plan
          console.log("[LAYOUT] No subscription found, currentPlanId:", data.currentPlanId);
          if (!isSelectPlanPage && !isWelcomePage) {
            console.log("[LAYOUT] Redirecting to /select-plan");
            router.push("/select-plan");
            return;
          }
          setHasSubscription(false);
          subscriptionCheckedRef.current = true;
        }
      } else if (response.status === 401) {
        // User is not authenticated, redirect to login
        console.log("[LAYOUT] User not authenticated, redirecting to login");
        if (!isAuthPage && !isAcceptPage) {
          const currentPath = pathname || "/";
          router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
          return;
        }
        setHasSubscription(false);
        subscriptionCheckedRef.current = true;
      } else {
        // If API returns an error, log it but don't redirect immediately
        // This could be a temporary network issue
        console.error("[LAYOUT] API returned error status:", response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error("[LAYOUT] Error data:", errorData);
        
        // Only redirect if we're not already on select-plan or welcome page
        // and if it's not a temporary error (5xx)
        if (!isSelectPlanPage && !isWelcomePage && response.status >= 400 && response.status < 500) {
          console.log("[LAYOUT] Client error, redirecting to /select-plan");
          router.push("/select-plan");
          return;
        }
        
        // For server errors, assume subscription exists to avoid redirect loops
        setHasSubscription(true);
        subscriptionCheckedRef.current = true;
      }
    } catch (error) {
      console.error("[LAYOUT] Error checking subscription:", error);
      // Only redirect on network errors if we're not already on select-plan or welcome page
      // For other errors, assume subscription exists to avoid redirect loops
      if (!isSelectPlanPage && !isWelcomePage) {
        // Check if it's a network error
        if (error instanceof TypeError && error.message.includes("fetch")) {
          console.log("[LAYOUT] Network error, redirecting to /select-plan");
          router.push("/select-plan");
          return;
        }
      }
      // For other errors, assume subscription exists
      setHasSubscription(true);
      subscriptionCheckedRef.current = true;
    } finally {
      setChecking(false);
      checkingRef.current = false;
    }
  }

  if (isAuthPage || isAcceptPage) {
    return <>{children}</>;
  }

  if (checking && !isSelectPlanPage && !isWelcomePage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If on select-plan or welcome page, show full screen without nav
  if (isSelectPlanPage || isWelcomePage) {
    return <>{children}</>;
  }

  // If no subscription, show full screen without nav (shouldn't reach here due to redirect)
  if (!hasSubscription) {
    return <>{children}</>;
  }

  // Normal layout with nav for users with subscription
  return (
    <>
      <div className="flex min-h-screen">
        <Nav hasSubscription={hasSubscription} />
        <main className="flex-1 md:ml-64 pb-16 md:pb-0">
          <div className="container mx-auto px-4 py-4 md:py-8">{children}</div>
        </main>
      </div>
      <BottomNav hasSubscription={hasSubscription} />
    </>
  );
}

