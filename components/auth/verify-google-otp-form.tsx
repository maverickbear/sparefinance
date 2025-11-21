"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
          verifyError = magiclinkResult.error;
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
      }

      // Verify session is established
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        console.error("Session verification failed:", userError);
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

      // Preload user and plan data
      await preloadUserData();

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

      // Use window.location.href for a full page reload to ensure cookies are read correctly
      // This is more reliable in production where cookie settings are stricter
      // The full page reload ensures the server-side middleware and layout can read the cookies
      window.location.href = "/dashboard";
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

