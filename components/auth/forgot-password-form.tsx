"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, ForgotPasswordFormData } from "@/src/domain/auth/auth.validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordFormData) {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to send reset email");
        setLoading(false);
        return;
      }

      // Always show success message (to prevent email enumeration)
      setSuccess(true);
      setLoading(false);
    } catch (error) {
      console.error("Error requesting password reset:", error);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-[12px] bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              If an account exists with this email, you will receive a password reset link shortly.
            </p>
            <p className="text-sm text-green-700 dark:text-green-300 mt-2">
              Please check your inbox and follow the instructions to reset your password.
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/auth/login"
            className="text-sm text-primary hover:underline font-medium transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
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

        <Button 
          type="submit" 
          className="w-full h-11 text-base font-medium" 
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Reset Link"
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

