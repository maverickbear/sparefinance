"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { passwordValidation } from "@/src/domain/auth/auth.validations";
import { supabase } from "@/lib/supabase";

const adminRegisterSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: passwordValidation,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type AdminRegisterFormData = z.infer<typeof adminRegisterSchema>;

export function AdminRegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AdminRegisterFormData>({
    resolver: zodResolver(adminRegisterSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: AdminRegisterFormData) {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v2/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message || body.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Sign in with the same credentials so the user is logged in and goes straight to the portal
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      });

      if (signInError) {
        setError("Account created but sign-in failed. Please sign in on the login page.");
        setLoading(false);
        return;
      }

      await fetch("/api/auth/sync-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      router.push("/admin");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Your name"
          autoComplete="name"
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          {...form.register("email")}
          placeholder="you@example.com"
          autoComplete="email"
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          {...form.register("password")}
          placeholder="Create a password (12+ chars, upper, lower, number, special)"
          autoComplete="new-password"
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm password
        </label>
        <Input
          id="confirmPassword"
          type="password"
          {...form.register("confirmPassword")}
          placeholder="Confirm password"
          autoComplete="new-password"
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account…
          </>
        ) : (
          "Create admin account"
        )}
      </Button>
    </form>
  );
}
