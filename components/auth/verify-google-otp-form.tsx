"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader2, AlertCircle, Mail, HelpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { setTrustedBrowser } from "@/lib/utils/trusted-browser";

/**
 * Preloads user, profile, and billing data into global caches
 */
async function preloadUserData() {
  try {
    const preloadPromises = [
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
      import("@/lib/api/profile-client").then(async (m) => {
        const profile = await m.getProfileClient();
        if (typeof window !== 'undefined' && (window as any).profileDataCache) {
          (window as any).profileDataCache.data = profile;
          (window as any).profileDataCache.timestamp = Date.now();
        }
        return profile;
      }).catch(() => null),
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

export function VerifyGoogleOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [trustBrowser, setTrustBrowser] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const email = searchParams.get("email") || "";
  const oauthDataStr = searchParams.get("oauth_data") || "";
  let oauthData: { name: string | null; avatarUrl: string | null; userId: string } | null = null;
  
  try {
    if (oauthDataStr) {
      oauthData = JSON.parse(decodeURIComponent(oauthDataStr));
    }
  } catch (e) {
    console.error("Error parsing OAuth data:", e);
  }

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

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    const digits = pastedData.replace(/\D/g, "").slice(0, 6);

    if (digits.length === 6) {
      const newOtp = digits.split("");
      setOtp(newOtp);
      setError(null);
      inputRefs.current[5]?.focus();
    }
  };

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
      // Try "email" type first, then "magiclink", then "recovery" as fallbacks
      let data: any = null;
      let verifyError: any = null;

      const emailResult = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });

      if (emailResult.error) {
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
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      if (!data.user || !data.session) {
        setError("Verification failed. Please try again.");
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

      // Sync session with server to ensure cookies are set correctly in production
      // This is critical for production where cookie settings need to be consistent
      try {
        const syncResponse = await fetch("/api/auth/sync-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Important: include cookies in the request
        });

        if (!syncResponse.ok) {
          console.warn("[GOOGLE-OTP] Failed to sync session with server, but continuing anyway");
        } else {
          console.log("[GOOGLE-OTP] Session synced with server successfully");
        }
      } catch (syncError) {
        console.warn("[GOOGLE-OTP] Error syncing session with server:", syncError);
        // Continue anyway - cookies might still work
      }

      // Create or update user profile and household if OAuth data is available
      if (oauthData && oauthData.userId === currentUser.id) {
        try {
          // Create user profile
          const createResponse = await fetch("/api/auth/create-user-profile", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: oauthData.userId,
              email: currentUser.email,
              name: oauthData.name,
              avatarUrl: oauthData.avatarUrl,
            }),
          });

          if (createResponse.ok) {
            console.log("[GOOGLE-OTP] User profile created/updated");
            
            // Create household and member if needed
            try {
              const householdResponse = await fetch("/api/auth/create-household-member", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  ownerId: oauthData.userId,
                  memberId: oauthData.userId,
                  email: currentUser.email,
                  name: oauthData.name,
                }),
              });

              if (householdResponse.ok) {
                console.log("[GOOGLE-OTP] Household member created");
              }
            } catch (householdError) {
              console.error("[GOOGLE-OTP] Error creating household:", householdError);
              // Continue anyway - household might already exist
            }
          }
        } catch (profileError) {
          console.error("[GOOGLE-OTP] Error creating user profile:", profileError);
          // Continue anyway - profile might already exist
        }
      }

      // Check if user is blocked
      try {
        const { data: userData, error: userError } = await supabase
          .from("User")
          .select("isBlocked, role")
          .eq("id", currentUser.id)
          .single();

        if (!userError && userData?.isBlocked && userData?.role !== "super_admin") {
          // Sign out the user
          await supabase.auth.signOut();
          router.push("/account-blocked");
          return;
        }
      } catch (blockedError) {
        console.error("Error checking user blocked status:", blockedError);
        // Continue anyway - don't block access if check fails
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

      if (isMaintenanceMode) {
        const { getUserRoleClient } = await import("@/lib/api/members-client");
        const role = await getUserRoleClient();

        if (role !== "super_admin") {
          router.push("/maintenance");
          return;
        }
      }

      // Store that Google was the last used authentication method
      if (typeof window !== "undefined") {
        localStorage.setItem("lastAuthMethod", "google");
      }

      // Store trusted browser if user checked the option
      if (trustBrowser && email) {
        setTrustedBrowser(email);
      }

      // Wait additional time to ensure session is fully propagated to Supabase backend
      // This is critical to avoid "Session not found" errors when calling getUserClient()
      console.log("[GOOGLE-OTP] Waiting for session to propagate to Supabase backend...");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify session one more time before preloading data
      const { data: { user: verifyUser }, error: verifySessionError } = await supabase.auth.getUser();
      if (verifySessionError || !verifyUser) {
        console.warn("[GOOGLE-OTP] Session verification failed before preload, retrying...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Preload user and plan data
      // Wrap in try-catch to handle "Session not found" errors gracefully
      try {
        await preloadUserData();
      } catch (preloadError: any) {
        // If it's a session error, wait a bit more and try again
        if (preloadError?.message?.includes("Session not found") || 
            preloadError?.message?.includes("session") ||
            preloadError?.status === 401) {
          console.warn("[GOOGLE-OTP] Session not ready for preload, waiting and retrying...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            await preloadUserData();
          } catch (retryError) {
            console.warn("[GOOGLE-OTP] Preload failed on retry, but continuing with redirect:", retryError);
            // Continue anyway - data will be loaded on the dashboard
          }
        } else {
          console.warn("[GOOGLE-OTP] Preload error (non-session):", preloadError);
          // Continue anyway - data will be loaded on the dashboard
        }
      }

      // Wait a bit more to ensure cookies are fully persisted before redirect
      // This is especially important in production where cookie settings are stricter
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify one more time that session is still valid before redirecting
      const { data: { user: finalUserCheck }, error: finalCheckError } = await supabase.auth.getUser();
      
      if (finalCheckError || !finalUserCheck) {
        console.error("[GOOGLE-OTP] Final session check failed:", finalCheckError);
        setError("Session verification failed. Please try again.");
        return;
      }

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

  async function handleResend() {
    if (!email) {
      setError("Email is required");
      return;
    }

    try {
      setResending(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch("/api/auth/resend-login-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Verify Your Email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification code to your email
          </p>
        </div>

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
                Don't ask again for this browser
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

        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/auth/login")}
          disabled={loading || resending}
          className="w-full text-sm"
        >
          Back to login
        </Button>
      </div>
    </div>
  );
}

