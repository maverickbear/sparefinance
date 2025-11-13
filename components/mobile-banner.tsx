"use client";

import { UpgradeBanner } from "@/components/common/upgrade-banner";

interface MobileBannerProps {
  hasSubscription?: boolean;
}

export function MobileBanner({ hasSubscription = true }: MobileBannerProps) {
  // Don't render MobileBanner if user doesn't have subscription
  if (!hasSubscription) {
    return null;
  }

  return (
    <div 
      className="fixed left-0 right-0 lg:hidden"
      style={{
        top: 'calc(var(--mobile-header-height, 4rem) + var(--page-header-height, 0px))',
      }}
      id="mobile-banner"
    >
      <UpgradeBanner />
    </div>
  );
}

