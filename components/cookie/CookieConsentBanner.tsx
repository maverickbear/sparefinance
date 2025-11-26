"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { cn } from "@/lib/utils";

/**
 * Cookie Consent Banner Component
 * 
 * Displays a banner at the bottom of the screen for new visitors
 * to accept or reject non-essential cookies. The user's choice is
 * persisted in localStorage and the banner will not show again.
 */
export function CookieConsentBanner() {
  const { shouldShowBanner, acceptAll, rejectNonEssential } = useCookieConsent();

  if (!shouldShowBanner) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[60]",
        "mx-6 mb-6",
        "animate-in slide-in-from-bottom fade-in-0 duration-300"
      )}
    >
      <Card className="w-full border-t bg-card shadow-lg rounded-[12px] opacity-100">
        <CardContent className="p-4 md:p-6">
          <div className="space-y-4">
            {/* Title */}
            <h3 className="text-sm font-medium text-muted-foreground">
              Cookie preferences
            </h3>

            {/* Body text */}
            <p className="text-sm text-foreground">
              We use cookies to improve your experience, analyze traffic, and
              remember your preferences. By continuing to use Spare Finance, you
              agree to our Privacy Policy.
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Button
                  onClick={acceptAll}
                  size="small"
                  variant="default"
                  className="min-w-[140px]"
                >
                  Accept all
                </Button>
                <Button
                  onClick={rejectNonEssential}
                  size="small"
                  variant="outline"
                  className="min-w-[140px]"
                >
                  Reject non-essential
                </Button>
              </div>
              <Link
                href="/privacy-policy"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline sm:text-sm"
              >
                View Privacy Policy
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

