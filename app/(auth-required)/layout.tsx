import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase-server";

/**
 * Auth Required Layout
 * 
 * This layout protects routes that require authentication but not subscription.
 * Examples: /select-plan, /welcome
 * 
 * If user is not authenticated, redirects to /auth/login with redirect parameter
 * If user is authenticated, allows access (subscription check is handled in the page itself)
 */
export default async function AuthRequiredLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  console.log("[AUTH-REQUIRED-LAYOUT] User authenticated:", user.id, "allowing access");
  return <>{children}</>;
}

