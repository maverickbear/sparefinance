"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logger } from "@/lib/utils/logger";

interface SubscriptionCheckResult {
  hasSubscription: boolean;
  checking: boolean;
  currentPlanId?: string;
}

/**
 * Hook customizado para centralizar lógica de verificação de subscription
 * Evita duplicação de código entre layout-wrapper e outros componentes
 */
export function useSubscription() {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>();
  
  const subscriptionCheckedRef = useRef(false);
  const checkingRef = useRef(false);
  const lastCheckedPathnameRef = useRef<string | null>(null);
  
  const log = logger.withPrefix("use-subscription");

  // Determinar se é uma página pública
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

  const checkSubscription = useCallback(async () => {
    // Prevent concurrent calls
    if (checkingRef.current) {
      log.log("Already checking, skipping");
      return;
    }
    
    log.log("Starting check");
    checkingRef.current = true;
    const currentPathname = pathname;
    lastCheckedPathnameRef.current = currentPathname;
    
    try {
      log.log("Fetching /api/billing/plans");
      const response = await fetch("/api/billing/plans");
      log.log("Response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        log.log("Response data:", data);
        
        if (data.currentPlanId) {
          log.log("Subscription found, currentPlanId:", data.currentPlanId);
          setHasSubscription(true);
          setCurrentPlanId(data.currentPlanId);
          subscriptionCheckedRef.current = true;
          
          // If user is on select-plan page and already has a plan, redirect to dashboard
          if (isSelectPlanPage && pathname === currentPathname) {
            log.log("User has plan, redirecting from select-plan to dashboard");
            router.push("/dashboard");
            return;
          }
        } else {
          log.log("No subscription found");
          setHasSubscription(false);
          setCurrentPlanId(undefined);
          subscriptionCheckedRef.current = true;
          
          // No subscription - modal will open automatically via SubscriptionGuard
          // Only redirect if we're on select-plan page to dashboard
          if (isSelectPlanPage && pathname === currentPathname) {
            log.log("No subscription, redirecting from select-plan to dashboard (modal will open)");
            router.push("/dashboard");
            return;
          }
        }
      } else if (response.status === 401) {
        log.log("User not authenticated (401)");
        setHasSubscription(false);
        setCurrentPlanId(undefined);
        subscriptionCheckedRef.current = true;
        
        // Only redirect to login if we're on a protected page
        if (!isApiRoute && !isPublicPage && !isSelectPlanPage && !isWelcomePage && pathname === currentPathname) {
          const currentPath = pathname || "/";
          log.log("Redirecting to login, path:", currentPath);
          router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
          return;
        }
      } else {
        log.error("API returned error status:", response.status);
        const errorData = await response.json().catch(() => ({}));
        log.error("Error data:", errorData);
        
        // For errors on dashboard routes, keep menu visible optimistically
        if (!isDashboardRoute) {
          setHasSubscription(false);
        }
        subscriptionCheckedRef.current = true;
        
        // Client error - modal will open automatically via SubscriptionGuard if needed
        // Only redirect if we're on select-plan page to dashboard
        if (isSelectPlanPage && pathname === currentPathname) {
          log.log("Client error, redirecting from select-plan to dashboard (modal will open)");
          router.push("/dashboard");
          return;
        }
      }
    } catch (error) {
      log.error("Error:", error);
      
      // For errors on dashboard routes, keep menu visible optimistically
      if (!isDashboardRoute) {
        setHasSubscription(false);
      }
      subscriptionCheckedRef.current = true;
      
      // Network error - modal will open automatically via SubscriptionGuard if needed
      // Only redirect if we're on select-plan page to dashboard
      if (isSelectPlanPage && pathname === currentPathname) {
        if (error instanceof TypeError && error.message.includes("fetch")) {
          log.log("Network error, redirecting from select-plan to dashboard (modal will open)");
          router.push("/dashboard");
          return;
        }
      }
    } finally {
      log.log("Finished, setting checking to false");
      setChecking(false);
      checkingRef.current = false;
    }
  }, [pathname, router, isApiRoute, isPublicPage, isSelectPlanPage, isWelcomePage, isDashboardRoute, log]);

  useEffect(() => {
    log.log("useEffect triggered:", {
      pathname,
      isPublicPage,
      subscriptionChecked: subscriptionCheckedRef.current,
      lastCheckedPathname: lastCheckedPathnameRef.current,
    });

    // Skip subscription check for public pages and API routes
    if (isApiRoute || isPublicPage) {
      log.log("Skipping subscription check for public page or API route");
      setChecking(false);
      setHasSubscription(false);
      lastCheckedPathnameRef.current = pathname;
      return;
    }

    // If we already checked for this pathname, skip
    if (lastCheckedPathnameRef.current === pathname && subscriptionCheckedRef.current) {
      log.log("Already checked for this pathname, skipping");
      setChecking(false);
      return;
    }

    // For protected routes, check subscription immediately
    const isProtectedRoute = !isSelectPlanPage && !isWelcomePage;
    
    if (isProtectedRoute) {
      // If we're on a dashboard route, show nav optimistically while checking
      if (isDashboardRoute) {
        log.log("Dashboard route detected, showing nav optimistically");
        setHasSubscription(true); // Optimistic update
        if (!subscriptionCheckedRef.current) {
          setChecking(true);
        }
      }
      
      // Check subscription immediately
      if (!subscriptionCheckedRef.current && !checkingRef.current) {
        log.log("Checking subscription immediately");
        checkSubscription();
      } else {
        log.log("Already checking or checked subscription, skipping");
        if (!isDashboardRoute) {
          setChecking(false);
        }
      }
    } else {
      // For select-plan and welcome pages, we still check subscription but don't block
      if (lastCheckedPathnameRef.current !== pathname && !checkingRef.current) {
        log.log("Checking subscription for select-plan/welcome page");
        checkSubscription();
      } else {
        log.log("Already checking or checked for this pathname, skipping");
        setChecking(false);
      }
    }
  }, [pathname, isApiRoute, isPublicPage, isSelectPlanPage, isWelcomePage, isDashboardRoute, checkSubscription, log]);

  // Initialize hasSubscription optimistically for dashboard routes
  useEffect(() => {
    if (isDashboardRoute && !subscriptionCheckedRef.current) {
      setHasSubscription(true);
    }
  }, [isDashboardRoute]);

  return {
    hasSubscription: hasSubscription || isDashboardRoute, // Optimistic for dashboard routes
    checking,
    currentPlanId,
    isPublicPage,
    isDashboardRoute,
  } as SubscriptionCheckResult & { isPublicPage: boolean; isDashboardRoute: boolean };
}

