"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";

interface MobileHeaderProps {
  hasSubscription?: boolean;
}

export function MobileHeader({ hasSubscription = true }: MobileHeaderProps) {
  // Don't render MobileHeader if user doesn't have subscription
  if (!hasSubscription) {
    return null;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b bg-card lg:hidden">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-[12px]">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold">Spare Finance</span>
        </Link>
      </div>
    </header>
  );
}

