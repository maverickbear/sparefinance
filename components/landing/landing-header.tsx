"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { BaseUser } from "@/src/domain/auth/auth.types";
import { Logo } from "@/components/common/logo";
import { useTheme } from "next-themes";
import { Sun, Moon, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LandingHeaderProps {
  isAuthenticated?: boolean;
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name[0].toUpperCase();
}

export function LandingHeader({ isAuthenticated: initialAuth }: LandingHeaderProps = {}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth ?? false);
  const [user, setUser] = useState<BaseUser | null>(null);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const router = useRouter();

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
      try {
        const response = await fetch("/api/v2/user");
        if (!response.ok) {
          setIsAuthenticated(false);
          setUser(null);
          return;
        }
        const { user: currentUser }: { user: BaseUser | null } = await response.json();
        setIsAuthenticated(!!currentUser);
        setUser(currentUser);
      } catch (error) {
        setIsAuthenticated(false);
        setUser(null);
      }
    }
    
    // Always check auth on client side to ensure we have the latest state
    // The initialAuth prop from server helps avoid flash, but client check ensures accuracy
    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Verify user exists in User table
        try {
          const response = await fetch("/api/v2/user");
          if (response.ok) {
            const { user: currentUser }: { user: BaseUser | null } = await response.json();
            setIsAuthenticated(!!currentUser);
            setUser(currentUser);
          } else {
            setIsAuthenticated(false);
            setUser(null);
          }
        } catch (error) {
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/v2/auth/sign-out", {
        method: "POST",
      });

      if (response.ok) {
        setIsAuthenticated(false);
        setUser(null);
        router.push("/");
        router.refresh();
      } else {
        const error = await response.json();
        console.error("Failed to sign out:", error.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

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
        <div className="relative flex items-center justify-between h-16 md:h-20">
          {/* Logo - À esquerda (mobile e desktop) */}
          <Link href="/" className="flex items-center gap-3 flex-1">
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

          {/* Desktop Navigation - Centralizado */}
          <div className="hidden md:flex items-center justify-center flex-1 h-full">
            <nav className="flex items-center gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`text-base font-medium transition-colors flex items-center ${
                    isScrolled
                      ? "text-muted-foreground hover:text-foreground"
                      : "text-white/90 hover:text-white"
                  }`}
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
                  className={isScrolled ? "text-foreground hover:text-white hover:bg-foreground border border-transparent hover:border-white text-sm" : "text-white hover:text-white hover:bg-white/10 border border-transparent hover:border-white text-sm"}
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`relative rounded-full h-9 w-9 md:h-10 md:w-10 ${isScrolled 
                      ? "hover:bg-muted" 
                      : "hover:bg-white/10"
                    }`}
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
                        <div className={`h-9 w-9 md:h-10 md:w-10 rounded-full hidden items-center justify-center text-xs font-semibold border ${
                          isScrolled 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-white text-primary"
                        }`}>
                          {getInitials(user?.name)}
                        </div>
                      </>
                    ) : user?.name ? (
                      <div className={`h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center text-xs font-semibold border ${
                        isScrolled 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-white text-primary"
                      }`}>
                        {getInitials(user.name)}
                      </div>
                    ) : (
                      <div className={`h-9 w-9 md:h-10 md:w-10 rounded-full ${
                        isScrolled ? "bg-muted" : "bg-white/20"
                      } animate-pulse`} />
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
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className={`relative h-9 w-9 md:h-10 md:w-10 ${isScrolled 
                    ? "text-foreground hover:bg-muted" 
                    : "text-white hover:bg-white/10"
                  }`}
                  aria-label="Toggle theme"
                >
                  <Sun className="absolute h-4 w-4 md:h-5 md:w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 md:h-5 md:w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="small"
                  className={isScrolled ? "text-foreground hover:text-white hover:bg-foreground border border-transparent hover:border-white text-sm" : "text-white hover:text-white hover:bg-white/10 border border-transparent hover:border-white text-sm"}
                >
                  <Link href="/auth/login">Sign In</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

