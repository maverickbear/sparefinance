"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader2, AlertCircle, HelpCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { setTrustedBrowser } from "@/lib/utils/trusted-browser";

/** Window augmentation for global caches used by nav/profile/billing (set by layout/header). */
interface WindowWithCaches extends Window {
  navUserDataCache?: { data: unknown; timestamp: number; role?: string; roleTimestamp?: number };
  profileDataCache?: { data: unknown; timestamp: number };
  billingDataCache?: { data: unknown; timestamp: number };
}

interface VerifyLoginOtpFormProps {
  email: string;
  invitationToken?: string | null;
  onBack?: () => void;
  /** When set, redirect here after successful verification instead of /dashboard */
  redirectTo?: string;
}

/**
 * Preloads user, profile, and billing data into global caches
 * This ensures data is ready immediately when user navigates after login/signup
 */
async function preloadUserData() {
  try {
    const preloadPromises = [
      // Preload user data and role for Nav using API routes
      // Use cachedFetch to respect Cache-Control headers
      (async () => {
        const { cachedFetch } = await import("@/lib/utils/cached-fetch");
        try {
          const [userData, membersData] = await Promise.all([
            cachedFetch("/api/v2/user"),
            cachedFetch("/api/v2/members"),
          ]);
          const userDataFormatted = {
            user: userData.user,
            plan: userData.plan,
            subscription: userData.subscription,
          };
          const role = membersData.userRole;
          const navCache = typeof window !== "undefined" ? (window as WindowWithCaches).navUserDataCache : undefined;
          if (navCache) {
            navCache.data = userDataFormatted;
            navCache.timestamp = Date.now();
            navCache.role = role;
            navCache.roleTimestamp = Date.now();
          }
          return userDataFormatted;
        } catch {
          return null;
        }
      })(),
      // Preload profile data using API route
      (async () => {
        const { cachedFetch } = await import("@/lib/utils/cached-fetch");
          try {
            const profile = await cachedFetch("/api/v2/profile");
            const profileCache = typeof window !== "undefined" ? (window as WindowWithCaches).profileDataCache : undefined;
            if (profileCache) {
              profileCache.data = profile;
              profileCache.timestamp = Date.now();
            }
            return profile;
        } catch {
          return null;
        }
      })(),
      // Preload subscription/billing data (without limits - loaded later when needed)
      fetch("/api/v2/billing/subscription", { cache: "no-store" }).then(async (r) => {
        if (!r.ok) return null;
        const subData = await r.json();
        if (!subData) return null;
        
        const billingData = {
          subscription: subData.subscription,
          plan: subData.plan,
          limits: subData.limits,
          transactionLimit: null,
          accountLimit: null,
          interval: subData.interval || null,
        };
        const billingCache = typeof window !== "undefined" ? (window as WindowWithCaches).billingDataCache : undefined;
        if (billingCache) {
          billingCache.data = billingData;
          billingCache.timestamp = Date.now();
        }
        return billingData;
      }).catch(() => null),
    ];
    await Promise.allSettled(preloadPromises);
  } catch (preloadError) {
    console.debug("Preload failed:", preloadError);
  }
}

export function VerifyLoginOtpForm({ email, invitationToken, onBack, redirectTo }: VerifyLoginOtpFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [trustBrowser, setTrustBrowser] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isVerifyingRef = useRef(false);

  // Detect development environment on client side only (avoid hydration mismatch)
  useEffect(() => {
    const isLocalhost = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    setIsDevelopment(isLocalhost);
  }, []);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer for OTP expiration
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle OTP input change
  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Auto-verify when all 6 digits are entered
  useEffect(() => {
    const otpCode = otp.join("");
    if (otpCode.length === 6 && !loading && !isVerifyingRef.current && email) {
      isVerifyingRef.current = true;
      // Use a small delay to ensure state is updated
      const timer = setTimeout(() => {
        handleVerify().finally(() => {
          isVerifyingRef.current = false;
        });
      }, 100);
      return () => {
        clearTimeout(timer);
        isVerifyingRef.current = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, loading, email]);

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    const digits = pastedData.replace(/\D/g, "").slice(0, 6);

    if (digits.length === 6) {
      const newOtp = digits.split("");
      setOtp(newOtp);
      setError(null);
      // Focus last input
      inputRefs.current[5]?.focus();
    }
  };

  // Verify OTP
  async function handleVerify() {
    const otpCode = otp.join("");
    
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    if (!email) {
      setError("Email is required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Verify OTP with Supabase
      // Try "email" type first (for numeric OTP), then "magiclink", then "recovery" as fallbacks
      let data: { user: User | null; session: Session | null } | null = null;
      let verifyError: AuthError | null = null;

      // Try email type first (for numeric OTP sent via email)
      console.log("[LOGIN-OTP] Verifying OTP with email type...");
      const emailResult = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });

      if (emailResult.error) {
        console.log("[LOGIN-OTP] Email type failed, trying magiclink type...", emailResult.error.message);
        // If email type fails, try magiclink type
        const magiclinkResult = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: "magiclink",
        });

        if (magiclinkResult.error) {
          console.log("[LOGIN-OTP] Magiclink type failed, trying recovery type...", magiclinkResult.error.message);
          // If magiclink also fails, try recovery type (in case user requested password recovery)
          const recoveryResult = await supabase.auth.verifyOtp({
            email,
            token: otpCode,
            type: "recovery",
          });

          if (recoveryResult.error) {
            console.error("[LOGIN-OTP] All OTP types failed. Last error:", recoveryResult.error);
            verifyError = recoveryResult.error;
          } else {
            console.log("[LOGIN-OTP] OTP verified successfully with recovery type");
            data = recoveryResult.data;
          }
        } else {
          console.log("[LOGIN-OTP] OTP verified successfully with magiclink type");
          data = magiclinkResult.data;
        }
      } else {
        console.log("[LOGIN-OTP] OTP verified successfully with email type");
        data = emailResult.data;
      }

      // If verification succeeded, clear error immediately
      if (data && data.user) {
        setError(null);
      }

      if (verifyError) {
        console.error("[LOGIN-OTP] OTP verification error:", verifyError);
        setError(verifyError.message || "Invalid verification code. Please try again.");
        // Clear OTP on error
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      // CRITICAL: Ensure session is set explicitly after verifyOtp
      // The createBrowserClient should handle this automatically, but we need to ensure it happens
      if (data && data.session) {
        console.log("[LOGIN-OTP] Setting session explicitly after OTP verification");
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        
        if (setSessionError) {
          console.error("[LOGIN-OTP] Error setting session:", setSessionError);
          setError("Failed to establish session. Please try again.");
          setLoading(false);
          return;
        }
        console.log("[LOGIN-OTP] Session set successfully");
      } else if (!data || !data.user) {
        console.error("[LOGIN-OTP] No user data returned from OTP verification");
        setError("Verification failed. Please try again.");
        setLoading(false);
        return;
      } else if (!data.session) {
        // Session might be established but not in response - check for it
        console.log("[LOGIN-OTP] OTP verified but no session in response, checking for existing session...");
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try multiple times to get the session
        let checkUser = null;
        let checkSession = null;
        for (let i = 0; i < 3; i++) {
          const userResult = await supabase.auth.getUser();
          const sessionResult = await supabase.auth.getSession();
          checkUser = userResult.data.user;
          checkSession = sessionResult.data.session;
        
        if (checkUser && checkSession) {
            console.log("[LOGIN-OTP] Found existing session after OTP verification");
            data.session = checkSession;
            break;
          }
          
          if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (!checkUser || !checkSession) {
          console.error("[LOGIN-OTP] No session found after OTP verification");
        setError("Verification failed. Please try again.");
          setLoading(false);
        return;
        }
      }

      // Check if email is confirmed
      if (!data.user?.email_confirmed_at) {
        setError("Email verification failed. Please try again.");
        return;
      }

      // Wait a moment to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify session is accessible before proceeding
      const { data: { session: verifySession }, error: sessionVerifyError } = await supabase.auth.getSession();
      if (sessionVerifyError || !verifySession) {
        console.error("[LOGIN-OTP] Session not accessible after setting:", sessionVerifyError);
        // Try to set it again
        if (data.session) {
          const { error: retryError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          if (retryError) {
            console.error("[LOGIN-OTP] Failed to set session on retry:", retryError);
            setError("Failed to establish session. Please try again.");
            setLoading(false);
            return;
          }
        }
      } else {
        console.log("[LOGIN-OTP] Session verified and accessible");
      }

      // In production, sync session with server to ensure cookies are properly set
      // This is critical for production where cookie settings (secure, sameSite) need to match
      try {
        const syncResponse = await fetch("/api/auth/sync-session", {
          method: "POST",
          credentials: "include", // Important: include cookies
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!syncResponse.ok) {
          console.warn("Failed to sync session with server, but continuing...");
        } else {
          console.log("Session synced with server successfully");
        }
      } catch (syncError) {
        console.warn("Error syncing session with server:", syncError);
        // Continue anyway - client-side session might still work
      }

      // Check maintenance mode
      let isMaintenanceMode = false;
      try {
        const maintenanceResponse = await fetch("/api/system-settings/public");
        if (maintenanceResponse.ok) {
          const maintenanceData = await maintenanceResponse.json();
          isMaintenanceMode = maintenanceData.maintenanceMode || false;
        }
      } catch (maintenanceError) {
        console.error("Error checking maintenance mode:", maintenanceError);
      }

      // If maintenance mode is active, check if user is super_admin
      if (isMaintenanceMode) {
        const response = await fetch("/api/v2/members");
        if (!response.ok) {
          throw new Error("Failed to fetch user role");
        }
        const { userRole: role } = await response.json();

        if (role !== "super_admin") {
          // Not super_admin - redirect to maintenance page
          router.push("/maintenance");
          return;
        }
      }

      // If there's an invitation token, accept the invitation after login
      if (invitationToken && data.user) {
        try {
          const acceptResponse = await fetch("/api/v2/members/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: invitationToken }),
          });

          if (acceptResponse.ok) {
            console.log("Invitation accepted after login");
          } else {
            const acceptError = await acceptResponse.json();
            console.error("Error accepting invitation:", acceptError);
          }
        } catch (acceptError) {
          console.error("Error accepting invitation:", acceptError);
        }
      }

      // Store that password was the last used authentication method
      if (typeof window !== "undefined") {
        localStorage.setItem("lastAuthMethod", "password");
      }

      // Store trusted browser if user checked the option
      if (trustBrowser && email) {
        setTrustedBrowser(email);
      }

      // Verify session is established before proceeding
      // Use getUser instead of getSession for more reliable check
      // In production, we may need multiple attempts due to cookie propagation delays
      let currentUser = null;
      let userError = null;
      let attempts = 0;
      const maxAttempts = 5; // Increased from 3 to 5 for more reliability

      while (attempts < maxAttempts && (!currentUser || userError)) {
        // Try to get session first to ensure it's loaded
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        // If we have a session, try to refresh it to ensure it's valid
        if (currentSession) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.warn(`[LOGIN-OTP] Session refresh error on attempt ${attempts + 1}:`, refreshError);
          }
        }
        
        // Now try to get user
        const result = await supabase.auth.getUser();
        currentUser = result.data.user;
        userError = result.error;

        if (userError || !currentUser) {
          attempts++;
          console.log(`[LOGIN-OTP] Session verification attempt ${attempts}/${maxAttempts} failed:`, userError?.message || "No user");
          
          if (attempts < maxAttempts) {
            // Wait progressively longer between attempts
            const waitTime = attempts * 500; // 500ms, 1000ms, 1500ms, 2000ms
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Try syncing session again if we're on a later attempt
            if (attempts >= 2) {
              try {
                await fetch("/api/auth/sync-session", {
                  method: "POST",
                  credentials: "include",
                  headers: {
                    "Content-Type": "application/json",
                  },
                });
              } catch (syncError) {
                console.warn("[LOGIN-OTP] Error re-syncing session:", syncError);
              }
            }
          }
        } else {
          console.log("[LOGIN-OTP] Session verified successfully on attempt", attempts + 1);
          break;
        }
      }
      
      if (userError || !currentUser) {
        console.error("[LOGIN-OTP] Session verification failed after", maxAttempts, "attempts:", {
          error: userError?.message,
          code: userError?.code,
          status: userError?.status,
        });
        setError("Failed to establish session. Please try again.");
        setLoading(false);
        return;
      }

      // Wait additional time to ensure session is fully propagated to Supabase backend
      // This is critical to avoid "Session not found" errors when calling API routes
      console.log("[LOGIN-OTP] Waiting for session to propagate to Supabase backend...");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify session one more time before preloading data
      const { data: { user: verifyUser }, error: verifySessionError } = await supabase.auth.getUser();
      if (verifySessionError || !verifyUser) {
        console.warn("[LOGIN-OTP] Session verification failed before preload, retrying...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Preload user and plan data while showing loading
      // Wrap in try-catch to handle "Session not found" errors gracefully
      try {
        await preloadUserData();
      } catch (preloadError: unknown) {
        const err = preloadError as { message?: string; status?: number } | null;
        // If it's a session error, wait a bit more and try again
        if (err?.message?.includes("Session not found") ||
            err?.message?.includes("session") ||
            err?.status === 401) {
          console.warn("[LOGIN-OTP] Session not ready for preload, waiting and retrying...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            await preloadUserData();
          } catch (retryError) {
            console.warn("[LOGIN-OTP] Preload failed on retry, but continuing with redirect:", retryError);
            // Continue anyway - data will be loaded on the dashboard
          }
        } else {
          console.warn("[LOGIN-OTP] Preload error (non-session):", preloadError);
          // Continue anyway - data will be loaded on the dashboard
        }
      }

      // Redirect after login: use redirectTo when provided, else super_admin → /admin, others → /dashboard
      let target = redirectTo;
      if (!target) {
        try {
          const res = await fetch("/api/v2/members");
          if (res.ok) {
            const { userRole } = await res.json();
            target = userRole === "super_admin" ? "/admin" : "/dashboard";
          } else {
            target = "/dashboard";
          }
        } catch {
          target = "/dashboard";
        }
      }
      const timestamp = Date.now();
      window.location.replace(`${target}?_t=${timestamp}`);
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Resend OTP
  async function handleResend() {
    if (!email) {
      setError("Email is required");
      return;
    }

    try {
      setResending(true);
      setError(null);
      setSuccessMessage(null);

      // Call resend-login-otp API route
      const requestBody: { email: string } = { email };

      // Use API route to resend login OTP (doesn't require password)
      const response = await fetch("/api/auth/resend-login-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Clear OTP and show success message
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setError(null);
        setSuccessMessage("Code resent successfully! Please check your inbox.");
        setTimeRemaining(300); // Reset timer to 5 minutes
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const errorMessage = data.error || "Failed to resend code. Please try again.";
        console.error("[LOGIN-OTP] Resend error:", {
          status: response.status,
          error: errorMessage,
          isDevelopment,
        });
        setError(errorMessage);
      }
    } catch (error) {
      console.error("Error resending OTP:", error);
      setError("Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col items-center justify-start space-y-4">
        <div className="flex flex-col items-center justify-start space-y-2">
          <label className="text-sm font-medium text-foreground">
            Verification Code
          </label>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-medium">{email}</span>
          </p>
          {timeRemaining > 0 && (
            <p className="text-sm text-muted-foreground">
              Code expires in: <span className="font-medium text-foreground">{formatTime(timeRemaining)}</span>
            </p>
          )}
          {timeRemaining === 0 && (
            <p className="text-sm text-destructive font-medium">
              Code has expired. Please request a new one.
            </p>
          )}
        </div>

        <div className="flex gap-2 justify-center">
          {otp.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={loading}
              className="w-12 h-14 text-center text-lg font-semibold"
              autoComplete="off"
            />
          ))}
        </div>
        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying...</span>
          </div>
        )}
      </div>

      <div className="flex flex-col justify-start items-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Checkbox
            id="trust-browser"
            checked={trustBrowser}
            onCheckedChange={(checked) => setTrustBrowser(checked === true)}
            disabled={loading}
            className="mt-0.5"
          />
          <div className="flex items-center gap-1.5 w-fit">
            <label
              htmlFor="trust-browser"
              className="text-sm text-foreground cursor-pointer select-none"
            >
              Don&apos;t ask again for this browser
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  disabled={loading}
                  tabIndex={-1}
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[280px] whitespace-normal">
                Only enable this on personal or trusted devices. We&apos;ll still ask for your password on future logins, but we won&apos;t require a verification code on this browser for a while.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground inline">
          Didn&apos;t receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || loading}
            className="text-sm text-foreground hover:underline font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resending ? (
              <>
                <Loader2 className="w-4 h-4 inline mr-1 animate-spin" />
                Resending...
              </>
            ) : (
              "Resend Code"
            )}
          </button>
        </p>
      </div>

      {onBack && (
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={loading || resending}
          className="w-full text-sm"
        >
          Back to login
        </Button>
      )}
    </div>
  );
}

