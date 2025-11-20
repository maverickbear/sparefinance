"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Loader2, Lock, Mail, User, AlertCircle, Wallet, TrendingUp, Shield, Zap, Eye, EyeOff } from "lucide-react";

const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface InvitationData {
  invitation: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  owner: {
    name: string;
    email: string;
  } | null;
  hasAccount?: boolean; // Indicates if email already has an account
}

function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"validating" | "password" | "login-required" | "processing" | "success" | "error">("validating");
  const [message, setMessage] = useState<string>("");
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invitation token not provided");
      return;
    }

    validateInvitation();
  }, [token]);

  async function validateInvitation() {
    if (!token) return;

    try {
      const res = await fetch(`/api/members/invite/validate?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (res.ok) {
        setInvitationData(data);
        // If email already has an account, redirect to login
        if (data.hasAccount) {
          setStatus("login-required");
          setMessage("You already have an account. Please sign in to accept the invitation.");
          // Redirect to login with token in query params
          setTimeout(() => {
            router.push(`/auth/login?invitation_token=${encodeURIComponent(token || "")}`);
          }, 3000);
        } else {
          setStatus("password");
          setMessage("");
        }
      } else {
        setStatus("error");
        setMessage(data.error || "Invalid or expired invitation token");
      }
    } catch (error) {
      console.error("Error validating invitation:", error);
      setStatus("error");
      setMessage("Error validating invitation. Please try again.");
    }
  }

  async function onSubmit(data: PasswordFormData) {
    if (!token) return;

    try {
      setStatus("processing");
      setError(null);

      const res = await fetch("/api/members/invite/accept-with-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });

      const result = await res.json();

      if (res.ok) {
        // Check if OTP verification is required
        if (result.requiresOtpVerification) {
          // Redirect to OTP verification page with invitation context
          router.push(`/auth/verify-otp?email=${encodeURIComponent(result.email)}&invitationId=${encodeURIComponent(result.invitationId)}&userId=${encodeURIComponent(result.userId)}&from_invitation=true`);
          return;
        }

        setStatus("success");
        setMessage("Invitation accepted successfully! You are now part of the family.");
        
        // If we have a session, redirect to dashboard
        // Cookies are already set by the server
        if (result.session) {
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
        } else {
          // No session, redirect to login
          setTimeout(() => {
            router.push("/auth/login");
          }, 2000);
        }
      } else {
        setStatus("password");
        setError(result.error || "Error accepting invitation");
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setStatus("password");
      setError("Error processing invitation. Please try again.");
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-[12px]">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold">Spare Finance</h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-md">
              Manage your personal finances intelligently and make more informed decisions about your money.
            </p>
          </div>

          <div className="space-y-6 pt-8">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-[12px] shrink-0">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Track Your Finances</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor income, expenses, and investments in one place.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-[12px] shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Data</h3>
                <p className="text-sm text-muted-foreground">
                  Your financial information protected with cutting-edge encryption.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-[12px] shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Smart Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Automatic insights about your financial habits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile header */}
          <div className="lg:hidden text-center space-y-2">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-[12px]">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Spare Finance</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Accept your invitation and create your account
            </p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block space-y-2">
            <h2 className="text-3xl font-bold">
              {status === "validating" && "Validating invitation..."}
              {status === "password" && "Create password"}
              {status === "login-required" && "Account already exists"}
              {status === "processing" && "Processing..."}
              {status === "success" && "Invitation accepted!"}
              {status === "error" && "Error accepting invitation"}
            </h2>
            <p className="text-muted-foreground">
              {status === "validating" && "Please wait while we validate your invitation..."}
              {status === "password" && invitationData && (
                <>You were invited by <strong>{invitationData.owner?.name || invitationData.owner?.email}</strong>. Create a password to access your account.</>
              )}
              {status === "login-required" && message}
              {status === "processing" && "Creating your account..."}
              {status === "success" && message}
              {status === "error" && message}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Loading/Status Indicators */}
            {(status === "validating" || status === "processing") && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {status === "validating" && "Please wait while we validate your invitation..."}
                  {status === "processing" && "Creating your account..."}
                </p>
              </div>
            )}

            {/* Login Required State */}
            {status === "login-required" && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                  <AlertCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">{message}</p>
                  <p className="text-sm text-muted-foreground">
                    Redirecting to login page...
                  </p>
                </div>
                <Button 
                  onClick={() => router.push(`/auth/login?invitation_token=${encodeURIComponent(token || "")}`)} 
                  className="w-full"
                >
                  Go to Login
                </Button>
              </div>
            )}

            {/* Success State */}
            {status === "success" && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">{message}</p>
                  <p className="text-sm text-muted-foreground">
                    You will be redirected in a moment...
                  </p>
                </div>
                <Button onClick={() => window.location.href = "/"} className="w-full">
                  Go to Dashboard
                </Button>
              </div>
            )}

            {/* Error State */}
            {status === "error" && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    {message.includes("Token") || message.includes("token")
                      ? "The invitation link may be expired or invalid."
                      : message}
                  </p>
                </div>
              </div>
            )}

            {/* Password Form */}
            {status === "password" && invitationData && (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={invitationData.invitation.email}
                      disabled
                      className="pl-10 h-11 bg-muted"
                    />
                  </div>
                </div>

                {invitationData.invitation.name && (
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium text-foreground">
                      Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        value={invitationData.invitation.name}
                        disabled
                        className="pl-10 h-11 bg-muted"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-[12px] bg-destructive/10 border border-destructive/20 p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-destructive">{error}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      {...form.register("password")}
                      disabled={(status as string) === "processing"}
                      className="pl-10 pr-10 h-11"
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

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      {...form.register("confirmPassword")}
                      disabled={(status as string) === "processing"}
                      className="pl-10 pr-10 h-11"
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
                  className="w-full h-11 text-base font-medium" 
                  disabled={(status as string) === "processing"}
                >
                  {(status as string) === "processing" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Accept invitation and create account"
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-[12px]" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded-[12px]" />
          </div>
        </div>
        <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
          <div className="w-full max-w-md space-y-4">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted animate-pulse rounded-[12px]" />
              <div className="h-4 w-64 bg-muted animate-pulse rounded-[12px]" />
            </div>
            <div className="space-y-4">
              <div className="h-10 bg-muted animate-pulse rounded-[12px]" />
              <div className="h-10 bg-muted animate-pulse rounded-[12px]" />
              <div className="h-10 bg-muted animate-pulse rounded-[12px]" />
            </div>
          </div>
        </div>
      </div>
    }>
      <AcceptInvitationForm />
    </Suspense>
  );
}
