import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { getCurrentUserSubscriptionData, invalidateSubscriptionCache, type Subscription, type Plan } from "@/lib/api/subscription";
import { verifyUserExists } from "@/lib/utils/verify-user-exists";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { Suspense } from "react";
import { logger } from "@/src/infrastructure/utils/logger";

/**
 * Protected Layout
 * 
 * This layout protects routes that require both authentication and subscription.
 * It verifies:
 * 1. User is authenticated
 * 2. User exists in User table
 * 3. User has an active subscription (at least "free" plan)
 * 
 * If user is not authenticated, redirects to /auth/login with redirect parameter
 * If user doesn't exist in User table, logs out and redirects to /auth/login
 * If user is authenticated but has no subscription, redirects to pricing page
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const log = logger.withPrefix("PROTECTED-LAYOUT");
  const supabase = await createServerClient();
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    // Get current pathname for redirect
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
    const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
    redirect(redirectUrl);
  }

  // PERFORMANCE OPTIMIZATION: Combine user verification and data fetching into single query
  // This avoids multiple sequential queries to the User table
  let userData: { id: string; isBlocked: boolean; role: string } | null = null;
  try {
    const { data, error: userError } = await supabase
      .from("User")
      .select("id, isBlocked, role")
      .eq("id", user.id)
      .single();

    if (userError || !data) {
      // User doesn't exist in User table, log out
      console.warn(`[PROTECTED-LAYOUT] User ${user.id} authenticated but not found in User table. Logging out.`);
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        log.error("Error signing out:", signOutError);
      }
      const headersList = await headers();
      const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
      const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
      redirect(redirectUrl);
    }

    userData = data;
  } catch (error) {
    log.error("Error fetching user data:", error);
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
    const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
    redirect(redirectUrl);
  }

  const userId = userData.id;

  // Check if user is blocked
  if (userData.isBlocked && userData.role !== "super_admin") {
    log.debug("User is blocked, redirecting to account blocked page");
    // Sign out the user
    await supabase.auth.signOut();
    redirect("/account-blocked");
  }

  // Check maintenance mode
  let isMaintenanceMode = false;
  try {
    const serviceSupabase = createServiceRoleClient();
    const { data: settings } = await serviceSupabase
      .from("SystemSettings")
      .select("maintenanceMode")
      .eq("id", "default")
      .single();

    isMaintenanceMode = settings?.maintenanceMode || false;
  } catch (error) {
    // If error checking maintenance mode, log but don't block access
    log.error("Error checking maintenance mode:", error);
  }

  if (isMaintenanceMode) {
    // Use already fetched userData instead of querying again
    // If not super_admin, redirect to maintenance page
    // Note: redirect() throws a special error that Next.js uses for navigation
    // We don't catch it here so Next.js can handle it properly
    if (userData?.role !== "super_admin") {
      log.debug("Maintenance mode active, redirecting non-super_admin user to maintenance page");
      redirect("/maintenance");
    }
    // super_admin can continue normally
    log.debug("Maintenance mode active, but user is super_admin - allowing access");
  }

  // Check subscription - use unified API (single source of truth)
  let shouldOpenModal = false;
  let reason: "no_subscription" | "trial_expired" | "subscription_inactive" | undefined;
  let subscription: Subscription | null = null;
  let plan: Plan | null = null;
  
  try {
    // Get subscription data using unified API (already has internal caching)
    // Note: We don't invalidate cache here to avoid performance issues
    // If subscription is not found, it may be a real issue or cache problem
    const subscriptionData = await getCurrentUserSubscriptionData();
    subscription = subscriptionData.subscription;
    plan = subscriptionData.plan;
    
    log.debug("Subscription check result:", {
      hasSubscription: !!subscription,
      subscriptionId: subscription?.id,
      planId: subscription?.planId,
      status: subscription?.status,
      userId: userId,
      hasPlan: !!plan,
      planIdFromPlan: plan?.id,
    });
    
    // If no subscription found, try to invalidate cache and check again
    // This handles cases where cache might be stale
    if (!subscription && userId) {
      log.debug("No subscription found in first attempt, invalidating cache and retrying");
      await invalidateSubscriptionCache(userId);
      const retryData = await getCurrentUserSubscriptionData();
      subscription = retryData.subscription;
      plan = retryData.plan;
      
      log.debug("Subscription check result after cache invalidation:", {
        hasSubscription: !!subscription,
        subscriptionId: subscription?.id,
        planId: subscription?.planId,
        status: subscription?.status,
        userId: userId,
        hasPlan: !!plan,
        planIdFromPlan: plan?.id,
      });
    }
    
    // If no subscription found after retry, user needs to select a plan
    if (!subscription) {
      log.debug("No subscription found after retry, redirecting to pricing");
      shouldOpenModal = true;
      reason = "no_subscription";
    } else {
      // Check if subscription status allows access
      const isActiveStatus = subscription.status === "active";
      const isTrialingStatus = subscription.status === "trialing";
      
      // If subscription exists and status is active or trialing, allow access
      if (isActiveStatus || isTrialingStatus) {
        shouldOpenModal = false;
      } else {
        // Only open modal for "past_due" status
        if (subscription.status === "past_due") {
          log.debug("Subscription is past_due, redirecting to pricing");
          shouldOpenModal = true;
          reason = "subscription_inactive";
        } else {
          // Allow access for other statuses (cancelled, expired, etc.)
          log.debug("Subscription has other status, allowing access:", subscription.status);
          shouldOpenModal = false;
        }
      }
      
      log.debug("Subscription status check:", {
        status: subscription.status,
        isActive: isActiveStatus,
        isTrialing: isTrialingStatus,
        shouldOpenModal,
      });
    }
  } catch (error) {
    // If error checking subscription, open modal
    log.error("Error checking subscription:", error);
    shouldOpenModal = true;
    reason = "no_subscription";
  }

  return (
    <SubscriptionProvider initialData={{ subscription, plan }}>
      <Suspense fallback={null}>
        <SubscriptionGuard shouldOpenModal={shouldOpenModal} reason={reason} />
      </Suspense>
      {children}
    </SubscriptionProvider>
  );
}

