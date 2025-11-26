"use client";

import { useState, useEffect, useCallback } from "react";

export type CookieConsentStatus = "accepted" | "rejected" | "unknown";

const STORAGE_KEY = "sparefinance_cookie_consent";

/**
 * Hook for managing cookie consent state
 * 
 * Provides functions to accept or reject non-essential cookies,
 * and tracks whether the consent banner should be shown.
 */
export function useCookieConsent() {
  const [status, setStatus] = useState<CookieConsentStatus>("unknown");
  const [isMounted, setIsMounted] = useState(false);

  // Initialize from localStorage on mount (SSR-safe)
  useEffect(() => {
    setIsMounted(true);
    
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "accepted" || stored === "rejected") {
      setStatus(stored);
    } else {
      setStatus("unknown");
    }
  }, []);

  const acceptAll = useCallback(() => {
    if (typeof window === "undefined") return;
    
    localStorage.setItem(STORAGE_KEY, "accepted");
    setStatus("accepted");
  }, []);

  const rejectNonEssential = useCallback(() => {
    if (typeof window === "undefined") return;
    
    localStorage.setItem(STORAGE_KEY, "rejected");
    setStatus("rejected");
  }, []);

  // Only show banner if mounted (SSR-safe) and status is unknown
  const shouldShowBanner = isMounted && status === "unknown";

  return {
    status,
    acceptAll,
    rejectNonEssential,
    shouldShowBanner,
  };
}

