"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { useSubscriptionContext } from "@/contexts/subscription-context";
import { logger } from "@/src/infrastructure/utils/logger";

interface SubscriptionSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SubscriptionSuccessDialog({
  open,
  onOpenChange,
  onSuccess,
}: SubscriptionSuccessDialogProps) {
  const router = useRouter();
  const { subscription, refetch, checking } = useSubscriptionContext();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      syncSubscription();
    }
  }, [open]);

  // When webhook is not configured (e.g. sandbox), this sync is the only way the subscription
  // is created in Supabase. We retry several times because Stripe can take a few seconds to
  // make the subscription listable after checkout.
  async function syncSubscription(retryCount = 0) {
    const maxRetries = 5;
    const retryDelay = 2500; // 2.5s – give Stripe time to propagate in sandbox

    try {
      setSyncing(true);
      setLoading(true);
      logger.info("[SUCCESS-DIALOG] Syncing subscription from Stripe...", { retryCount });

      const response = await fetch("/api/stripe/sync-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json().catch(() => ({ error: "Invalid response" }));

      if (response.ok && data.success) {
        logger.info("[SUCCESS-DIALOG] Subscription synced successfully:", data.subscription);
        await refetch();
      } else {
        const errMsg = data.details ? `${data.error}: ${data.details}` : data.error;
        console.error("[SUCCESS-DIALOG] Failed to sync subscription:", errMsg);

        if (data.retry && retryCount < maxRetries) {
          logger.info(`[SUCCESS-DIALOG] Retrying sync in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return syncSubscription(retryCount + 1);
        }

        if (response.status === 404 && retryCount < maxRetries) {
          logger.info(`[SUCCESS-DIALOG] Subscription not found yet, retrying in ${retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return syncSubscription(retryCount + 1);
        }

        console.warn("[SUCCESS-DIALOG] Subscription sync failed after retries:", data.error);
      }
    } catch (error) {
      console.error("[SUCCESS-DIALOG] Error syncing subscription:", error);

      if (retryCount < maxRetries) {
        logger.info(`[SUCCESS-DIALOG] Network error, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return syncSubscription(retryCount + 1);
      }
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }

  // Update trial end date from subscription when it changes
  useEffect(() => {
    if (subscription?.trialEndDate) {
      const trialEnd = typeof subscription.trialEndDate === 'string' ? subscription.trialEndDate : subscription.trialEndDate.toISOString();
      setTrialEndDate(trialEnd);
    }
  }, [subscription]);

  const subscriptionStatus = subscription?.status as "active" | "trialing" | "cancelled" | "past_due" | null;
  const isLoading = loading || checking || syncing;

  const handleGoToDashboard = async () => {
    // Close the dialog first
    onOpenChange(false);
    
    // Trigger confetti animation after dialog closes
    try {
      const confettiModule = await import("canvas-confetti");
      const confetti = confettiModule.default;
      
      // Small delay to ensure dialog is closed before confetti starts
      setTimeout(() => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        function randomInRange(min: number, max: number) {
          return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }

          const particleCount = 50 * (timeLeft / duration);
          
          // Launch confetti from left
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          });
          
          // Launch confetti from right
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          });
        }, 250);
      }, 100);
    } catch (error) {
      console.error("[SUCCESS-DIALOG] Failed to load confetti:", error);
    }
    
    
    if (onSuccess) {
      onSuccess();
    }
    
    // Force a full page reload with cache-busting to ensure cache is cleared and subscription is re-checked
    const timestamp = Date.now();
    window.location.replace(`/dashboard?_t=${timestamp}`);
  };

  const handleGoToBilling = () => {
    onOpenChange(false);
    router.push("/settings/billing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-sentiment-positive/10 p-3">
              <CheckCircle2 className="w-12 h-12 text-sentiment-positive" />
            </div>
          </div>
          <DialogTitle className="text-2xl mb-2">
            {isLoading 
              ? "Confirming your subscription..." 
              : subscriptionStatus === "trialing" 
                ? "Trial Started Successfully!" 
                : "Subscription Successful!"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isLoading 
              ? "Please wait while we confirm your subscription."
              : subscriptionStatus === "trialing" 
                ? "Your 30-day trial has started. Start exploring all pro features!"
                : "Thank you for subscribing. Your account has been upgraded."}
          </DialogDescription>
        </DialogHeader>

        {!isLoading && (
          <Card className="border-0 shadow-none">
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
                        <span>You'll only be charged after your trial ends. Cancel anytime—your plan stays active until the end of your billing cycle.</span>
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
                  onClick={handleGoToDashboard}
                  className="flex-1 w-full"
                  size="medium"
                >
                  Go to Dashboard
                </Button>
                <Button
                  onClick={handleGoToBilling}
                  variant="outline"
                  className="flex-1 w-full"
                  size="medium"
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
      </DialogContent>
    </Dialog>
  );
}


