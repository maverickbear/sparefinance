"use client";

import Script from "next/script";
import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";

// Declare the Stripe pricing table custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "stripe-pricing-table": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "pricing-table-id": string;
          "publishable-key": string;
          appearance?: string;
        },
        HTMLElement
      >;
    }
  }
}

export function StripePricingTable() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Determine if dark mode is active
  const isDark = resolvedTheme === "dark" || theme === "dark";
  const appearance = isDark ? "night" : "stripe";

  // Handle hydration - wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update appearance when theme changes
  useEffect(() => {
    if (mounted) {
      const pricingTable = document.querySelector("stripe-pricing-table");
      if (pricingTable) {
        pricingTable.setAttribute("appearance", appearance);
      }
    }
  }, [mounted, appearance]);

  return (
    <>
      <Script
        async
        src="https://js.stripe.com/v3/pricing-table.js"
        strategy="afterInteractive"
      />
      {/* @ts-expect-error - Stripe custom element type not fully recognized by TypeScript */}
      <stripe-pricing-table
        pricing-table-id="prctbl_1SSuVUEj1ttZtjC0ZdPrMniP"
        publishable-key="pk_live_51SQHmOEj1ttZtjC0C7A9ReTcCvQLyaMJoXEkM844AfX8GUih7QczN0q9YiXLduNX6fksfsttaYqv5bgklGjKCPKd008Th0Tzgx"
        appearance={mounted ? appearance : "stripe"}
      />
    </>
  );
}

