import { LandingHeader } from "@/components/landing/landing-header";
import { Shield, Mail, AlertCircle } from "lucide-react";
import { makeAuthService } from "@/src/application/auth/auth.factory";
import Link from "next/link";

export const metadata = {
  title: "Account Blocked - Spare Finance",
  description: "Your account has been blocked. Please contact support for assistance.",
};

export default async function AccountBlockedPage() {
  // Check authentication status on server to show correct buttons in header
  const authService = makeAuthService();
  const user = await authService.getCurrentUser();
  const isAuthenticated = !!user;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader isAuthenticated={isAuthenticated} />
      <div className="flex-1 flex items-center justify-center p-4 pt-24 md:pt-28">
        <div className="max-w-md w-full space-y-8 text-center">
          {/* Blocked Icon */}
          <div className="flex justify-center">
            <div className="p-6 bg-destructive/10 rounded-full">
              <Shield className="w-12 h-12 text-destructive" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Account Blocked</h1>
            <p className="text-muted-foreground">
              Your account has been temporarily blocked from accessing the system.
            </p>
          </div>

          {/* Info Card */}
          <div className="bg-muted/50 rounded-lg p-6 space-y-4 border">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div className="text-left space-y-1">
                <p className="font-medium">What does this mean?</p>
                <p className="text-sm text-muted-foreground">
                  Your account access has been restricted. This may be due to a violation of our terms of service or for security reasons.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Support Card */}
          <div className="bg-primary/5 rounded-lg p-6 space-y-4 border border-primary/20">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="text-left space-y-2">
                <p className="font-medium">Need Help?</p>
                <p className="text-sm text-muted-foreground">
                  If you believe this is an error or have questions about your account status, please contact our support team.
                </p>
                <div className="pt-2">
                  <Link
                    href="mailto:support@sparefinance.com"
                    className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
                  >
                    <Mail className="w-4 h-4" />
                    support@sparefinance.com
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-muted-foreground">
            We're here to help resolve any issues with your account.
          </p>
        </div>
      </div>
    </div>
  );
}

