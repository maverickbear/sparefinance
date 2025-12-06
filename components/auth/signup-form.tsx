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
import { Turnstile, TurnstileRef } from "./turnstile";
import { isCaptchaError } from "@/lib/utils/auth-errors";

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileRef>(null);
  const [isDevelopment, setIsDevelopment] = useState(false);

  // Detect development environment on client side only (avoid hydration mismatch)
  useEffect(() => {
    const isLocalhost = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    setIsDevelopment(isLocalhost);
  }, []);

  // Get Turnstile site key from environment
  // Use Cloudflare test keys in development (localhost) to avoid domain validation issues
  // Test key "1x00000000000000000000AA" always passes verification
  const turnstileSiteKey = isDevelopment
    ? "1x00000000000000000000AA" // Cloudflare test key that always passes
    : (process.env.NEXT_PUBLIC_TURNSTILE_SITE || "");

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

      // Validate CAPTCHA token if Turnstile is enabled (only in production)
      // In development, CAPTCHA is optional
      if (!isDevelopment && turnstileSiteKey && !captchaToken) {
        setError("Please complete the CAPTCHA verification");
        // Reset CAPTCHA
        if (captchaRef.current) {
          captchaRef.current.reset();
        }
        setLoading(false);
        return;
      }

      // Call signup API route with CAPTCHA token
      // In development, don't send captchaToken to avoid Supabase verification errors
      const requestBody: any = { ...data };
      if (!isDevelopment && captchaToken) {
        requestBody.captchaToken = captchaToken;
      }
      
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
        
        // Reset CAPTCHA on any error (especially if it's a CAPTCHA error)
        if (isCaptchaError(errorMessage) || captchaRef.current) {
          if (captchaRef.current) {
            captchaRef.current.reset();
          }
          setCaptchaToken(null);
        }
        setLoading(false);
        return;
      }

      if (result.error) {
        const errorMessage = result.error;
        setError(errorMessage);
        
        // Reset CAPTCHA on error (especially if it's a CAPTCHA error)
        if (isCaptchaError(errorMessage) || captchaRef.current) {
          if (captchaRef.current) {
            captchaRef.current.reset();
          }
          setCaptchaToken(null);
        }
        setLoading(false);
        return;
      }

      if (!result.user) {
        setError("Failed to sign up");
        // Reset CAPTCHA on error
        if (captchaRef.current) {
          captchaRef.current.reset();
        }
        setCaptchaToken(null);
        return;
      }

      // Reset CAPTCHA after successful submission
      if (captchaRef.current) {
        captchaRef.current.reset();
      }
      setCaptchaToken(null);

      // After signup, redirect to OTP verification page
      // The user needs to verify their email before proceeding
      // Checkout linking and plan selection are handled after OTP verification
      router.push(`/auth/verify-otp?email=${encodeURIComponent(data.email)}${finalPlanId ? `&planId=${finalPlanId}&interval=${finalInterval}` : ""}${fromCheckout ? "&from_checkout=true" : ""}`);
    } catch (error) {
      console.error("Error during signup:", error);
      setError("An unexpected error occurred");
      // Reset CAPTCHA on error
      if (captchaRef.current) {
        captchaRef.current.reset();
      }
      setCaptchaToken(null);
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
              size="small"
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
              size="small"
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
              size="small"
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
          {form.formState.errors.password && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {/* CAPTCHA Component */}
        {turnstileSiteKey && (
          <div className="flex justify-center">
            <Turnstile
              ref={captchaRef}
              sitekey={turnstileSiteKey}
              onSuccess={(token) => {
                setCaptchaToken(token);
              }}
              onError={() => {
                setCaptchaToken(null);
                setError("CAPTCHA verification failed. Please try again.");
              }}
              onExpire={() => {
                setCaptchaToken(null);
                setError("CAPTCHA verification expired. Please complete it again.");
              }}
              theme="auto" // or "light" or "dark"
            />
          </div>
        )}

        <Button 
          type="submit" 
          size="small"
          className="w-full text-base font-medium" 
          disabled={loading || (!isDevelopment && !!turnstileSiteKey && !captchaToken)}
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

