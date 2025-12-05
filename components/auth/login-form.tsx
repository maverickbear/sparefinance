"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, SignInFormData } from "@/src/domain/auth/auth.validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GoogleSignInButton } from "./google-signin-button";
import { VerifyLoginOtpForm } from "./verify-login-otp-form";
import { isTrustedBrowser } from "@/lib/utils/trusted-browser";
import { supabase } from "@/lib/supabase";

/**
 * Preloads user, profile, and billing data into global caches
 * This ensures data is ready immediately when user navigates after login/signup
 */
async function preloadUserData() {
  try {
    const preloadPromises = [
      // Preload user data and role for Nav using API routes
      Promise.all([
        fetch("/api/v2/user"),
        fetch("/api/v2/members"),
      ]).then(async ([userResponse, membersResponse]) => {
        if (!userResponse.ok || !membersResponse.ok) return null;
        const [userData, membersData] = await Promise.all([
          userResponse.json(),
          membersResponse.json(),
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
      }).catch(() => null),
      // Preload profile data using API route
      fetch("/api/v2/profile").then(async (r) => {
        if (!r.ok) return null;
        const profile = await r.json();
        if (typeof window !== 'undefined' && (window as any).profileDataCache) {
          (window as any).profileDataCache.data = profile;
          (window as any).profileDataCache.timestamp = Date.now();
        }
        return profile;
      }).catch(() => null),
      // Preload subscription/billing data (without limits - loaded later when needed)
      // Optimized: Stripe API call is now opt-in (includeStripe=true) for faster loading
      fetch("/api/v2/billing/subscription", { cache: "no-store" }).then(async (r) => {
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
    
    // If account is blocked, redirect to blocked page
    if (oauthError === "blocked") {
      router.push("/account-blocked");
      return;
    }
    
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
    if (oauthError && oauthError !== "blocked") {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      newUrl.searchParams.delete("error_description");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [searchParams, router]);

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

      // Check if browser is trusted
      const isTrusted = isTrustedBrowser(data.email);

      if (isTrusted) {
        // Browser is trusted - sign in directly without OTP
        console.log("[LOGIN] Trusted browser detected, signing in directly");
        
        const response = await fetch("/api/auth/login-trusted", {
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
          setError(result.error || "Failed to sign in");
          setLoading(false);
          return;
        }

        // Sign in successful - sync session and redirect
        try {
          // Sync session with server
          await fetch("/api/auth/sync-session", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          });

          // Preload user data
          await preloadUserData();

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
              router.push("/maintenance");
              return;
            }
          }

          // Handle invitation if present
          if (invitationToken) {
            try {
              const acceptResponse = await fetch("/api/v2/members/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: invitationToken }),
              });

              if (acceptResponse.ok) {
                console.log("Invitation accepted after login");
              }
            } catch (acceptError) {
              console.error("Error accepting invitation:", acceptError);
            }
          }

          // Store that password was the last used authentication method
          if (typeof window !== "undefined") {
            localStorage.setItem("lastAuthMethod", "password");
          }

          // Redirect to dashboard
          const timestamp = Date.now();
          window.location.replace(`/dashboard?_t=${timestamp}`);
        } catch (error) {
          console.error("Error after trusted login:", error);
          // Even if there's an error, try to redirect
          const timestamp = Date.now();
          window.location.replace(`/dashboard?_t=${timestamp}`);
        }
      } else {
        // Browser is not trusted - proceed with OTP flow
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
      }
    } catch (error) {
      console.error("Error during login:", error);
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
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>{invitationInfo.ownerName}</strong> invited you to join their household. 
            Sign in to accept the invitation.
          </AlertDescription>
        </Alert>
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
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
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
              className="text-sm text-foreground hover:underline font-medium transition-colors"
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
          className="text-foreground hover:underline font-medium transition-colors"
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
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  );
}

