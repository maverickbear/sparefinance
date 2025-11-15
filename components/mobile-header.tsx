"use client";

import Link from "next/link";
import { UpgradeBanner } from "@/components/common/upgrade-banner";
import { Logo } from "@/components/common/logo";

interface MobileHeaderProps {
  hasSubscription?: boolean;
}

export function MobileHeader({ hasSubscription = true }: MobileHeaderProps) {
  // Don't render MobileHeader if user doesn't have subscription
  if (!hasSubscription) {
    return null;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-card lg:hidden" id="mobile-header">
      <div className="flex h-16 items-center justify-between px-4 border-b">
        <Link href="/dashboard" className="flex items-center min-h-[44px] min-w-[44px]">
          <Logo variant="wordmark" color="auto" width={150} height={40} />
        </Link>
      </div>
    </header>
  );
}

