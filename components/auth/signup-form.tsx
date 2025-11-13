"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, SignUpFormData } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

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
      // Optimized: Skip Stripe API call and limits check during signup for faster loading
      fetch("/api/billing/subscription?skipStripe=true", { cache: "no-store" }).then(async (r) => {
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

      const { signUpClient } = await import("@/lib/api/auth-client");
      const result = await signUpClient(data);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (!result.user) {
        setError("Failed to sign up");
        return;
      }

      // If user came from checkout, link their Stripe subscription
      if (fromCheckout && prefillEmail) {
        try {
          // Wait for session to be fully established
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Link subscription by email
          const linkResponse = await fetch("/api/stripe/link-subscription", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: prefillEmail }),
          });

          if (linkResponse.ok) {
            const linkData = await linkResponse.json();
            if (linkData.success) {
              console.log("[SIGNUP] Subscription linked successfully");
              // Preload user and plan data before redirecting
              await preloadUserData();
              // Redirect to dashboard
              router.push("/dashboard");
              return;
            }
          }
          // If linking fails, continue with normal flow
          console.log("[SIGNUP] Could not link subscription, continuing with normal flow");
        } catch (error) {
          console.error("[SIGNUP] Error linking subscription:", error);
          // Continue with normal flow
        }
      }

      // If planId is provided, redirect to Stripe Checkout
      // Wait a bit to ensure session is established
      if (finalPlanId) {
        try {
          // Wait for session to be fully established
          // Retry up to 3 times with increasing delays
          let retries = 3;
          let delay = 500;
          let lastError: string | null = null;
          
          while (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Create Stripe Checkout session and redirect to Stripe
            const response = await fetch("/api/stripe/checkout", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ 
                planId: finalPlanId,
                interval: finalInterval,
                returnUrl: "/subscription/success"
              }),
            });

            const data = await response.json();

            if (response.ok && data.url) {
              // Redirect to Stripe Checkout
              window.location.href = data.url;
              return;
            } else {
              lastError = data.error || "Failed to create checkout session";
              console.error(`Failed to create checkout (${4 - retries}/3):`, lastError);
              
              // If unauthorized, session might not be ready yet
              if (response.status === 401 && retries > 1) {
                retries--;
                delay *= 2; // Exponential backoff
                continue;
              }
              
              // For other errors or last retry, show error
              setError(lastError || "Failed to start checkout. Please try again.");
              return;
            }
          }
          
          // If we exhausted retries, show last error
          setError(lastError || "Failed to start checkout. Please try again.");
          return;
        } catch (error) {
          console.error("Error processing plan:", error);
          setError("An error occurred while processing your plan. Please try again.");
          return;
        }
      }

      // No planId provided, redirect to dashboard
      // Preload user and plan data while showing loading
      // This ensures data is ready when user navigates
      await preloadUserData();
      
      // Supabase session is automatically managed
      router.push("/dashboard");
    } catch (error) {
      console.error("Error during signup:", error);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
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
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Name (optional)
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              {...form.register("name")}
              placeholder="John Doe"
              disabled={loading}
              className="pl-10 h-11"
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
              Signing up...
            </>
          ) : (
            "Sign Up"
          )}
        </Button>
      </form>

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

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link 
          href="/auth/login" 
          className="text-primary hover:underline font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

