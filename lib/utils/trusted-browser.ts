/**
 * Trusted Browser Management
 * 
 * Stores and checks if a browser is trusted for a specific user.
 * When trusted, users can skip OTP verification on future logins.
 * 
 * Security considerations:
 * - Trust is stored per email address
 * - Uses a browser fingerprint for additional security
 * - Trust expires after 30 days
 */

const TRUSTED_BROWSER_PREFIX = "trusted_browser_";
const TRUST_EXPIRY_DAYS = 30;

interface TrustedBrowserData {
  email: string;
  fingerprint: string;
  expiresAt: number; // timestamp
}

/**
 * Generates a simple browser fingerprint
 * This is a basic implementation - in production, you might want a more sophisticated approach
 */
function generateBrowserFingerprint(): string {
  if (typeof window === "undefined") return "";
  
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx?.fillText("Browser fingerprint", 2, 2);
  const canvasFingerprint = canvas.toDataURL();
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    canvasFingerprint.substring(0, 50), // First 50 chars of canvas fingerprint
  ].join("|");
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Stores trusted browser information for an email
 */
export function setTrustedBrowser(email: string): void {
  if (typeof window === "undefined") return;
  
  const fingerprint = generateBrowserFingerprint();
  const expiresAt = Date.now() + (TRUST_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
  const data: TrustedBrowserData = {
    email: email.toLowerCase().trim(),
    fingerprint,
    expiresAt,
  };
  
  const key = `${TRUSTED_BROWSER_PREFIX}${data.email}`;
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Checks if the current browser is trusted for the given email
 */
export function isTrustedBrowser(email: string): boolean {
  if (typeof window === "undefined") return false;
  
  const key = `${TRUSTED_BROWSER_PREFIX}${email.toLowerCase().trim()}`;
  const stored = localStorage.getItem(key);
  
  if (!stored) return false;
  
  try {
    const data: TrustedBrowserData = JSON.parse(stored);
    
    // Check if expired
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(key);
      return false;
    }
    
    // Check if fingerprint matches (basic security check)
    const currentFingerprint = generateBrowserFingerprint();
    if (data.fingerprint !== currentFingerprint) {
      // Fingerprint mismatch - clear trust for security
      localStorage.removeItem(key);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error checking trusted browser:", error);
    localStorage.removeItem(key);
    return false;
  }
}

/**
 * Removes trusted browser status for an email
 */
export function removeTrustedBrowser(email: string): void {
  if (typeof window === "undefined") return;
  
  const key = `${TRUSTED_BROWSER_PREFIX}${email.toLowerCase().trim()}`;
  localStorage.removeItem(key);
}

