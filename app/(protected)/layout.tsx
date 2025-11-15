import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentUserSubscription, type Subscription } from "@/lib/api/plans";
import { verifyUserExists } from "@/lib/utils/verify-user-exists";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { Suspense } from "react";
import { logger } from "@/lib/utils/logger";

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
    log.debug("User not authenticated, redirecting to login");
    // Get current pathname for redirect
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
    const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
    redirect(redirectUrl);
  }

  log.debug("User authenticated:", user.id);

  // Verify user exists in User table
  const { exists, userId } = await verifyUserExists();
  
  if (!exists) {
    log.debug("User does not exist in User table, redirecting to login");
    // Get current pathname for redirect
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
    const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
    redirect(redirectUrl);
  }

  log.debug("User verified:", userId);

  // Check subscription
  let shouldOpenModal = false;
  let reason: "no_subscription" | "trial_expired" | "subscription_inactive" | undefined;
  
  try {
    // First, try to get subscription from cache/function
    let subscription = await getCurrentUserSubscription();
    
    // If no subscription found, do a direct database query as fallback
    // This helps catch cases where cache might be stale or subscription was just created
    if (!subscription) {
      log.debug("No subscription from cache, checking database directly...");
      const { data: directSub, error: directError } = await supabase
        .from("Subscription")
        .select("*")
        .eq("userId", userId)
        .in("status", ["active", "trialing", "trial", "cancelled", "past_due"])
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (directError && directError.code !== "PGRST116") {
        log.error("Error in direct subscription query:", directError);
      }
      
      if (directSub) {
        log.debug("Found subscription via direct query:", {
          status: directSub.status,
          planId: directSub.planId
        });
        // Map the direct result to Subscription type
        subscription = {
          id: directSub.id,
          userId: directSub.userId,
          planId: directSub.planId,
          status: directSub.status,
          stripeSubscriptionId: directSub.stripeSubscriptionId,
          stripeCustomerId: directSub.stripeCustomerId,
          currentPeriodStart: directSub.currentPeriodStart ? new Date(directSub.currentPeriodStart) : null,
          currentPeriodEnd: directSub.currentPeriodEnd ? new Date(directSub.currentPeriodEnd) : null,
          trialStartDate: directSub.trialStartDate ? new Date(directSub.trialStartDate) : null,
          trialEndDate: directSub.trialEndDate ? new Date(directSub.trialEndDate) : null,
          cancelAtPeriodEnd: directSub.cancelAtPeriodEnd || false,
          createdAt: new Date(directSub.createdAt),
          updatedAt: new Date(directSub.updatedAt),
        };
      }
    }
    
    log.debug("Subscription check result:", {
      hasSubscription: !!subscription,
      status: subscription?.status || "none",
      planId: subscription?.planId || "none",
      userId: subscription?.userId || "none"
    });
    
    // If no subscription found, user needs to select a plan
    // Note: getCurrentUserSubscription returns null if user has no subscription
    // (not even a free plan, which should be created automatically)
    if (!subscription) {
      log.debug("No subscription found, will redirect to pricing page");
      shouldOpenModal = true;
      reason = "no_subscription";
    } else {
      // Check if subscription status allows access
      // Accept both "trialing" and "trial" (in case of inconsistency in database)
      const isActiveStatus = subscription.status === "active";
      const isTrialingStatus = subscription.status === "trialing" || subscription.status === "trial";
      
      log.debug("Subscription status check:", {
        status: subscription.status,
        isActiveStatus,
        isTrialingStatus,
        allowsAccess: isActiveStatus || isTrialingStatus
      });
      
      // If subscription exists and status is active or trialing, allow access
      if (isActiveStatus || isTrialingStatus) {
        log.debug("Subscription is active or trialing, allowing access to dashboard");
        // Don't open modal - user has valid subscription
        shouldOpenModal = false;
      } else {
        // If subscription exists but status is not active or trialing, check if we should open modal
        // Don't open modal for "expired" or "cancelled" status - allow user to view system
        // Only open modal for "past_due" status
        if (subscription.status === "past_due") {
          log.debug("Subscription past_due, will redirect to pricing page");
          shouldOpenModal = true;
          reason = "subscription_inactive";
        } else {
          log.debug("Subscription has status:", subscription.status, "- allowing access to view system");
          // Allow access for other statuses (cancelled, expired, etc.) - user can view system
          shouldOpenModal = false;
        }
      }
    }
  } catch (error) {
    // If error checking subscription, open modal
    log.error("Error checking subscription:", error);
    shouldOpenModal = true;
    reason = "no_subscription";
  }

  return (
    <>
      <Suspense fallback={null}>
        <SubscriptionGuard shouldOpenModal={shouldOpenModal} reason={reason} />
      </Suspense>
      {children}
    </>
  );
}

