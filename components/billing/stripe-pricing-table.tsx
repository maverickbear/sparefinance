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
  const scriptLoadedRef = useRef(false);

  // Check if script is already loaded and load it if needed
  useEffect(() => {
    // Check if custom element is already defined
    if (typeof window !== "undefined" && customElements.get("stripe-pricing-table")) {
      setIsLoaded(true);
      scriptLoadedRef.current = true;
      return;
    }

    // Check if the script is already in the DOM (from Next.js Script or manually loaded)
    const existingScript = document.querySelector(
      'script[src="https://js.stripe.com/v3/pricing-table.js"]'
    );

    // If script exists but custom element not yet defined, wait for it
    if (existingScript) {
      const checkCustomElement = setInterval(() => {
        if (customElements.get("stripe-pricing-table")) {
          setIsLoaded(true);
          scriptLoadedRef.current = true;
          clearInterval(checkCustomElement);
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkCustomElement);
      }, 5000);

      return () => clearInterval(checkCustomElement);
    }
    // If no script exists, the Next.js Script component will load it
    // But we also set up a MutationObserver to detect when it's added
    const observer = new MutationObserver(() => {
      const script = document.querySelector(
        'script[src="https://js.stripe.com/v3/pricing-table.js"]'
      );
      if (script && !scriptLoadedRef.current) {
        // Script was added, wait for it to load and custom element to register
        const checkInterval = setInterval(() => {
          if (customElements.get("stripe-pricing-table")) {
            setIsLoaded(true);
            scriptLoadedRef.current = true;
            clearInterval(checkInterval);
            observer.disconnect();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
        }, 5000);
      }
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!containerRef.current) return;

    // Initialize Stripe Pricing Table
    const loadPricingTable = () => {
      if (!containerRef.current) return;

      // Wait a bit to ensure custom element is fully registered
      const initTable = () => {
        try {
          // Clear container
          containerRef.current!.innerHTML = "";

          // Verify custom element is available
          if (!customElements.get("stripe-pricing-table")) {
            console.warn("Stripe pricing table custom element not yet available, retrying...");
            setTimeout(initTable, 100);
            return;
          }

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

          containerRef.current!.appendChild(pricingTableElement);
        } catch (error) {
          console.error("Error loading Stripe Pricing Table:", error);
        }
      };

      initTable();
    };

    loadPricingTable();
  }, [isLoaded, pricingTableId, publishableKey, customerId, customerEmail, clientReferenceId]);

  const handleScriptLoad = () => {
    // Small delay to ensure custom element is registered
    setTimeout(() => {
      if (customElements.get("stripe-pricing-table")) {
        setIsLoaded(true);
        scriptLoadedRef.current = true;
      } else {
        // Retry checking if not immediately available
        const checkInterval = setInterval(() => {
          if (customElements.get("stripe-pricing-table")) {
            setIsLoaded(true);
            scriptLoadedRef.current = true;
            clearInterval(checkInterval);
          }
        }, 100);
        setTimeout(() => clearInterval(checkInterval), 5000);
      }
    }, 100);
  };

  return (
    <>
      <Script
        src="https://js.stripe.com/v3/pricing-table.js"
        onLoad={handleScriptLoad}
        strategy="afterInteractive"
        id="stripe-pricing-table-script"
      />
      <div ref={containerRef} className="w-full" />
    </>
  );
}

// No need to extend Window - Stripe Pricing Table uses custom elements

