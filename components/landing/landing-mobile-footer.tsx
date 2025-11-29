"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { BaseUser } from "@/src/domain/auth/auth.types";
import { useState, useEffect } from "react";

interface LandingMobileFooterProps {
  isAuthenticated?: boolean;
}

export function LandingMobileFooter({ isAuthenticated: initialAuth }: LandingMobileFooterProps = {}) {
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth ?? false);

  useEffect(() => {
    // Check authentication status and verify user exists in User table
    async function checkAuth() {
      try {
        const response = await fetch("/api/v2/user");
        if (!response.ok) {
          setIsAuthenticated(false);
          return;
        }
        const { user }: { user: BaseUser | null } = await response.json();
        setIsAuthenticated(!!user);
      } catch (error) {
        setIsAuthenticated(false);
      }
    }
    
    // Always check auth on client side to ensure we have the latest state
    // The initialAuth prop from server helps avoid flash, but client check ensures accuracy
    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Verify user exists in User table
        const response = await fetch("/api/v2/user");
        const user = response.ok ? await response.json() : null;
        setIsAuthenticated(!!user);
      } else {
        setIsAuthenticated(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="container mx-auto px-4 py-3">
        <div className="flex gap-3">
          {isAuthenticated ? (
            <Button 
              asChild 
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/dashboard">
                Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className="flex-1"
              >
                <Link href="/auth/login">
                  Sign In
                </Link>
              </Button>
              <Button 
                asChild 
                className="flex-1 font-semibold bg-[#4A4AF2] text-white hover:bg-[#3A3AD2]"
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

