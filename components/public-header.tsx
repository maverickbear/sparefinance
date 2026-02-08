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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200/80">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex items-center justify-between h-16 md:h-[72px]">
          <Link href="/" className="flex items-center shrink-0" aria-label="Spare Finance home">
            <Logo variant="icon" color="auto" width={32} height={32} className="md:hidden" />
            <Logo variant="full" color="auto" width={160} height={36} className="hidden md:block" />
          </Link>

          <div className="hidden md:flex items-center justify-center absolute left-1/2 -translate-x-1/2">
            <ul className="flex items-center gap-8">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-end shrink-0">
            {isAuthenticated ? (
              <>
                <Button asChild variant="ghost" size="medium" className="text-gray-700">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <Button variant="ghost" size="medium" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <Button asChild size="medium" className="bg-gray-900 text-white hover:bg-gray-800 rounded-lg">
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
