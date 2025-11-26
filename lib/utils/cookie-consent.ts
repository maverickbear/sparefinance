/**
 * Cookie Consent Utilities
 * 
 * Helper functions to check and manage cookie consent status
 * for controlling analytics and non-essential scripts.
 */

export type CookieConsentStatus = "accepted" | "rejected" | "unknown";

const STORAGE_KEY = "sparefinance_cookie_consent";

/**
 * Get the current cookie consent status from localStorage
 * @returns The current consent status
 */
export function getCookieConsentStatus(): CookieConsentStatus {
  if (typeof window === "undefined") {
    return "unknown";
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "accepted" || stored === "rejected") {
    return stored;
  }
  return "unknown";
}

/**
 * Check if analytics and non-essential cookies are allowed
 * @returns true if user accepted all cookies, false otherwise
 */
export function isAnalyticsAllowed(): boolean {
  return getCookieConsentStatus() === "accepted";
}

/**
 * Check if only essential cookies are allowed
 * @returns true if user rejected non-essential cookies
 */
export function isEssentialOnly(): boolean {
  return getCookieConsentStatus() === "rejected";
}

/**
 * Check if user has made a consent decision
 * @returns true if user has accepted or rejected, false if unknown
 */
export function hasConsentDecision(): boolean {
  const status = getCookieConsentStatus();
  return status === "accepted" || status === "rejected";
}

