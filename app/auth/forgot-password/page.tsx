import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Mail, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/common/logo";
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
        // Check if user is super_admin
        const { makeMembersService } = await import("@/src/application/members/members.factory");
        const membersService = makeMembersService();
        const userRole = await membersService.getUserRole(user.id);
        
        // If not super_admin, redirect to maintenance page
        if (userRole !== "super_admin") {
          redirect("/maintenance");
        }
        // super_admin can continue - redirect to dashboard
        redirect("/dashboard");
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

function ForgotPasswordFormWrapper() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-col justify-center p-12 bg-[#f8f4f1] relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center">
              <Logo variant="wordmark" color="auto" width={200} height={53} priority />
            </div>
            <p className="text-lg text-muted-foreground max-w-md">
              Reset your password to regain access to your account.
            </p>
          </div>

          <div className="space-y-6 pt-8">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary rounded-lg shrink-0">
                <Mail className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Check Your Email</h3>
                <p className="text-sm text-muted-foreground">
                  We'll send you a secure link to reset your password.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary rounded-lg shrink-0">
                <Lock className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Process</h3>
                <p className="text-sm text-muted-foreground">
                  Your password reset link is encrypted and time-limited.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary rounded-lg shrink-0">
                <Shield className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Safe & Secure</h3>
                <p className="text-sm text-muted-foreground">
                  Your account security is our top priority.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Forgot Password Form */}
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <Link href="/">
            <Button variant="ghost" size="small" className="-ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Button>
          </Link>
          {/* Mobile header */}
          <div className="lg:hidden text-center space-y-2">
            <div className="flex items-center justify-center mb-4">
              <Logo variant="wordmark" color="auto" width={200} priority />
            </div>
            <p className="text-muted-foreground text-sm">
              Enter your email to reset your password
            </p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block space-y-2">
            <h2 className="text-3xl font-bold">Forgot Password?</h2>
            <p className="text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password
            </p>
          </div>

          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
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
      <ForgotPasswordFormWrapper />
    </Suspense>
    </>
  );
}

