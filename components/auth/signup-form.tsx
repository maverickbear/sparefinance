"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, SignUpFormData } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Loader2, AlertCircle } from "lucide-react";

interface SignUpFormProps {
  planId?: string;
  interval?: "month" | "year";
}

export function SignUpForm({ planId, interval }: SignUpFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get planId from props or search params
  const finalPlanId = planId || searchParams.get("planId") || undefined;
  const finalInterval = interval || (searchParams.get("interval") as "month" | "year") || "month";

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
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

      // If planId is provided, process the plan selection
      if (finalPlanId) {
        try {
          if (finalPlanId === "free") {
            // Setup free plan directly
            const response = await fetch("/api/billing/setup-free", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            });

            const data = await response.json();

            if (response.ok && data.success) {
              // Redirect to dashboard for free plan
              router.push("/dashboard");
              return;
            } else {
              console.error("Failed to setup free plan:", data.error);
              setError(data.error || "Failed to setup free plan. Please try again.");
              return;
            }
          } else {
            // Create checkout session for paid plans
            const response = await fetch("/api/stripe/checkout", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ planId: finalPlanId, interval: finalInterval }),
            });

            const data = await response.json();

            if (data.url) {
              // Redirect to Stripe Checkout
              window.location.href = data.url;
              return;
            } else {
              console.error("Failed to create checkout session:", data.error);
              setError("Failed to create checkout session. Please try again.");
              return;
            }
          }
        } catch (error) {
          console.error("Error processing plan:", error);
          setError("An error occurred while processing your plan. Please try again.");
          return;
        }
      }

      // No planId provided, redirect to plan selection page
      // Supabase session is automatically managed
      router.push("/select-plan");
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
              type="password"
              {...form.register("password")}
              disabled={loading}
              className="pl-10 h-11"
            />
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

