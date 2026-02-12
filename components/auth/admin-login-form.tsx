"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const adminLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (searchParams.get("registered") === "1") setRegistered(true);
  }, [searchParams]);

  const form = useForm<AdminLoginFormData>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: AdminLoginFormData) {
    try {
      setLoading(true);
      setError(null);

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      });

      if (authError) {
        const msg = authError.message?.toLowerCase() || "";
        if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
          setError("Invalid email or password");
        } else {
          setError(authError.message || "Sign in failed");
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Sign in failed");
        setLoading(false);
        return;
      }

      // Sync session so server sees the cookie
      await fetch("/api/auth/sync-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      // Redirect to admin; (dashboard) layout will redirect to /admin/login if not super_admin
      router.push("/admin");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {registered && (
        <Alert className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Account created. Sign in below.</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <label htmlFor="admin-email" className="text-sm font-medium">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="admin-email"
            type="email"
            className="pl-9"
            placeholder="you@example.com"
            autoComplete="email"
            {...form.register("email")}
          />
        </div>
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="admin-password" className="text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            className="pl-9 pr-9"
            placeholder="Your password"
            autoComplete="current-password"
            {...form.register("password")}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
