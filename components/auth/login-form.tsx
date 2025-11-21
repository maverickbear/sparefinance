"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, SignInFormData } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { GoogleSignInButton } from "./google-signin-button";
import { VerifyLoginOtpForm } from "./verify-login-otp-form";

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
      // Optimized: Stripe API call is now opt-in (includeStripe=true) for faster loading
      fetch("/api/billing/subscription", { cache: "no-store" }).then(async (r) => {
        if (!r.ok) return null;
        const subData = await r.json();
        if (!subData) return null;
        
        // Store basic billing data without limits (limits loaded on-demand)
        const billingData = {
          subscription: subData.subscription,
          plan: subData.plan,
          limits: subData.limits,
          transactionLimit: null, // Loaded on-demand when Billing tab is opened
          accountLimit: null, // Loaded on-demand when Billing tab is opened
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

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation_token");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [invitationInfo, setInvitationInfo] = useState<{ email: string; ownerName: string } | null>(null);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState<string>("");

  // Check for OAuth errors in URL params
  useEffect(() => {
    const oauthError = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    
    if (oauthError === "oauth_cancelled") {
      setError("Sign in with Google was cancelled. Please try again.");
    } else if (oauthError === "oauth_error") {
      setError(errorDescription || "An error occurred during sign in with Google. Please try again.");
    } else if (oauthError === "pending_invitation") {
      setError(errorDescription || "This email has a pending household invitation. Please accept the invitation from your email or use the invitation link to create your account.");
    } else if (oauthError === "exchange_failed" || oauthError === "no_code" || oauthError === "unexpected_error") {
      setError("Failed to complete sign in. Please try again.");
    }
    
    // Clean up URL params after showing error
    if (oauthError) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      newUrl.searchParams.delete("error_description");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [searchParams]);

  // Load invitation info if token is present
  useEffect(() => {
    if (invitationToken) {
      fetch(`/api/members/invite/validate?token=${encodeURIComponent(invitationToken)}`)
        .then(res => res.json())
        .then(data => {
          if (data.invitation && data.owner) {
            setInvitationInfo({
              email: data.invitation.email,
              ownerName: data.owner.name || data.owner.email,
            });
          }
        })
        .catch(err => {
          console.error("Error loading invitation info:", err);
        });
    }
  }, [invitationToken]);

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: SignInFormData) {
    try {
      setLoading(true);
      setError(null);

      // Send OTP for login (this validates credentials first)
      const response = await fetch("/api/auth/send-login-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to send verification code");
        setLoading(false);
        return;
      }

      // OTP sent successfully - show OTP form
      setLoginEmail(data.email);
      setShowOtpForm(true);
      setLoading(false);
    } catch (error) {
      console.error("Error sending login OTP:", error);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  // Show OTP form if OTP was sent
  if (showOtpForm) {
    return (
      <div className="space-y-6">
        <VerifyLoginOtpForm 
          email={loginEmail}
          invitationToken={invitationToken}
          onBack={() => {
            setShowOtpForm(false);
            setLoginEmail("");
            setError(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {invitationInfo && (
        <div className="rounded-[12px] bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>{invitationInfo.ownerName}</strong> invited you to join their household. 
            Sign in to accept the invitation.
          </p>
        </div>
      )}
      
      <GoogleSignInButton variant="signin" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or
          </span>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <div className="rounded-[12px] bg-destructive/10 border border-destructive/20 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              placeholder="you@example.com"
              disabled={loading}
              className="pl-10 h-11"
              required
            />
          </div>
          {form.formState.errors.email && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-sm text-primary hover:underline font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              {...form.register("password")}
              disabled={loading}
              className="pl-10 pr-10 h-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <Button 
          type="submit" 
          className="w-full h-11 text-base font-medium" 
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link 
          href="/auth/signup" 
          className="text-primary hover:underline font-medium transition-colors"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

// Export LoginForm with Suspense wrapper for useSearchParams
export function LoginForm() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="space-y-5">
          <div className="h-10 bg-muted animate-pulse rounded-[12px]" />
          <div className="h-10 bg-muted animate-pulse rounded-[12px]" />
          <div className="h-10 bg-muted animate-pulse rounded-[12px]" />
        </div>
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  );
}

