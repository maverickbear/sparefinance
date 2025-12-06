"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/common/logo";
import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthSafe } from "@/contexts/auth-context";

interface LandingHeaderProps {
  isAuthenticated?: boolean; // Deprecated - kept for backward compatibility, not used
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name[0].toUpperCase();
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
            <Logo 
              variant="full" 
              color="auto"
              width={180} 
              height={40}
              priority
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
                  size="small"
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative rounded-full h-9 w-9 md:h-10 md:w-10 hover:bg-muted"
                  >
                    {user?.avatarUrl ? (
                      <>
                        <img
                          src={user.avatarUrl}
                          alt={user.name || "User"}
                          className="h-9 w-9 md:h-10 md:w-10 rounded-full object-cover border"
                          loading="eager"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const initialsContainer =
                              e.currentTarget.nextElementSibling;
                            if (initialsContainer) {
                              (initialsContainer as HTMLElement).style.display =
                                "flex";
                            }
                          }}
                        />
                        <div className="h-9 w-9 md:h-10 md:w-10 rounded-full hidden items-center justify-center text-xs font-semibold border bg-primary text-black">
                          {getInitials(user?.name)}
                        </div>
                      </>
                    ) : user?.name ? (
                      <div className="h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center text-xs font-semibold border bg-primary text-black">
                        {getInitials(user.name)}
                      </div>
                    ) : (
                      <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-muted animate-pulse" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </>
            ) : (
              <Button
                asChild
                variant="secondary"
                size="small"
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

