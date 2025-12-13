"use client";

import { Nav } from "@/components/nav";
import { BottomNav } from "@/components/bottom-nav";

interface PublicLayoutProps {
  children: React.ReactNode;
  hasSubscription?: boolean;
}

/**
 * Public Layout Component
 * Used for public pages, welcome page, and pages without subscription
 */
export function PublicLayout({ children, hasSubscription = false }: PublicLayoutProps) {
  return (
    <>
      <Nav />
      <BottomNav hasSubscription={hasSubscription} />
      {children}
    </>
  );
}

