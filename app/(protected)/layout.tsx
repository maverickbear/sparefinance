import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentUserSubscription } from "@/lib/api/plans";
import { verifyUserExists } from "@/lib/utils/verify-user-exists";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { Suspense } from "react";

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
  console.log("[PROTECTED-LAYOUT] Executing");
  const supabase = await createServerClient();
  
  // Check authentication
  console.log("[PROTECTED-LAYOUT] Checking authentication");
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    console.log("[PROTECTED-LAYOUT] User not authenticated:", { hasUser: !!user, error: authError?.message });
    // Get current pathname for redirect
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
    const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
    console.log("[PROTECTED-LAYOUT] Redirecting to:", redirectUrl);
    redirect(redirectUrl);
  }

  console.log("[PROTECTED-LAYOUT] User authenticated:", user.id);

  // Verify user exists in User table
  console.log("[PROTECTED-LAYOUT] Verifying user exists in User table");
  const { exists, userId } = await verifyUserExists();
  
  if (!exists) {
    console.log("[PROTECTED-LAYOUT] User does not exist in User table, redirecting to login");
    // Get current pathname for redirect
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
    const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
    redirect(redirectUrl);
  }

  console.log("[PROTECTED-LAYOUT] User exists in User table:", userId);

  // Check subscription
  let shouldOpenModal = false;
  let reason: "no_subscription" | "trial_expired" | "subscription_inactive" | undefined;
  
  try {
    console.log("[PROTECTED-LAYOUT] Checking subscription");
    const subscription = await getCurrentUserSubscription();
    console.log("[PROTECTED-LAYOUT] Subscription:", subscription);
    
    // If no subscription found, user needs to select a plan
    // Note: getCurrentUserSubscription returns null if user has no subscription
    // (not even a free plan, which should be created automatically)
    if (!subscription) {
      console.log("[PROTECTED-LAYOUT] No subscription found, will redirect to pricing page");
      shouldOpenModal = true;
      reason = "no_subscription";
    } else {
      // If subscription exists but status is not active or trialing, check if we should open modal
      // Don't open modal for "expired" or "cancelled" status - allow user to view system
      if (subscription.status !== "active" && subscription.status !== "trialing") {
        // Only open modal for "past_due" status, not for "expired" or "cancelled"
        if (subscription.status === "past_due") {
          console.log("[PROTECTED-LAYOUT] Subscription past_due, will redirect to pricing page");
        shouldOpenModal = true;
        reason = "subscription_inactive";
        } else {
          // For "expired" or "cancelled", allow access without opening modal
          console.log("[PROTECTED-LAYOUT] Subscription status:", subscription.status, "- allowing access without opening modal");
        }
      } else if (subscription.status === "trialing") {
        // If trial, allow access even if expired - user can still view the system
        // We don't block access when trial expires, just allow them to see the system
        const trialEndDate = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;
        const now = new Date();
        
        if (trialEndDate && trialEndDate <= now) {
          console.log("[PROTECTED-LAYOUT] Trial expired, but allowing access to view system");
          // Don't open modal - allow user to see the system
        } else {
          console.log("[PROTECTED-LAYOUT] Trial is still active");
        }
      }
    }

    if (!shouldOpenModal) {
      console.log("[PROTECTED-LAYOUT] User has active subscription, allowing access");
    }
  } catch (error) {
    // If error checking subscription, open modal
    console.error("[PROTECTED-LAYOUT] Error checking subscription:", error);
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

