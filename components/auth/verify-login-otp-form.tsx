"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

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

      // Verify OTP with Supabase using email type (for numeric OTP)
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });

      if (verifyError) {
        setError(verifyError.message || "Invalid verification code. Please try again.");
        // Clear OTP on error
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      if (!data.user) {
        setError("Verification failed. Please try again.");
        return;
      }

      // Check if email is confirmed
      if (!data.user.email_confirmed_at) {
        setError("Email verification failed. Please try again.");
        return;
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

      // Preload user and plan data while showing loading
      await preloadUserData();

      // Always redirect to dashboard after login
      router.push("/dashboard");
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

