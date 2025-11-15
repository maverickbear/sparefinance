"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, Lock, Eye, EyeOff, AlertCircle, Wallet, TrendingUp, Shield, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, SignUpFormData } from "@/lib/validations/auth";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [sessionData, setSessionData] = useState<{ email: string | null; customerId: string | null } | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<"active" | "trialing" | "cancelled" | "past_due" | null>(null);
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
  });

  useEffect(() => {
    checkAuthAndSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAuthAndSync() {
    try {
      // First, check if user is authenticated
      const authResponse = await fetch("/api/stripe/customer");
      const isAuth = authResponse.ok;
      setIsAuthenticated(isAuth);

      if (isAuth) {
        // User is authenticated, sync subscription
        await syncSubscription();
      } else {
        // User is not authenticated - get session data for account creation
        const sessionId = searchParams.get("session_id");
        if (sessionId) {
          try {
            const sessionResponse = await fetch(`/api/stripe/session?session_id=${sessionId}`);
            if (sessionResponse.ok) {
              const data = await sessionResponse.json();
              setSessionData({
                email: data.customerEmail,
                customerId: data.customerId,
              });
              form.setValue("email", data.customerEmail || "");
              form.setValue("name", data.customerName || "");
            }
          } catch (error) {
            console.error("[SUCCESS] Error fetching session data:", error);
          }
        }
        setLoading(false);
      }
    } catch (error) {
      console.error("[SUCCESS] Error checking auth:", error);
      setLoading(false);
    }
  }


  async function syncSubscription() {
    try {
      setSyncing(true);
      console.log("[SUCCESS] Syncing subscription from Stripe...");
      
      const response = await fetch("/api/stripe/sync-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("[SUCCESS] Subscription synced successfully:", data.subscription);
        
        // Invalidate client-side cache to force fresh data fetch
        try {
          const { invalidateClientSubscriptionCache } = await import("@/contexts/subscription-context");
          invalidateClientSubscriptionCache();
          console.log("[SUCCESS] Client cache invalidated");
        } catch (error) {
          console.error("[SUCCESS] Error invalidating cache:", error);
        }
      } else {
        console.error("[SUCCESS] Failed to sync subscription:", data.error);
        // Don't fail the page, just log the error
      }

      // Fetch subscription status to determine copy
      try {
        const { getUserClient } = await import("@/lib/api/user-client");
        const userData = await getUserClient();
        if (userData.subscription) {
          setSubscriptionStatus(userData.subscription.status);
          setTrialEndDate(userData.subscription.trialEndDate || null);
        }
      } catch (error) {
        console.error("[SUCCESS] Error fetching subscription status:", error);
      }
    } catch (error) {
      console.error("[SUCCESS] Error syncing subscription:", error);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }

  async function onCreateAccount(data: SignUpFormData) {
    try {
      setCreatingAccount(true);
      setError(null);

      if (!sessionData?.customerId) {
        setError("Customer ID not found. Please try again.");
        return;
      }

      const response = await fetch("/api/stripe/create-account-and-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
          customerId: sessionData.customerId,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Account created and subscription linked
        // Wait a moment for session to be established, then refresh to ensure all data is loaded
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Use window.location to force a full page reload and establish session
        window.location.href = "/dashboard";
      } else {
        setError(result.error || "Failed to create account. Please try again.");
      }
    } catch (error) {
      console.error("[SUCCESS] Error creating account:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setCreatingAccount(false);
    }
  }

  const handleGoToDashboard = async () => {
    // Invalidate client-side cache before navigating
    try {
      const { invalidateClientSubscriptionCache } = await import("@/contexts/subscription-context");
      invalidateClientSubscriptionCache();
      console.log("[SUCCESS] Cache invalidated before navigating to dashboard");
    } catch (error) {
      console.error("[SUCCESS] Error invalidating cache:", error);
    }
    
    // Force a full page reload to ensure cache is cleared and subscription is re-checked
    // This ensures the layout will fetch fresh subscription data
    window.location.href = "/dashboard";
  };

  const handleGoToBilling = () => {
    router.push("/settings?tab=billing");
  };

  if (loading || syncing) {
    return (
      <div className="min-h-screen grid lg:grid-cols-2 bg-background">
        <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-[12px]" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded-[12px]" />
          </div>
        </div>
        <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
          <div className="w-full max-w-md space-y-4">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Confirming your subscription...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User is not authenticated - show account creation form
  if (isAuthenticated === false && sessionData) {
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

        {/* Right side - Account Creation Form */}
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
                Create your account to access your trial
              </p>
            </div>

            <Card className="border-0">
              <CardHeader className="text-center p-0 pb-8 border-0">
                <div className="flex justify-center mb-4">
                  <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
                    <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <CardTitle className="text-3xl mb-2">Trial Started Successfully!</CardTitle>
                <CardDescription className="text-lg">
                  Create your account to access your trial
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <div className="rounded-[12px] bg-destructive/10 border border-destructive/20 p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-destructive">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={form.handleSubmit(onCreateAccount)} className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="name" className="text-sm font-medium text-foreground">
                      Name
                    </label>
                    <Input
                      id="name"
                      type="text"
                      {...form.register("name")}
                      placeholder="John Doe"
                      disabled={true}
                      className="h-11 bg-muted"
                    />
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
                      <Input
                        id="email"
                        type="email"
                        {...form.register("email")}
                        placeholder="you@example.com"
                        disabled={true}
                        className="h-11 bg-muted"
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
                        disabled={creatingAccount}
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
                    disabled={creatingAccount}
                  >
                    {creatingAccount ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account & Access Trial"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated, show success message
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

      {/* Right side - Success Message */}
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
          </div>

          <Card className="border-0">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
                  <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-3xl mb-2">
                {subscriptionStatus === "trialing" ? "Trial Started Successfully!" : "Subscription Successful!"}
              </CardTitle>
              <CardDescription className="text-lg">
                {subscriptionStatus === "trialing" 
                  ? "Your 30-day trial has started. Start exploring all premium features!"
                  : "Thank you for subscribing. Your account has been upgraded."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm">What&apos;s next?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {subscriptionStatus === "trialing" ? (
                    <>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span>Your 30-day trial is active and you have access to all premium features</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span>No credit card required during trial period</span>
                      </li>
                      {trialEndDate && (
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          <span>
                            Your trial ends on {new Date(trialEndDate).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span>You can add a payment method anytime from your billing settings</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span>Your subscription is now active and you have access to all premium features</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span>You can manage your subscription anytime from your billing settings</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span>A confirmation email has been sent to your email address</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleGoToDashboard}
                  className="flex-1 w-full"
                  size="large"
                >
                  Go to Dashboard
                </Button>
                <Button
                  onClick={handleGoToBilling}
                  variant="outline"
                  className="flex-1 w-full"
                  size="large"
                >
                  View Billing
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                If you have any questions, please contact our support team.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Wrapper component that provides Suspense boundary for useSearchParams
export default function SuccessPage() {
  return (
    <Suspense fallback={(
      <div className="min-h-screen grid lg:grid-cols-2 bg-background">
        <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-[12px]" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded-[12px]" />
          </div>
        </div>
        <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
          <div className="w-full max-w-md space-y-4">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    )}>
      <SuccessContent />
    </Suspense>
  );
}

