"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wallet, Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface LandingHeaderProps {
  isAuthenticated?: boolean;
}

export function LandingHeader({ isAuthenticated: initialAuth }: LandingHeaderProps = {}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth ?? false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Check authentication status
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    }
    
    if (initialAuth === undefined) {
      checkAuth();
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialAuth]);

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
            <div className={`p-2 rounded-[12px] transition-colors ${
              isScrolled 
                ? "bg-primary/10" 
                : "bg-white/10 backdrop-blur-sm"
            }`}>
              <Wallet className={`w-6 h-6 transition-colors ${
                isScrolled 
                  ? "text-primary" 
                  : "text-white"
              }`} />
            </div>
            <span className={`text-xl font-bold transition-colors ${
              isScrolled 
                ? "text-foreground" 
                : "text-white"
            }`}>
              Spare Finance
            </span>
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
                  : "bg-[#a78bfa] text-white hover:bg-[#a78bfa]/90 font-semibold"
                }
              >
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className={isScrolled ? "text-foreground hover:bg-accent" : "text-white hover:bg-white/10"}
                >
                  <Link href="/auth/login">Login</Link>
                </Button>
                {isScrolled ? (
                  <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Link href="/auth/signup">Get Started</Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="bg-[#a78bfa] text-white hover:bg-[#a78bfa]/90 font-semibold"
                  >
                    <Link href="/auth/signup">Get Started</Link>
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
                      : "bg-[#a78bfa] text-white hover:bg-[#a78bfa]/90"
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
                    className={`w-full ${
                      isScrolled
                        ? "text-foreground hover:bg-accent"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    <Link href="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
                      Login
                    </Link>
                  </Button>
                  <Button 
                    asChild 
                    className={`w-full ${
                      isScrolled
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-[#a78bfa] text-white hover:bg-[#a78bfa]/90"
                    }`}
                  >
                    <Link href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)}>
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

