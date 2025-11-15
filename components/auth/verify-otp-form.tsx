"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Get email from props or search params
  const email = propEmail || searchParams.get("email") || "";
  const planId = searchParams.get("planId") || undefined;
  const interval = (searchParams.get("interval") as "month" | "year") || undefined;
  const fromCheckout = searchParams.get("from_checkout") === "true";

  // Note: Supabase automatically sends OTP when email confirmation is enabled
  // So we don't need to send it automatically on mount
  // Users can use the "Resend Code" button if they didn't receive it

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

      // Verify OTP with Supabase
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "signup",
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

      // Update user_metadata in Supabase Auth with name from User table
      // This ensures Display name appears correctly in Supabase Auth dashboard
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
        // Don't fail verification if metadata update fails
      }

      // Success! Handle post-verification flow
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

      // If planId is provided, redirect to Stripe Checkout
      if (planId) {
        try {
          // Wait for session to be fully established
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Create Stripe Checkout session and redirect to Stripe
          const response = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              planId,
              interval: interval || "month",
              returnUrl: "/subscription/success"
            }),
          });

          const checkoutData = await response.json();

          if (response.ok && checkoutData.url) {
            // Redirect to Stripe Checkout
            window.location.href = checkoutData.url;
            return;
          }
        } catch (error) {
          console.error("[OTP] Error creating checkout:", error);
        }
      }

      // Default: redirect to dashboard
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

      // Use API route to send OTP (more reliable)
      const response = await fetch("/api/auth/send-otp", {
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
        // If API route fails, show error (don't use fallback to avoid duplicate emails)
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
              ref={(el) => (inputRefs.current[index] = el)}
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
          "Verify Email"
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
    </div>
  );
}

