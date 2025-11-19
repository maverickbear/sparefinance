import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Shield, Lock, Key } from "lucide-react";
import { Logo } from "@/components/common/logo";

function ResetPasswordFormWrapper() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center">
              <Logo variant="wordmark" color="auto" width={150} height={40} priority />
            </div>
            <p className="text-lg text-muted-foreground max-w-md">
              Create a new secure password for your account.
            </p>
          </div>

          <div className="space-y-6 pt-8">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-[12px] shrink-0">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Strong Password</h3>
                <p className="text-sm text-muted-foreground">
                  Use a unique password with at least 8 characters.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-[12px] shrink-0">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Storage</h3>
                <p className="text-sm text-muted-foreground">
                  Your password is encrypted and securely stored.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-[12px] shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Protected Account</h3>
                <p className="text-sm text-muted-foreground">
                  We check passwords against known data breaches.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Reset Password Form */}
      <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile header */}
          <div className="lg:hidden text-center space-y-2">
            <div className="flex items-center justify-center mb-4">
              <Logo variant="wordmark" color="auto" height={40} priority />
            </div>
            <p className="text-muted-foreground text-sm">
              Create a new password for your account
            </p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block space-y-2">
            <h2 className="text-3xl font-bold">Reset Password</h2>
            <p className="text-muted-foreground">
              Enter your new password below
            </p>
          </div>

          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-[12px]" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded-[12px]" />
          </div>
        </div>
        <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
          <div className="w-full max-w-md space-y-4">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted animate-pulse rounded-[12px]" />
              <div className="h-4 w-64 bg-muted animate-pulse rounded-[12px]" />
            </div>
            <div className="space-y-4">
              <div className="h-10 bg-muted animate-pulse rounded-[12px]" />
              <div className="h-10 bg-muted animate-pulse rounded-[12px]" />
            </div>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordFormWrapper />
    </Suspense>
  );
}

