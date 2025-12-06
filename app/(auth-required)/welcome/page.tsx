"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Zap, Crown, ArrowRight } from "lucide-react";

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "essential";
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [planName, setPlanName] = useState<string>("Essential");

  const syncSubscription = useCallback(async () => {
    try {
      setSyncing(true);
      console.log("[WELCOME] Syncing subscription from Stripe...");
      
      const response = await fetch("/api/stripe/sync-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("[WELCOME] Subscription synced successfully:", data.subscription);
        
      } else {
        console.error("[WELCOME] Failed to sync subscription:", data.error);
        // Don't fail the page, just log the error
      }
    } catch (error) {
      console.error("[WELCOME] Error syncing subscription:", error);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch plan name from database
    fetch("/api/billing/plans/public")
      .then(res => res.json())
      .then(data => {
        if (data.plans) {
          const currentPlan = data.plans.find((p: { id: string }) => p.id === plan);
          if (currentPlan) {
            setPlanName(currentPlan.name);
          }
        }
      })
      .catch(err => console.error("Error fetching plan name:", err));

    // If plan is "paid", try to sync subscription from Stripe
    if (plan === "paid") {
      syncSubscription();
    } else {
      setTimeout(() => setLoading(false), 100);
    }
  }, [plan, syncSubscription]);

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  if (loading || syncing) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">
            {syncing ? "Activating your subscription..." : "Loading..."}
          </div>
        </div>
      </div>
    );
  }

  if (plan === "essential") {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">Welcome! 🎉</h1>
            <p className="text-lg text-muted-foreground">
              You&apos;re all set with the {planName} plan
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                {planName} Plan Activated
              </CardTitle>
              <CardDescription>
                Start managing your finances with your plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">What&apos;s included:</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    Up to 50 transactions per month
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    Up to 2 accounts
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    Debt tracking
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    Goals tracking
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t">
                <div className="flex gap-3">
                  <Button
                    onClick={handleGoToDashboard}
                    className="flex-1"
                  >
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Paid plan
  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Welcome! 🎉</h1>
          <p className="text-lg text-muted-foreground">
            Your subscription is active!
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Subscription Confirmed
            </CardTitle>
            <CardDescription>
              Thank you for subscribing! You now have access to all pro features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Pro benefits:</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-1.5 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Unlimited transactions
                </li>
                <li className="flex items-center gap-1.5 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Unlimited accounts
                </li>
                <li className="flex items-center gap-1.5 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Investment tracking
                </li>
                <li className="flex items-center gap-1.5 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Advanced reports
                </li>
                <li className="flex items-center gap-1.5 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  CSV export
                </li>
                <li className="flex items-center gap-1.5 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  Priority support
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={handleGoToDashboard}
                className="w-full"
              >
                Start Using Pro Features
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">
            Loading...
          </div>
        </div>
      </div>
    }>
      <WelcomeContent />
    </Suspense>
  );
}

