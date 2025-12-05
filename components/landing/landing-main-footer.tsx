"use client";

import Link from "next/link";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";

export function LandingMainFooter() {
  return (
    <footer className="w-full bg-background border-t border-border">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-7xl mx-auto">
          {/* CTA Section */}
          <div className="text-center mb-16 pb-16 border-b border-border">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Start Organizing Your Finances Today
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join families learning to track expenses, understand spending, and build wealth together. Stop working just to pay bills—start building your future.
            </p>
            <Button
              asChild
              size="large"
            >
              <Link href="/auth/signup">Start Organizing Your Finances</Link>
            </Button>
          </div>


          {/* Links */}
          {/* Mobile: 1 column, MD: 2 columns (avoid overlap), LG+: 4 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center mb-4">
              <Logo variant="full" color="auto" height={40} />
            </Link>
            <p className="text-sm text-muted-foreground">
              Help your family organize finances, track expenses, and learn to save together. A place where families learn to build wealth, not just pay bills.
            </p>
          </div>

          {/* Main Pages */}
          <div>
            <h3 className="font-semibold mb-4">Main Pages</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="#features"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="#pricing"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4">Legal & Utilities</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Other */}
          <div>
            <h3 className="font-semibold mb-4">Other</h3>
            <ul className="space-y-2">
              {/* <li>
                <Link
                  href="#testimonials"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Testimonials
                </Link>
              </li> */}
              <li>
                <Link
                  href="/auth/signup"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
        </div>

          {/* Bottom */}
          <div className="pt-8 border-t border-border">
            <p className="text-sm text-center text-muted-foreground">
              © {new Date().getFullYear()} Copyright - Spare Finance. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

