"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthSafe } from "@/contexts/auth-context";

interface LandingMobileFooterProps {
  isAuthenticated?: boolean; // Deprecated - kept for backward compatibility, not used
}

/**
 * LandingMobileFooter
 * 
 * Uses AuthContext for authentication state (single source of truth)
 * No longer manages its own auth state or makes direct API calls
 */
export function LandingMobileFooter({ isAuthenticated: _initialAuth }: LandingMobileFooterProps = {}) {
  const { isAuthenticated } = useAuthSafe(); // Use Context instead of local state

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="container mx-auto px-4 py-3">
        <div className="flex gap-3">
          {isAuthenticated ? (
            <Button 
              asChild 
              className="flex-1"
            >
              <Link href="/dashboard">
                Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="secondary"
                className="flex-1"
              >
                <Link href="/auth/login">
                  Sign In
                </Link>
              </Button>
              <Button 
                asChild 
                className="flex-1"
              >
                <Link href="/auth/signup">
                  Get Started
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}

