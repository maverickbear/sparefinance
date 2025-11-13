"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface StripePricingTableProps {
  pricingTableId: string;
  publishableKey: string;
  customerId?: string;
  customerEmail?: string;
  clientReferenceId?: string; // Optional: for tracking the user in your system
}

export function StripePricingTable({
  pricingTableId,
  publishableKey,
  customerId,
  customerEmail,
  clientReferenceId,
}: StripePricingTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    // Initialize Stripe Pricing Table
    const loadPricingTable = () => {
      if (!containerRef.current) return;

      try {
        // Clear container
        containerRef.current.innerHTML = "";

        // Create pricing table using Stripe custom element
        // The script from https://js.stripe.com/v3/pricing-table.js registers a custom element
        // See: https://docs.stripe.com/payments/checkout/pricing-table
        const pricingTableElement = document.createElement("stripe-pricing-table");
        pricingTableElement.setAttribute("pricing-table-id", pricingTableId);
        pricingTableElement.setAttribute("publishable-key", publishableKey);
        
        if (customerId) {
          pricingTableElement.setAttribute("customer-id", customerId);
        }
        
        if (customerEmail) {
          pricingTableElement.setAttribute("customer-email", customerEmail);
        }

        if (clientReferenceId) {
          pricingTableElement.setAttribute("client-reference-id", clientReferenceId);
        }

        containerRef.current.appendChild(pricingTableElement);
      } catch (error) {
        console.error("Error loading Stripe Pricing Table:", error);
      }
    };

    loadPricingTable();
  }, [isLoaded, pricingTableId, publishableKey, customerId, customerEmail, clientReferenceId]);

  return (
    <>
      <Script
        src="https://js.stripe.com/v3/pricing-table.js"
        onLoad={() => setIsLoaded(true)}
        strategy="lazyOnload"
      />
      <div ref={containerRef} className="w-full" />
    </>
  );
}

// No need to extend Window - Stripe Pricing Table uses custom elements

