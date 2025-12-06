"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, ResetPasswordFormData } from "@/src/domain/auth/auth.validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function ResetPasswordFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Check if we have a valid token from Supabase
  useEffect(() => {
    // Supabase includes the token in the URL hash (#access_token=...&type=recovery)
    // The Supabase client automatically processes the hash on page load
    // We need to wait for it to process and check if we have a valid session
    const processToken = async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        
        // Check if we have hash params (Supabase sends token in hash)
        const hash = window.location.hash;
        if (hash && (hash.includes("type=recovery") || hash.includes("access_token"))) {
          // Supabase SSR client processes the hash automatically
          // Wait a bit for it to process (may take a moment)
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (session && !error) {
              setIsValidToken(true);
              // Clear the hash from URL for cleaner UX
              window.history.replaceState(null, "", window.location.pathname);
              return;
            }
            
            attempts++;
          }
          
          // If we still don't have a session after max attempts, token might be invalid
          setIsValidToken(false);
          return;
        }
        
        // Check if we already have a valid session (user might have refreshed)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.user) {
          setIsValidToken(true);
          return;
        }
        
        // No hash and no session - invalid token
        setIsValidToken(false);
      } catch (error) {
        console.error("Error processing token:", error);
        setIsValidToken(false);
      }
    };

    processToken();
  }, []);

  async function onSubmit(data: ResetPasswordFormData) {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/v2/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setError(result.error || "Failed to reset password");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    } catch (error) {
      console.error("Error resetting password:", error);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  if (isValidToken === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid or expired reset link</AlertTitle>
          <AlertDescription>
              This password reset link is invalid or has expired. Please request a new one.
          </AlertDescription>
        </Alert>

        <div className="text-center space-y-2">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-foreground hover:underline font-medium transition-colors block"
          >
            Request new reset link
          </Link>
          <Link
            href="/auth/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors block"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Password reset successfully!</AlertTitle>
          <AlertDescription>Redirecting to login...</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              {...form.register("password")}
              placeholder="Enter your new password"
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

        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              {...form.register("confirmPassword")}
              placeholder="Confirm your new password"
              disabled={loading}
              size="small"
              className="pl-10 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {form.formState.errors.confirmPassword && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {form.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button 
          type="submit" 
          size="small"
          className="w-full text-base font-medium" 
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset Password"
          )}
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/auth/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}

// Export ResetPasswordForm with Suspense wrapper for useSearchParams
export function ResetPasswordForm() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <ResetPasswordFormContent />
    </Suspense>
  );
}

