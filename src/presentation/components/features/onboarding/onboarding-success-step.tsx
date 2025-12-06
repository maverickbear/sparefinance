"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { useSubscriptionContext } from "@/contexts/subscription-context";

interface OnboardingSuccessStepProps {
  onGoToDashboard: () => void;
  onGoToBilling: () => void;
}

export function OnboardingSuccessStep({
  onGoToDashboard,
  onGoToBilling,
}: OnboardingSuccessStepProps) {
  const { subscription, checking, refetch } = useSubscriptionContext();
  const [loading, setLoading] = useState(true);
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);

  useEffect(() => {
    // Refetch subscription to ensure we have latest data
    refetch().finally(() => {
      setLoading(false);
    });
  }, [refetch]);

  useEffect(() => {
    // Extract trial end date from subscription if available
    if (subscription?.trialEndDate) {
      const trialEnd = typeof subscription.trialEndDate === 'string' ? subscription.trialEndDate : subscription.trialEndDate.toISOString();
      setTrialEndDate(trialEnd);
    }
  }, [subscription]);

  const subscriptionStatus = subscription?.status as "active" | "trialing" | "cancelled" | "past_due" | null;
  const isLoading = loading || checking;

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="flex justify-center mb-6">
        <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
          <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-2 text-center">
        {isLoading
          ? "Confirming your subscription..."
          : subscriptionStatus === "trialing"
            ? "Trial Started Successfully!"
            : "Subscription Successful!"}
      </h2>

      <p className="text-muted-foreground text-center mb-6">
        {isLoading
          ? "Please wait while we confirm your subscription."
          : subscriptionStatus === "trialing"
            ? "Your 30-day trial has started. Start exploring all pro features!"
            : "Thank you for subscribing. Your account has been upgraded."}
      </p>

      {!isLoading && (
        <Card className="border-0 shadow-none w-full max-w-md">
          <CardContent className="space-y-6 pt-0">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">What&apos;s next?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {subscriptionStatus === "trialing" ? (
                  <>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Your 30-day trial is active and you have access to all pro features</span>
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
                      <span>Your subscription is now active and you have access to all pro features</span>
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
                onClick={onGoToDashboard}
                className="flex-1 w-full"
                size="large"
              >
                Go to Dashboard
              </Button>
              <Button
                onClick={onGoToBilling}
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
      )}
    </div>
  );
}

