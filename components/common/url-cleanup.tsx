"use client";

import { useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

/**
 * Component that removes cache-busting parameters from URL after page load
 * This keeps the URL clean while still allowing cache-busting to work during navigation
 */
export function UrlCleanup() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check if _t parameter exists
    const hasTimestamp = searchParams.has("_t");

    if (hasTimestamp) {
      // Create new URLSearchParams without _t
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("_t");

      // Build new URL
      const newUrl = newParams.toString()
        ? `${pathname}?${newParams.toString()}`
        : pathname;

      // Replace URL without _t parameter (without page reload)
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  return null;
}

