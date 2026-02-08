"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled ? "bg-background/95 backdrop-blur-sm border-b border-border" : "bg-transparent"
        )}
      >
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            <Link href="/" className="flex items-center shrink-0" aria-label="Spare Finance home">
              <Logo variant="icon" color="auto" width={32} height={32} className="md:hidden" />
              <Logo variant="full" color="auto" width={140} height={32} className="hidden md:block" />
            </Link>

            <div className="hidden md:flex items-center justify-center absolute left-1/2 -translate-x-1/2">
              <ul className="flex items-center gap-8">
                {NAV_LINKS.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="medium" className="hidden sm:inline-flex">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild size="medium" className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] transition-transform">
                <Link href="/auth/signup">Start free trial</Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </nav>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[280px]">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <ul className="flex flex-col gap-4 pt-8">
            {NAV_LINKS.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-base font-medium text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-4 border-t border-border flex flex-col gap-2">
              <Button asChild variant="outline" size="medium" className="w-full">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild size="medium" className="w-full bg-primary text-primary-foreground">
                <Link href="/auth/signup">Start free trial</Link>
              </Button>
            </li>
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
