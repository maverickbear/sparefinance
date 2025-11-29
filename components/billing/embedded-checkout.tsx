"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { useRouter } from "next/navigation";

interface EmbeddedCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  interval: "month" | "year";
  onSuccess?: () => void;
}

export function EmbeddedCheckout({
  open,
  onOpenChange,
  plan,
  interval,
  onSuccess,
}: EmbeddedCheckoutProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  async function handleConfirm() {
    if (!plan) return;

    setProcessing(true);

    try {
      const response = await fetch("/api/stripe/embedded-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: plan.id,
          interval,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: "Your 30-day free trial has started!",
          variant: "success",
        });
        onOpenChange(false);
        // Invalidate billing cache
        const { invalidateBillingCache } = await import("@/lib/api/billing-cache");
        invalidateBillingCache();
        // Redirect to billing page to see the subscription
        // Use window.location to force a full page reload and clear all caches
        window.location.href = "/settings?tab=billing";
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to start trial",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error starting trial:", error);
      toast({
        title: "Error",
        description: "Failed to start trial. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }

  const price = interval === "month" ? plan?.priceMonthly : plan?.priceYearly;
  const monthlyPrice = interval === "year" && price ? price / 12 : price;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Start Your Free Trial</DialogTitle>
          <DialogDescription>
            {plan && `You're about to start your 30-day free trial for the ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} Plan.`}
          </DialogDescription>
        </DialogHeader>
        {plan && (
          <div className="px-6 pb-4 space-y-2">
            <p className="text-lg font-semibold">
              {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} Plan
            </p>
            <p className="text-2xl font-bold">
              ${price?.toFixed(2)}/{interval === "month" ? "month" : "year"}
              {interval === "year" && (
                <span className="text-base font-normal text-muted-foreground ml-2">
                  (${monthlyPrice?.toFixed(2)}/month)
                </span>
              )}
            </p>
            <div className="pt-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                ✓ 30-day free trial - No charge until trial ends
              </p>
              <p className="text-sm text-muted-foreground">
                ✓ Cancel anytime during trial
              </p>
              <p className="text-sm text-muted-foreground">
                ✓ Full access to all features
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing || !plan}>
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Free Trial"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

