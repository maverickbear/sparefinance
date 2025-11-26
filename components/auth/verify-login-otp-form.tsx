"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader2, AlertCircle, Mail, HelpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { setTrustedBrowser } from "@/lib/utils/trusted-browser";

interface VerifyLoginOtpFormProps {
  email: string;
  invitationToken?: string | null;
  onBack?: () => void;
}

/**
 * Preloads user, profile, and billing data into global caches
 * This ensures data is ready immediately when user navigates after login/signup
 */
async function preloadUserData() {
  try {
    const preloadPromises = [
      // Preload user data and role for Nav
      Promise.all([
        import("@/lib/api/user-client").then(m => m.getUserClient()),
        import("@/lib/api/members-client").then(m => m.getUserRoleClient()),
      ]).then(async ([userData, role]) => {
        if (typeof window !== 'undefined' && (window as any).navUserDataCache) {
          (window as any).navUserDataCache.data = userData;
          (window as any).navUserDataCache.timestamp = Date.now();
          (window as any).navUserDataCache.role = role;
          (window as any).navUserDataCache.roleTimestamp = Date.now();
        }
        return userData;
      }).catch(() => null),
      // Preload profile data
      import("@/lib/api/profile-client").then(async (m) => {
        const profile = await m.getProfileClient();
        if (typeof window !== 'undefined' && (window as any).profileDataCache) {
          (window as any).profileDataCache.data = profile;
          (window as any).profileDataCache.timestamp = Date.now();
        }
        return profile;
      }).catch(() => null),
      // Preload subscription/billing data (without limits - loaded later when needed)
      fetch("/api/billing/subscription", { cache: "no-store" }).then(async (r) => {
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
        if (typeof window !== 'undefined' && (window as any).billingDataCache) {
          (window as any).billingDataCache.data = billingData;
          (window as any).billingDataCache.timestamp = Date.now();
        }
        return billingData;
      }).catch(() => null),
    ];
    await Promise.allSettled(preloadPromises);
  } catch (preloadError) {
    console.debug("Preload failed:", preloadError);
  }
}

export function VerifyLoginOtpForm({ email, invitationToken, onBack }: VerifyLoginOtpFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [trustBrowser, setTrustBrowser] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      let data: any = null;
      let verifyError: any = null;

      // Try email type first
      const emailResult = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });

      if (emailResult.error) {
        // If email type fails, try magiclink type
        const magiclinkResult = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: "magiclink",
        });

        if (magiclinkResult.error) {
          // If magiclink also fails, try recovery type (in case user requested password recovery)
          const recoveryResult = await supabase.auth.verifyOtp({
            email,
            token: otpCode,
            type: "recovery",
          });

          if (recoveryResult.error) {
            verifyError = recoveryResult.error;
          } else {
            data = recoveryResult.data;
          }
        } else {
          data = magiclinkResult.data;
        }
      } else {
        data = emailResult.data;
      }

      if (verifyError) {
        setError(verifyError.message || "Invalid verification code. Please try again.");
        // Clear OTP on error
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      if (!data.user || !data.session) {
        setError("Verification failed. Please try again.");
        return;
      }

      // Check if email is confirmed
      if (!data.user.email_confirmed_at) {
        setError("Email verification failed. Please try again.");
        return;
      }

      // Wait a moment to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh session to ensure cookies are set correctly
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.warn("Error refreshing session after OTP verification:", refreshError);
        // Continue anyway - session might still be valid
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
        const { getUserRoleClient } = await import("@/lib/api/members-client");
        const role = await getUserRoleClient();

        if (role !== "super_admin") {
          // Not super_admin - redirect to maintenance page
          router.push("/maintenance");
          return;
        }
      }

      // If there's an invitation token, accept the invitation after login
      if (invitationToken && data.user) {
        try {
          const acceptResponse = await fetch("/api/members/invite/accept", {
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
      const maxAttempts = 3;

      while (attempts < maxAttempts && (!currentUser || userError)) {
        const result = await supabase.auth.getUser();
        currentUser = result.data.user;
        userError = result.error;

        if (userError || !currentUser) {
          attempts++;
          if (attempts < maxAttempts) {
            // Wait a bit longer between attempts in production
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else {
          break;
        }
      }
      
      if (userError || !currentUser) {
        console.error("Session verification failed after", maxAttempts, "attempts:", userError);
        setError("Failed to establish session. Please try again.");
        return;
      }

      // Wait additional time to ensure session is fully propagated to Supabase backend
      // This is critical to avoid "Session not found" errors when calling getUserClient()
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
      } catch (preloadError: any) {
        // If it's a session error, wait a bit more and try again
        if (preloadError?.message?.includes("Session not found") || 
            preloadError?.message?.includes("session") ||
            preloadError?.status === 401) {
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

      // Always redirect to dashboard after login
      // Use window.location.replace with cache-busting to ensure fresh page load
      // This bypasses service worker cache and ensures new session is loaded
      const timestamp = Date.now();
      window.location.replace(`/dashboard?_t=${timestamp}`);
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

      // Use API route to resend login OTP (doesn't require password)
      const response = await fetch("/api/auth/resend-login-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
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
        setError(data.error || "Failed to resend code. Please try again.");
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
        <div className="rounded-[12px] bg-destructive/10 border border-destructive/20 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-[12px] bg-green-500/10 border border-green-500/20 p-4 flex items-start gap-3">
          <Mail className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-600">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
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
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-2">
          <Checkbox
            id="trust-browser"
            checked={trustBrowser}
            onCheckedChange={(checked) => setTrustBrowser(checked === true)}
            disabled={loading}
            className="mt-0.5"
          />
          <div className="flex items-center gap-1.5 flex-1">
            <label
              htmlFor="trust-browser"
              className="text-sm text-foreground cursor-pointer select-none"
            >
              Trust this browser
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
                Only enable this on personal or trusted devices. We'll still ask for your password on future logins, but we won't require a verification code on this browser for a while.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Button 
          onClick={handleVerify}
          className="w-full h-11 text-base font-medium" 
          disabled={loading || otp.join("").length !== 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify and Sign In"
          )}
        </Button>
      </div>

      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Didn't receive the code?
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={handleResend}
          disabled={resending || loading}
          className="text-sm"
        >
          {resending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Resending...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4 mr-2" />
              Resend Code
            </>
          )}
        </Button>
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

