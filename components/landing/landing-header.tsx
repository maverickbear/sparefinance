"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/common/logo";
import { useAuthSafe } from "@/contexts/auth-context";

interface LandingHeaderProps {
  isAuthenticated?: boolean; // Deprecated - kept for backward compatibility, not used
}

/**
 * LandingHeader
 * 
 * Uses AuthContext for authentication state (single source of truth)
 * No longer manages its own auth state or makes direct API calls
 */
export function LandingHeader({ isAuthenticated: _initialAuth }: LandingHeaderProps = {}) {
  const { user, isAuthenticated } = useAuthSafe(); // Use Context instead of local state
  const router = useRouter();

  const handleLogout = async () => {
    try {
      
      const response = await fetch("/api/v2/auth/sign-out", {
        method: "POST",
      });

      if (response.ok) {
        // Ensure Supabase client is also signed out
        await supabase.auth.signOut();
        // Force a hard refresh to clear all caches
        router.push("/");
        router.refresh();
        // Also use window.location to ensure complete page reload
        window.location.href = "/";
      } else {
        const error = await response.json();
        console.error("Failed to sign out:", error.error || "Unknown error");
        // Still redirect even if API call failed
        await supabase.auth.signOut();
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error signing out:", error);
      // Still try to sign out and redirect
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // Ignore errors
      }
      window.location.href = "/";
    }
  };

  const navItems = [
    { label: "Home", href: "#home" },
    { label: "Features", href: "#features" },
    // { label: "Testimonials", href: "#testimonials" },
    { label: "Pricing", href: "#pricing" },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-background/95 backdrop-blur-sm shadow-sm"
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16 md:h-20">
          {/* Logo - À esquerda (mobile e desktop) */}
          <Link href="/" className="flex items-center gap-3 flex-1">
            {/* Mobile: use logomark (icon only) */}
            <Logo 
              variant="icon" 
              color="auto"
              width={32} 
              height={32}
              priority
              className="md:hidden"
            />
            {/* Desktop: use full logo */}
            <Logo 
              variant="full" 
              color="auto"
              width={240} 
              height={53}
              priority
              className="hidden md:block"
            />
          </Link>

          {/* Desktop Navigation - Centralizado */}
          <div className="hidden md:flex items-center justify-center flex-1 h-full">
            <nav className="flex items-center gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-base font-medium transition-colors flex items-center text-foreground hover:text-foreground/80"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* CTA Buttons - À direita (Desktop e Mobile) */}
          <div className="flex items-center gap-2 md:gap-3 flex-1 justify-end">
            {isAuthenticated ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="medium"
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                  <Button
                    variant="ghost"
                  size="medium"
                    onClick={handleLogout}
                  >
                  Log Out
                </Button>
              </>
            ) : (
              <Button
                asChild
                variant="secondary"
                size="medium"
              >
                <Link href="/auth/login">Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

