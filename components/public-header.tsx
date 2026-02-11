"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/common/logo";
import { useAuthSafe } from "@/contexts/auth-context";

interface PublicHeaderProps {
  isAuthenticated?: boolean;
}

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export function PublicHeader({ isAuthenticated: _initialAuth }: PublicHeaderProps = {}) {
  const { isAuthenticated } = useAuthSafe();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/v2/auth/sign-out", { method: "POST" });
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
      window.location.href = "/";
    } catch {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      window.location.href = "/";
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background">
      <nav className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between md:h-[4.5rem]">
          <Link
            href="/"
            className="flex shrink-0 items-center"
            aria-label="Spare Finance home"
          >
            <Logo
              variant="icon"
              color="auto"
              width={32}
              height={32}
              className="md:hidden"
            />
            <Logo
              variant="full"
              color="auto"
              width={160}
              height={36}
              className="hidden md:block"
            />
          </Link>

          <div className="absolute left-1/2 hidden -translate-x-1/2 md:flex md:items-center md:justify-center">
            <ul className="flex items-center gap-6 lg:gap-8">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex shrink-0 items-center justify-end">
            {isAuthenticated ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="medium"
                  className="text-muted-foreground"
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <Button variant="ghost" size="medium" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <Button
                asChild
                size="medium"
                className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
