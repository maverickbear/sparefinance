"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader2, AlertCircle, HelpCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import { setTrustedBrowser } from "@/lib/utils/trusted-browser";

/**
 * Preloads user, profile, and billing data into global caches
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
          if (typeof window !== 'undefined' && (window as any).navUserDataCache) {
            (window as any).navUserDataCache.data = userDataFormatted;
            (window as any).navUserDataCache.timestamp = Date.now();
            (window as any).navUserDataCache.role = role;
            (window as any).navUserDataCache.roleTimestamp = Date.now();
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
          if (typeof window !== 'undefined' && (window as any).profileDataCache) {
            (window as any).profileDataCache.data = profile;
            (window as any).profileDataCache.timestamp = Date.now();
          }
          return profile;
        } catch {
          return null;
        }
      })(),
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

interface VerifyOtpFormProps {
  email?: string;
}

export function VerifyOtpForm({ email: propEmail }: VerifyOtpFormProps) {
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

  // Get email from props or search params
  const email = propEmail || searchParams.get("email") || "";
  const planId = searchParams.get("planId") || undefined;
  const interval = (searchParams.get("interval") as "month" | "year") || undefined;
  const fromCheckout = searchParams.get("from_checkout") === "true";
  const fromInvitation = searchParams.get("from_invitation") === "true";
  const invitationId = searchParams.get("invitationId") || undefined;
  const userId = searchParams.get("userId") || undefined;
  
  // Detect if this is a Google OAuth login
  const oauthDataStr = searchParams.get("oauth_data") || "";
  let oauthData: { name: string | null; avatarUrl: string | null; userId: string } | null = null;
  const isGoogleOAuth = !!oauthDataStr;
  
  try {
    if (oauthDataStr) {
      oauthData = JSON.parse(decodeURIComponent(oauthDataStr));
    }
  } catch (e) {
    console.error("Error parsing OAuth data:", e);
  }

  // Note: Supabase automatically sends OTP when email confirmation is enabled
  // So we don't need to send it automatically on mount
  // Users can use the "Resend Code" button if they didn't receive it

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Auto-verify when all 6 digits are entered
  const isVerifyingRef = useRef(false);

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

    // Auto-verify when all 6 digits are entered
    if (value && index === 5) {
      const otpCode = newOtp.join("");
      if (otpCode.length === 6 && !loading && !resending && !isVerifyingRef.current) {
        isVerifyingRef.current = true;
        // Longer delay to ensure the last digit is properly set and avoid race conditions
        // Pass newOtp directly to avoid state update delay
        setTimeout(() => {
          handleVerify(newOtp).finally(() => {
            isVerifyingRef.current = false;
          });
        }, 300);
      }
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
      // Auto-verify when pasting 6 digits
      if (!loading && !resending && !isVerifyingRef.current) {
        isVerifyingRef.current = true;
        // Longer delay to avoid race conditions
        // Pass newOtp directly to avoid state update delay
        setTimeout(() => {
          handleVerify(newOtp).finally(() => {
            isVerifyingRef.current = false;
          });
        }, 300);
      }
    }
  };

  // Verify OTP
  const handleVerify = async (otpOverride?: string[]) => {
    const otpToVerify = otpOverride || otp;
    const otpCode = otpToVerify.join("");
    
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
      // Don't clear error immediately - wait until we know if verification succeeded
      // This prevents showing transient errors during multiple verification attempts

      // Verify OTP with Supabase
      // For Google OAuth login, try multiple types. For signup, use "signup" type.
      let data: any = null;
      let verifyError: any = null;

      if (isGoogleOAuth) {
        // Try "email" type first, then "magiclink", then "recovery" as fallbacks
        // Don't show errors until all attempts fail
        const emailResult = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: "email",
        });

        if (emailResult.error) {
          // Small delay between attempts to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const magiclinkResult = await supabase.auth.verifyOtp({
            email,
            token: otpCode,
            type: "magiclink",
          });

          if (magiclinkResult.error) {
            // Small delay between attempts
            await new Promise(resolve => setTimeout(resolve, 200));
            
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
      } else {
        // Signup flow - use "signup" type
        const signupResult = await supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: "signup",
        });

        if (signupResult.error) {
          verifyError = signupResult.error;
        } else {
          data = signupResult.data;
        }
      }

      // If verification succeeded, clear error immediately
      if (data && data.user) {
        setError(null);
      }

      // Only show error if ALL attempts failed
      if (verifyError) {
        // Check if error is about token being already used (which means it worked)
        const isTokenUsedError = verifyError.message?.includes("already been used") || 
                                 verifyError.message?.includes("token has already been used");
        
        if (isTokenUsedError) {
          // Token was already used, which means verification succeeded elsewhere
          // Don't show error, just continue - the session might already be established
          console.log("[OTP] Token already used, checking session...");
          const { data: { user: existingUser } } = await supabase.auth.getUser();
          if (existingUser) {
            // Session exists, proceed with flow
            data = { user: existingUser, session: null };
            setError(null);
          } else {
            // No session, show error
            setError("This code has already been used. Please request a new one.");
            setOtp(["", "", "", "", "", ""]);
            inputRefs.current[0]?.focus();
            setLoading(false);
            return;
          }
        } else {
          setError(verifyError.message || "Invalid verification code. Please try again.");
          setOtp(["", "", "", "", "", ""]);
          inputRefs.current[0]?.focus();
          setLoading(false);
          return;
        }
      }

      if (!data || !data.user) {
        // Check if session might be established but not yet available
        // Wait a bit and check again before showing error
        await new Promise(resolve => setTimeout(resolve, 300));
        const { data: { user: checkUser } } = await supabase.auth.getUser();
        
        if (checkUser) {
          // Session exists, use it
          data = { user: checkUser, session: null };
        setError(null);
        } else {
        setError("Verification failed. Please try again.");
          setLoading(false);
        return;
        }
      }

      // For signup, check if email is confirmed
      if (!isGoogleOAuth && !data.user.email_confirmed_at) {
        setError("Email verification failed. Please try again.");
        setLoading(false);
        return;
      }

      // For Google OAuth login, ensure session exists
      if (isGoogleOAuth && !data.session) {
        // Wait a bit and check again - session might be establishing
        await new Promise(resolve => setTimeout(resolve, 300));
        const { data: { session: checkSession } } = await supabase.auth.getSession();
        
        if (!checkSession) {
        setError("Verification failed. Please try again.");
          setLoading(false);
        return;
        }
        // Session exists now, continue
        data.session = checkSession;
      }

      // Handle Google OAuth login flow
      if (isGoogleOAuth) {
        // Wait a moment to ensure session is fully established
        await new Promise(resolve => setTimeout(resolve, 500));

        // Refresh session to ensure cookies are set correctly
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.warn("Error refreshing session after OTP verification:", refreshError);
        }

        // Sync session with server
        try {
          const syncResponse = await fetch("/api/auth/sync-session", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!syncResponse.ok) {
            console.warn("Failed to sync session with server, but continuing...");
          }
        } catch (syncError) {
          console.warn("Error syncing session with server:", syncError);
        }

        // Verify session is established
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

        // Create or update user profile and household if OAuth data is available
        if (oauthData && oauthData.userId === currentUser.id) {
          try {
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

            // Note: createUserProfile now automatically creates household
            // No need to call create-household-member separately
          } catch (profileError) {
            console.error("Error creating user profile:", profileError);
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
            await supabase.auth.signOut();
            router.push("/account-blocked");
            return;
          }
        } catch (blockedError) {
          console.error("Error checking user blocked status:", blockedError);
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
          const response = await fetch("/api/v2/members");
          if (!response.ok) {
            throw new Error("Failed to fetch user role");
          }
          const { userRole: role } = await response.json();

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

        // Wait for session to propagate
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Verify session one more time before preloading data
        const { data: { user: verifyUser }, error: verifySessionError } = await supabase.auth.getUser();
        if (verifySessionError || !verifyUser) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Preload user and plan data
        try {
          await preloadUserData();
        } catch (preloadError: any) {
          if (preloadError?.message?.includes("Session not found") || 
              preloadError?.message?.includes("session") ||
              preloadError?.status === 401) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              await preloadUserData();
            } catch (retryError) {
              console.warn("Preload failed on retry, but continuing with redirect:", retryError);
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify one more time that session is still valid
        const { data: { user: finalUserCheck }, error: finalCheckError } = await supabase.auth.getUser();
        
        if (finalCheckError || !finalUserCheck) {
          setError("Session verification failed. Please try again.");
          return;
        }

        // Redirect to dashboard
        const timestamp = Date.now();
        window.location.replace(`/dashboard?_t=${timestamp}`);
        return;
      }

      // Signup flow - Update user_metadata in Supabase Auth with name from User table
      try {
        const updateResponse = await fetch("/api/auth/update-user-metadata", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (updateResponse.ok) {
          console.log("[OTP] User metadata updated successfully");
        } else {
          console.warn("[OTP] Failed to update user metadata (non-critical)");
        }
      } catch (error) {
        console.warn("[OTP] Error updating user metadata (non-critical):", error);
      }

      // Success! Handle post-verification flow
      // If user came from invitation, complete the invitation acceptance
      if (fromInvitation && invitationId && userId) {
        try {
          // Wait for session to be fully established
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Complete invitation acceptance
          const completeResponse = await fetch("/api/v2/members/invite/complete-after-otp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ invitationId }),
          });

          if (completeResponse.ok) {
            const completeData = await completeResponse.json();
            console.log("[OTP] Invitation completed successfully");
            
            
            // Wait longer to ensure server-side cache and subscription lookup are updated
            // The subscription lookup needs time to find the household subscription
            console.log("[OTP] Waiting for subscription cache to update...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify subscription is available before redirecting
            // This ensures the household subscription is properly inherited
            // Redirect to dashboard after completing invitation
            // Protected layout will check subscription status and handle onboarding if needed
            // No need to check subscription here - Context will handle it
            window.location.href = "/dashboard";
            return;
          } else {
            const errorData = await completeResponse.json();
            setError(errorData.error || "Failed to complete invitation. Please try again.");
            return;
          }
        } catch (error) {
          console.error("[OTP] Error completing invitation:", error);
          setError("Failed to complete invitation. Please try again.");
          return;
        }
      }

      // If user came from checkout, link their Stripe subscription
      if (fromCheckout && email) {
        try {
          // Wait for session to be fully established
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Link subscription by email
          const linkResponse = await fetch("/api/stripe/link-subscription", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
          });

          if (linkResponse.ok) {
            const linkData = await linkResponse.json();
            if (linkData.success) {
              console.log("[OTP] Subscription linked successfully");
              router.push("/dashboard");
              return;
            }
          }
        } catch (error) {
          console.error("[OTP] Error linking subscription:", error);
        }
      }

      // If planId is provided, user selected a plan before signup
      // Save it to sessionStorage so onboarding dialog can use it
      // They will start trial through the onboarding dialog in dashboard
      // No need to create checkout - trial will be created without payment method
      if (planId && interval) {
        console.log("[OTP] Plan selected before signup, saving to sessionStorage for onboarding:", { planId, interval });
        const onboardingData = {
          step3: { planId, interval },
        };
        sessionStorage.setItem("onboarding-temp-data", JSON.stringify(onboardingData));
      }

      // Redirect to dashboard - onboarding dialog will handle plan selection and trial start
      router.push("/dashboard");
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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

      // Use different API route for Google OAuth login vs signup
      const apiEndpoint = isGoogleOAuth ? "/api/auth/resend-login-otp" : "/api/auth/send-otp";
      const response = await fetch(apiEndpoint, {
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

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2 w-full">
            <span className="text-sm font-medium text-foreground">
              Verification Code
            </span>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Code expires in: <span className="font-medium text-foreground">{timeRemaining > 0 ? formatTime(timeRemaining) : "0:00"}</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-medium">{email}</span>
          </p>
          {timeRemaining === 0 && (
            <p className="text-sm text-destructive font-medium mt-2">
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

      {/* Show "trust browser" checkbox only for Google OAuth login */}
      {isGoogleOAuth && (
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
      )}

      {/* Show loading indicator when verifying */}
      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Verifying...</span>
        </div>
      )}

      <div className="text-center flex items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">
          Didn't receive the code?
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || loading}
          className="text-sm text-foreground hover:underline disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {resending ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Resending...
            </>
          ) : (
            "Resend Code"
          )}
        </button>
      </div>

      {/* Show "Back to login" button only for Google OAuth login */}
      {isGoogleOAuth && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/auth/login")}
          disabled={loading || resending}
          className="w-full text-sm"
        >
          Back to login
        </Button>
      )}
    </div>
  );
}

