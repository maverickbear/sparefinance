"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, SignUpFormData } from "@/src/domain/auth/auth.validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GoogleSignInButton } from "./google-signin-button";
import { TurnstileWidget, TurnstileWidgetRef } from "@/src/presentation/components/common/turnstile-widget";

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

interface SignUpFormProps {
  planId?: string;
  interval?: "month" | "year";
}

export function SignUpForm({ planId, interval }: SignUpFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;


  // Get planId from props or search params
  const finalPlanId = planId || searchParams.get("planId") || undefined;
  const finalInterval = interval || (searchParams.get("interval") as "month" | "year") || "month";
  const fromCheckout = searchParams.get("from_checkout") === "true";
  const prefillEmail = searchParams.get("email") || undefined;

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: prefillEmail || "",
      password: "",
      name: "",
    },
  });

  async function onSubmit(data: SignUpFormData) {
    try {
      setLoading(true);
      setError(null);

      // Check if Turnstile token is required and available
      if (turnstileSiteKey && !turnstileToken) {
        setError("Please complete the security verification");
        setLoading(false);
        return;
      }

      // Call signup API route
      const requestBody: any = { 
        ...data,
        turnstileToken: turnstileToken || undefined,
      };
      
      const response = await fetch("/api/v2/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        const errorMessage = result.error || "Failed to sign up";
        setError(errorMessage);
        // Reset Turnstile widget on error
        if (turnstileRef.current) {
          turnstileRef.current.reset();
          setTurnstileToken(null);
        }
        setLoading(false);
        return;
      }

      if (result.error) {
        const errorMessage = result.error;
        setError(errorMessage);
        // Reset Turnstile widget on error
        if (turnstileRef.current) {
          turnstileRef.current.reset();
          setTurnstileToken(null);
        }
        setLoading(false);
        return;
      }

      // If email confirmation is required, user profile will be created after confirmation
      // This is a valid success case - proceed to OTP verification
      if (result.requiresEmailConfirmation) {
        // After signup, redirect to OTP verification page
        // The user needs to verify their email before proceeding
        // Checkout linking and plan selection are handled after OTP verification
        router.push(`/auth/verify-otp?email=${encodeURIComponent(data.email)}${finalPlanId ? `&planId=${finalPlanId}&interval=${finalInterval}` : ""}${fromCheckout ? "&from_checkout=true" : ""}`);
        return;
      }

      // If no user and no email confirmation flag, this is an error
      if (!result.user) {
        setError("Failed to sign up");
        // Reset Turnstile widget on error
        if (turnstileRef.current) {
          turnstileRef.current.reset();
          setTurnstileToken(null);
        }
        setLoading(false);
        return;
      }

      // After signup, redirect to OTP verification page
      // The user needs to verify their email before proceeding
      // Checkout linking and plan selection are handled after OTP verification
      router.push(`/auth/verify-otp?email=${encodeURIComponent(data.email)}${finalPlanId ? `&planId=${finalPlanId}&interval=${finalInterval}` : ""}${fromCheckout ? "&from_checkout=true" : ""}`);
    } catch (error) {
      console.error("Error during signup:", error);
      setError("An unexpected error occurred");
      // Reset Turnstile widget on error
      if (turnstileRef.current) {
        turnstileRef.current.reset();
        setTurnstileToken(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <GoogleSignInButton variant="signup" />

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
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              {...form.register("name")}
              placeholder="John Doe"
              disabled={loading}
              size="medium"
              className="pl-10"
              required
            />
          </div>
          {form.formState.errors.name && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

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
              size="medium"
              className="pl-10"
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
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              {...form.register("password")}
              disabled={loading}
              size="medium"
              className="pl-10 pr-10"
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
          <div className="text-xs text-muted-foreground space-y-1 pt-1">
            <p className="font-medium">Password requirements:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>At least 12 characters</li>
              <li>One uppercase letter</li>
              <li>One lowercase letter</li>
              <li>One number</li>
              <li>One special character</li>
            </ul>
          </div>
          {form.formState.errors.password && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {turnstileSiteKey && (
          <div className="py-2">
            <TurnstileWidget
              ref={turnstileRef}
              siteKey={turnstileSiteKey}
              onTokenChange={(token) => setTurnstileToken(token)}
              theme="auto"
              size="normal"
            />
          </div>
        )}

        <Button 
          type="submit" 
          size="medium"
          className="w-full text-base font-medium" 
          disabled={loading || (!!turnstileSiteKey && !turnstileToken)}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing up...
            </>
          ) : (
            "Sign Up"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link 
          href="/auth/login" 
          className="text-foreground hover:underline font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

