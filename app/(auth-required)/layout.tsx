import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { verifyUserExists } from "@/lib/utils/verify-user-exists";

/**
 * Auth Required Layout
 * 
 * This layout protects routes that require authentication but not subscription.
 * Examples: /select-plan, /welcome
 * 
 * It verifies:
 * 1. User is authenticated
 * 2. User exists in User table
 * 
 * If user is not authenticated, redirects to /auth/login with redirect parameter
 * If user doesn't exist in User table, logs out and redirects to /auth/login
 * If user is authenticated, allows access (subscription check is handled in the page itself)
 */
export default async function AuthRequiredLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Opt out of static generation - this layout requires authentication
  noStore();
  
  console.log("[AUTH-REQUIRED-LAYOUT] Executing");
  const supabase = await createServerClient();
  
  // Check authentication
  console.log("[AUTH-REQUIRED-LAYOUT] Checking authentication");
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    console.log("[AUTH-REQUIRED-LAYOUT] User not authenticated:", { hasUser: !!user, error: authError?.message });
    // Get current pathname for redirect
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
    const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
    console.log("[AUTH-REQUIRED-LAYOUT] Redirecting to:", redirectUrl);
    redirect(redirectUrl);
  }

  console.log("[AUTH-REQUIRED-LAYOUT] User authenticated:", user.id);

  // Verify user exists in User table (pass user to avoid duplicate getUser() call)
  console.log("[AUTH-REQUIRED-LAYOUT] Verifying user exists in User table");
  const { exists, userId } = await verifyUserExists(user);
  
  if (!exists) {
    console.log("[AUTH-REQUIRED-LAYOUT] User does not exist in User table, redirecting to login");
    // Get current pathname for redirect
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || headersList.get("referer") || "";
    const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : "/auth/login";
    redirect(redirectUrl);
  }

  console.log("[AUTH-REQUIRED-LAYOUT] User exists in User table:", userId, "allowing access");
  return <>{children}</>;
}

