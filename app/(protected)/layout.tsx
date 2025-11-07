import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentUserSubscription } from "@/lib/api/plans";

/**
 * Protected Layout
 * 
 * This layout protects routes that require both authentication and subscription.
 * It verifies:
 * 1. User is authenticated
 * 2. User has an active subscription (at least "free" plan)
 * 
 * If user is not authenticated, redirects to /auth/login with redirect parameter
 * If user is authenticated but has no subscription, redirects to /select-plan
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

  // Check subscription
  try {
    console.log("[PROTECTED-LAYOUT] Checking subscription");
    const subscription = await getCurrentUserSubscription();
    console.log("[PROTECTED-LAYOUT] Subscription:", subscription);
    
    // If no subscription found, user needs to select a plan
    // Note: getCurrentUserSubscription returns null if user has no subscription
    // (not even a free plan, which should be created automatically)
    if (!subscription) {
      console.log("[PROTECTED-LAYOUT] No subscription found, redirecting to /select-plan");
      redirect("/select-plan");
    }
    
    // If subscription exists but status is not active, redirect to select-plan
    if (subscription.status !== "active") {
      console.log("[PROTECTED-LAYOUT] Subscription not active, redirecting to /select-plan");
      redirect("/select-plan");
    }

    console.log("[PROTECTED-LAYOUT] User has active subscription, allowing access");
  } catch (error) {
    // If error checking subscription, redirect to select-plan
    console.error("[PROTECTED-LAYOUT] Error checking subscription:", error);
    redirect("/select-plan");
  }

  return <>{children}</>;
}

