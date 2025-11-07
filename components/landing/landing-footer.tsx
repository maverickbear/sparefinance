"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    Product: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
    Company: [
      { label: "About", href: "#about" },
      { label: "Contact", href: "#contact" },
      { label: "Privacy", href: "#privacy" },
    ],
    Resources: [
      { label: "Documentation", href: "#docs" },
      { label: "Support", href: "#support" },
      { label: "Blog", href: "#blog" },
    ],
  };

  return (
    <footer className="bg-muted/50 border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-[12px]">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xl font-bold">Spare Finance</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-md">
              Simple, modern, and designed to put you in control of your future.
              Track expenses, manage budgets, and achieve your financial goals.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold mb-4">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} Spare Finance. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <Link
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

