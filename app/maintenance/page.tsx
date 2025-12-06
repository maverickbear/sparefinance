import { LandingHeader } from "@/components/landing/landing-header";
import { Wrench, Clock } from "lucide-react";
import { makeAuthService } from "@/src/application/auth/auth.factory";

export const metadata = {
  title: "Maintenance - Spare Finance",
  description: "We are currently under maintenance. We'll be back soon.",
};

export default async function MaintenancePage() {
  // Check authentication status on server to show correct buttons in header
  const authService = makeAuthService();
  const user = await authService.getCurrentUser();
  const isAuthenticated = !!user;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader isAuthenticated={isAuthenticated} />
      <div className="flex-1 flex items-center justify-center p-4 pt-24 md:pt-28">
        <div className="max-w-md w-full space-y-8 text-center">

        {/* Maintenance Icon */}
        <div className="flex justify-center">
          <div className="p-6 bg-primary/10 rounded-full">
            <Wrench className="w-12 h-12 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">We're Under Maintenance</h1>
          <p className="text-muted-foreground">
            We're working to improve your experience. We'll be back soon!
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-muted/50 rounded-lg p-6 space-y-4 border">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-left space-y-1">
              <p className="font-medium">What's happening?</p>
              <p className="text-sm text-muted-foreground">
                We're performing updates and improvements to the system to provide you with an even better experience.
              </p>
            </div>
          </div>
        </div>

          {/* Footer */}
          <p className="text-sm text-muted-foreground">
            Thank you for your patience!
          </p>
        </div>
      </div>
    </div>
  );
}

