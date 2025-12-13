import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { verifyUserExists } from "@/lib/utils/verify-user-exists";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { logger } from "@/src/infrastructure/utils/logger";
import type { Subscription, Plan } from "@/src/domain/subscriptions/subscriptions.validations";
// CRITICAL: Use static import to ensure React cache() works correctly
import { getDashboardSubscription } from "@/src/application/subscriptions/get-dashboard-subscription";

/**
 * Auth Guard Component - Wrapped in Suspense to prevent blocking page render
 * Handles all authentication and authorization checks
 */
async function AuthGuard({ children }: { children: React.ReactNode }) {
  const log = logger.withPrefix("PROTECTED-LAYOUT");
  
  // Access headers() first to unlock cookie access in createServerClient()
  await headers();
  
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
      .from("users")
      .select("id, is_blocked, role")
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

    // Map snake_case to camelCase for consistency
    userData = {
      id: data.id,
      isBlocked: data.is_blocked,
      role: data.role,
    };
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
    const adminService = makeAdminService();
    const settings = await adminService.getPublicSystemSettings();
    isMaintenanceMode = settings.maintenanceMode || false;
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

  // Check subscription - use SubscriptionsService (single source of truth)
  let shouldOpenModal = false;
  let reason: "no_subscription" | "trial_expired" | "subscription_inactive" | undefined;
  let subscription: Subscription | null = null;
  let plan: Plan | null = null;
  
  try {
    // CRITICAL: Get userId BEFORE calling getDashboardSubscription() to avoid
    // calling cookies() inside a "use cache" function
    // CRITICAL OPTIMIZATION: Use cached function to ensure only 1 call per request
    // This replaces multiple SubscriptionsService calls throughout the app
    // IMPORTANT: Using static import ensures React cache() works correctly
    const subscriptionData = await getDashboardSubscription(userId);
    subscription = subscriptionData.subscription;
    plan = subscriptionData.plan;
    
    // Note: SubscriptionsService already handles household member subscription inheritance
    // No need for manual retry - the service checks household membership internally
    // If no subscription found, user needs to complete onboarding (handled by onboarding dialog)
    if (!subscription) {
      shouldOpenModal = false; // Don't open pricing dialog, let onboarding handle it
    } else {
      // Check if subscription status allows access
      const isActiveStatus = subscription.status === "active";
      const isTrialingStatus = subscription.status === "trialing";
      
      // If subscription exists and status is active or trialing, allow access
      if (isActiveStatus || isTrialingStatus) {
        shouldOpenModal = false;
      } else {
        // Open modal for "cancelled" status (user needs to reactivate)
        if (subscription.status === "cancelled") {
          shouldOpenModal = true;
          reason = "no_subscription"; // Use no_subscription reason to show dialog
        } else if (subscription.status === "past_due") {
          shouldOpenModal = true;
          reason = "subscription_inactive";
        } else {
          // Allow access for other statuses (unpaid, etc.)
          shouldOpenModal = false;
        }
      }
    }
  } catch (error) {
    // If error checking subscription, don't open pricing dialog
    // Let onboarding handle it (user might be new and needs onboarding)
    log.error("Error checking subscription:", error);
    shouldOpenModal = false; // Don't open pricing dialog, let onboarding handle it
  }

  // Get current plan ID and interval for the dialog
  const currentPlanId = subscription?.planId;
  let currentInterval: "month" | "year" | null = null;
  
  // Try to determine interval from subscription if available
  // Note: This is a simplified check - full interval detection requires Stripe API call
  // The dialog will handle fetching the correct interval if needed
  if (subscription && plan) {
    // Default to null - dialog can fetch from API if needed
    currentInterval = null;
  }

  // Determine subscription status for dialog
  // Only show pricing dialog for cancelled subscriptions
  // For no subscription, let onboarding dialog handle it
  const subscriptionStatus = 
    subscription && subscription.status === "cancelled" 
      ? "cancelled" 
      : null;

  return (
    <SubscriptionProvider initialData={{ subscription, plan }}>
      {children}
      <SubscriptionGuard 
        shouldOpenModal={shouldOpenModal} 
        reason={reason}
        currentPlanId={currentPlanId}
        currentInterval={currentInterval}
        subscriptionStatus={subscriptionStatus}
      />
    </SubscriptionProvider>
  );
}

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
 * 
 * Uses Suspense to prevent blocking page render while checking authentication
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    }>
      <AuthGuard>{children}</AuthGuard>
    </Suspense>
  );
}

