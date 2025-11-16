import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentUserSubscription, getPlanById, type Subscription, type Plan } from "@/lib/api/plans";
import { verifyUserExists } from "@/lib/utils/verify-user-exists";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { SubscriptionProvider } from "@/contexts/subscription-context";
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
    // Get current pathname for redirect
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
    const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
    redirect(redirectUrl);
  }

  // Verify user exists in User table
  const { exists, userId } = await verifyUserExists();
  
  if (!exists) {
    // Get current pathname for redirect
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
    const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
    redirect(redirectUrl);
  }

  // Check subscription - use cached function which already has internal caching
  let shouldOpenModal = false;
  let reason: "no_subscription" | "trial_expired" | "subscription_inactive" | undefined;
  let subscription: Subscription | null = null;
  let plan: Plan | null = null;
  
  try {
    // Get subscription from cache/function (already has internal caching)
    subscription = await getCurrentUserSubscription();
    
    // If subscription exists, get the plan
    if (subscription) {
      plan = await getPlanById(subscription.planId);
    }
    
    // If no subscription found, user needs to select a plan
    if (!subscription) {
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
          shouldOpenModal = true;
          reason = "subscription_inactive";
        } else {
          // Allow access for other statuses (cancelled, expired, etc.)
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
    <SubscriptionProvider initialData={{ subscription, plan }}>
      <Suspense fallback={null}>
        <SubscriptionGuard shouldOpenModal={shouldOpenModal} reason={reason} />
      </Suspense>
      {children}
    </SubscriptionProvider>
  );
}

