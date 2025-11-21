"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { getCurrentUserClient } from "@/lib/api/auth-client";
import { Logo } from "@/components/common/logo";
import { useTheme } from "next-themes";

interface LandingHeaderProps {
  isAuthenticated?: boolean;
}

export function LandingHeader({ isAuthenticated: initialAuth }: LandingHeaderProps = {}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth ?? false);
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Check authentication status and verify user exists in User table
    async function checkAuth() {
      const user = await getCurrentUserClient();
      // getCurrentUserClient verifies user exists in User table and logs out if not
      setIsAuthenticated(!!user);
    }
    
    // Always check auth on client side to ensure we have the latest state
    // The initialAuth prop from server helps avoid flash, but client check ensures accuracy
    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Verify user exists in User table
        const user = await getCurrentUserClient();
        setIsAuthenticated(!!user);
      } else {
        setIsAuthenticated(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const navItems = [
    { label: "Home", href: "#home" },
    { label: "Features", href: "#features" },
    { label: "Testimonials", href: "#testimonials" },
    { label: "Pricing", href: "#pricing" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/95 backdrop-blur-sm shadow-sm"
          : "bg-transparent"
      }`}
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-center md:justify-between h-16 md:h-20">
          {/* Logo - Centralizado no mobile, à esquerda no desktop */}
          <Link href="/" className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2 md:relative md:left-0 md:translate-x-0">
            {(() => {
              // When not scrolled, header is transparent over dark background - use white logo
              if (!isScrolled) {
                return (
                  <Logo 
                    variant="wordmark" 
                    color="white" 
                    width={150} 
                    height={40}
                    priority
                  />
                );
              }
              // When scrolled, check if dark mode - use auto to adapt to theme
              const isDark = resolvedTheme === "dark" || theme === "dark";
              return (
                <Logo 
                  variant="wordmark" 
                  color={isDark ? "white" : "purple"} 
                  width={150} 
                  height={40}
                  priority
                />
              );
            })()}
          </Link>

          {/* Desktop Navigation e CTA Buttons - À direita */}
          <div className="hidden md:flex items-center gap-8 ml-auto">
            <div className="flex items-center gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`text-base font-medium transition-colors ${
                    isScrolled
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-white/90 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Button
                  asChild
                  className={isScrolled 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "bg-white text-primary hover:bg-white/90 font-semibold"
                  }
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    className={isScrolled ? "text-foreground hover:text-white hover:bg-foreground border border-transparent hover:border-white" : "text-white hover:text-white hover:bg-white/10 border border-transparent hover:border-white"}
                  >
                    <Link href="/auth/login">Sign In</Link>
                  </Button>
                  {isScrolled ? (
                    <Button asChild className="bg-[#4A4AF2] text-white hover:bg-[#3A3AD2] font-semibold">
                      <Link href="#pricing">Get Started</Link>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="bg-white text-primary hover:bg-white/90 font-semibold"
                    >
                      <Link href="#pricing">Get Started</Link>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

