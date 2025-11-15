"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserClient } from "@/lib/api/auth-client";
import { Logo } from "@/components/common/logo";
import { useTheme } from "next-themes";

interface LandingHeaderProps {
  isAuthenticated?: boolean;
}

export function LandingHeader({ isAuthenticated: initialAuth }: LandingHeaderProps = {}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
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

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  isScrolled
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-white/90 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
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

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className={`w-6 h-6 transition-colors ${
                isScrolled ? "text-foreground" : "text-white"
              }`} />
            ) : (
              <Menu className={`w-6 h-6 transition-colors ${
                isScrolled ? "text-foreground" : "text-white"
              }`} />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className={`md:hidden py-4 transition-colors ${
            isScrolled 
              ? "border-t border-border" 
              : "border-t border-white/20"
          }`}>
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`text-sm font-medium transition-colors ${
                    isScrolled
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-white/90 hover:text-white"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <Button 
                  asChild 
                  className={`w-full ${
                    isScrolled
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-white text-primary hover:bg-white/90"
                  }`}
                >
                  <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                    Dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    className={`w-full border border-transparent ${
                      isScrolled
                        ? "text-foreground hover:text-white hover:bg-foreground hover:border-white"
                        : "text-white hover:text-white hover:bg-white/10 hover:border-white"
                    }`}
                  >
                    <Link href="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
                      Sign In
                    </Link>
                  </Button>
                  <Button 
                    asChild 
                    className={`w-full font-semibold ${
                      isScrolled
                        ? "bg-[#4A4AF2] text-white hover:bg-[#3A3AD2]"
                        : "bg-white text-primary hover:bg-white/90"
                    }`}
                  >
                    <Link href="#pricing" onClick={() => setIsMobileMenuOpen(false)}>
                      Get Started
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

