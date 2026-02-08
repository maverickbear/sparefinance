"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const FOOTER_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Privacy", href: "/privacy-policy" },
  { label: "Terms", href: "/terms-of-service" },
  { label: "Help", href: "/faq" },
];

export function LandingFooter() {
  const [year, setYear] = useState(2025);
  useEffect(() => setYear(new Date().getFullYear()), []);

  return (
    <footer className="border-t border-border bg-muted/30 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm text-muted-foreground">
            Spare Finance — Personal finance at peace.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {FOOTER_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className={cn(
                  "text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors",
                  href.startsWith("http") || href.startsWith("/") ? "" : ""
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© {year} Spare Finance. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
