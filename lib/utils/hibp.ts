/**
 * HaveIBeenPwned (HIBP) Password Validation Utility
 * 
 * This utility provides server-side validation for passwords against
 * the HaveIBeenPwned database using the k-anonymity approach.
 * 
 * IMPORTANT: This uses the k-anonymity approach which only sends the first
 * 5 characters of the SHA-1 hash, not the full password. This ensures
 * password privacy while still checking against the HIBP database.
 * 
 * Note: Supabase Auth's leaked password protection is only available
 * on Pro plan and above. This utility provides the same protection for
 * all plans by checking passwords server-side before creating accounts.
 */

/**
 * Check if a password has been compromised using HIBP k-anonymity API
 * 
 * @param password - The password to check
 * @returns Promise<boolean> - true if password is compromised, false otherwise
 */
// Simple in-memory cache to avoid repeated API calls for the same prefix
// In production, consider using Redis or similar for distributed caching
const hibpCache = new Map<string, { data: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache TTL

/**
 * Check if a password has been compromised using HIBP k-anonymity API
 * 
 * @param password - The password to check
 * @returns Promise<boolean> - true if password is compromised, false otherwise
 */
export async function isPasswordCompromised(password: string): Promise<boolean> {
  try {
    // Import crypto for SHA-1 hashing
    const crypto = await import("crypto");
    
    // Hash the password using SHA-1
    const hash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
    
    // Get the first 5 characters (prefix) and the rest (suffix)
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    // Check cache first
    const cached = hibpCache.get(prefix);
    const now = Date.now();
    
    let responseText: string;
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      // Use cached data
      responseText = cached.data;
    } else {
      // Query HIBP API with only the prefix (k-anonymity)
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: {
          "User-Agent": "SpareFinance-PasswordCheck/1.0",
          "Add-Padding": "true", // Add padding to prevent timing attacks
        },
      });
      
      if (!response.ok) {
        // If API is unavailable, log but don't block (fail open)
        // This ensures service availability even if HIBP API is down
        console.warn("HIBP API unavailable, skipping password check");
        return false;
      }
      
      responseText = await response.text();
      
      // Cache the response
      hibpCache.set(prefix, { data: responseText, timestamp: now });
      
      // Limit cache size to prevent memory issues (keep last 1000 entries)
      if (hibpCache.size > 1000) {
        const firstKey = hibpCache.keys().next().value;
        hibpCache.delete(firstKey);
      }
    }
    
    // Check if the suffix (remaining hash) is in the response
    // Response format: SUFFIX:COUNT (one per line)
    const lines = responseText.split("\n");
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      const [hashSuffix, count] = trimmedLine.split(":");
      if (hashSuffix === suffix) {
        const breachCount = parseInt(count?.trim() || "0", 10);
        if (breachCount > 0) {
          console.log(`Password found in HIBP database (${breachCount} breaches)`);
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    // Fail open - if there's an error, don't block the user
    // Log the error for monitoring
    console.error("Error checking password against HIBP:", error);
    return false;
  }
}

/**
 * Validate password and check against HIBP
 * 
 * @param password - The password to validate
 * @returns Promise<{ isValid: boolean; error?: string }>
 */
export async function validatePasswordAgainstHIBP(
  password: string
): Promise<{ isValid: boolean; error?: string }> {
  // Basic validation
  if (!password || password.length < 8) {
    return {
      isValid: false,
      error: "Password must be at least 8 characters long",
    };
  }
  
  // Check against HIBP
  const isCompromised = await isPasswordCompromised(password);
  
  if (isCompromised) {
    return {
      isValid: false,
      error: "This password has appeared in a data breach. Please choose a different password.",
    };
  }
  
  return { isValid: true };
}

