import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { VerifyOtpFormWrapperContent } from "./verify-otp-form-wrapper";
import { makeAuthService } from "@/src/application/auth/auth.factory";

/**
 * Maintenance Check Component - Wrapped in Suspense to prevent blocking page render
 * Redirects non-super_admin users to maintenance page when maintenance mode is active
 */
async function MaintenanceCheck() {
  try {
    // Access headers() first to "unlock" Math.random() usage in createServiceRoleClient()
    await headers();
    
    // Check maintenance mode
    const { makeAdminService } = await import("@/src/application/admin/admin.factory");
    const adminService = makeAdminService();
    const settings = await adminService.getPublicSystemSettings();
    const isMaintenanceMode = settings.maintenanceMode || false;
    
    // If maintenance mode is active, check if user is super_admin
    if (isMaintenanceMode) {
      const authService = makeAuthService();
      const user = await authService.getCurrentUser();
      
      if (user) {
        const adminService = makeAdminService();
        const isPortalAdmin = await adminService.isSuperAdmin(user.id);
        if (!isPortalAdmin) redirect("/maintenance");
        redirect("/admin");
      } else {
        // Not authenticated - redirect to maintenance
        redirect("/maintenance");
      }
    }
  } catch (error: any) {
    // NEXT_REDIRECT is expected - Next.js uses exceptions for redirects
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      // Re-throw redirect exceptions - they should propagate
      throw error;
    }
    
    // Silently handle prerendering errors - these are expected during build
    const errorMessage = error?.message || '';
    if (errorMessage.includes('prerender') || 
        errorMessage.includes('HANGING_PROMISE') ||
        errorMessage.includes('cookies() rejects') ||
        errorMessage.includes('Dynamic data sources')) {
      // During prerendering, assume no maintenance mode - no redirect
      return null;
    }
    // For other errors, log but continue (don't block page render)
    console.error("Error checking maintenance mode:", error);
  }
  
  return null;
}

function VerifyOtpFormWrapper() {
  return <VerifyOtpFormWrapperContent />;
}

export default function VerifyOtpPage() {
  return (
    <>
      {/* Maintenance Check - wrapped in Suspense (will redirect if maintenance mode is active) */}
      <Suspense fallback={null}>
        <MaintenanceCheck />
      </Suspense>
      
      <Suspense fallback={
      <div className="min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-center p-12 bg-[#f8f4f1]">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>
        <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
          <div className="w-full max-w-md space-y-4">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
              <div className="h-4 w-64 bg-muted animate-pulse rounded-lg" />
            </div>
            <div className="space-y-4">
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    }>
      <VerifyOtpFormWrapper />
    </Suspense>
    </>
  );
}

