"use client";

import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { BillingIntervalToggle } from "@/components/billing/billing-interval-toggle";
import { Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  "Unlimited transactions and accounts",
  "Dashboard and Spare Score",
  "Budgets, goals, and reports",
  "Receipt scanning",
  "Household sharing",
];

export type UpgradeDialogSubscriptionStatus = "no_subscription" | "cancelled" | "past_due" | "unpaid" | null;

interface ProUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionStatus?: UpgradeDialogSubscriptionStatus;
  currentPlanId?: string;
  currentInterval?: "month" | "year" | null;
  onSelectPlan: (planId: string, interval: "month" | "year") => void;
  onManageSubscription?: () => void;
  canClose?: boolean;
  loading?: boolean;
}

function getCopy(subscriptionStatus: UpgradeDialogSubscriptionStatus) {
  const isNoPlan = !subscriptionStatus || subscriptionStatus === "no_subscription";
  const isReactivation =
    subscriptionStatus === "cancelled" || subscriptionStatus === "past_due" || subscriptionStatus === "unpaid";

  if (isNoPlan) {
    return {
      title: "Upgrade to Pro",
      description:
        "Get full control of your money with the Pro plan. Start your 30-day free trial—you'll only be charged after the trial ends. Cancel anytime.",
      primaryButton: "Start 30-day trial",
      secondaryButton: null as string | null,
    };
  }

  if (subscriptionStatus === "cancelled") {
    return {
      title: "Reactivate your subscription",
      description:
        "Your subscription has been cancelled. Reactivate to regain full access, or choose a new plan below.",
      primaryButton: "Reactivate",
      secondaryButton: "Maybe later",
    };
  }
  if (subscriptionStatus === "past_due") {
    return {
      title: "Payment past due",
      description:
        "Your payment is past due. Update your payment method to avoid losing access, or choose a new plan below.",
      primaryButton: "Update payment",
      secondaryButton: "Maybe later",
    };
  }
  if (subscriptionStatus === "unpaid") {
    return {
      title: "Payment required",
      description:
        "Your subscription is unpaid. Update your payment method to continue, or choose a new plan below.",
      primaryButton: "Update payment",
      secondaryButton: "Maybe later",
    };
  }

  return {
    title: "Upgrade to Pro",
    description:
      "Get full control of your money with the Pro plan. Start your 30-day free trial—you'll only be charged after the trial ends. Cancel anytime.",
    primaryButton: "Start 30-day trial",
    secondaryButton: null as string | null,
  };
}

export function ProUpgradeDialog({
  open,
  onOpenChange,
  subscriptionStatus = "no_subscription",
  currentPlanId,
  currentInterval,
  onSelectPlan,
  onManageSubscription,
  canClose = false,
  loading = false,
}: ProUpgradeDialogProps) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [interval, setInterval] = useState<"month" | "year">("year");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setPlansLoading(true);
      try {
        const usePublic = currentPlanId === undefined && currentInterval === null;
        let res: Response;
        if (usePublic) {
          res = await fetch("/api/billing/plans/public");
        } else {
          res = await fetch("/api/billing/plans");
          if (!res.ok && res.status === 401) res = await fetch("/api/billing/plans/public");
        }
        if (cancelled || !res.ok) return;
        const data = await res.json();
        const plansData = (data.plans || []) as Plan[];
        const pro = plansData.find((p: Plan) => p.name?.toLowerCase() === "pro") ?? plansData[0];
        if (pro) setPlan(pro);
      } catch {
        if (!cancelled) setPlan(null);
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentPlanId, currentInterval]);

  const copy = getCopy(subscriptionStatus);
  const needsReactivation =
    subscriptionStatus === "cancelled" || subscriptionStatus === "past_due" || subscriptionStatus === "unpaid";
  const priceMonthly = plan?.priceMonthly ?? 14.99;
  const priceYearly = plan?.priceYearly ?? 149.9;
  const yearlyMonthly = priceYearly / 12;
  const yearlySavingsPct = priceMonthly > 0 ? Math.round((1 - priceYearly / 12 / priceMonthly) * 100) : 0;
  const priceLine1 =
    interval === "month"
      ? `$${priceMonthly.toFixed(2)} / month`
      : `$${yearlyMonthly.toFixed(2)} / month`;
  const priceLine2 = interval === "year" ? `Billed yearly $${priceYearly.toFixed(2)}` : null;

  function handlePrimary() {
    if (needsReactivation && (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid") && onManageSubscription) {
      onManageSubscription();
      return;
    }
    if (needsReactivation && subscriptionStatus === "cancelled" && onManageSubscription) {
      onManageSubscription();
      return;
    }
    if (plan) onSelectPlan(plan.id, interval);
  }

  function handleSecondary() {
    if (canClose) {
      onOpenChange(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex w-full max-w-lg flex-col overflow-hidden rounded-none border border-border bg-background p-0 shadow-lg",
            "left-0 top-0 h-full max-h-screen translate-x-0 translate-y-0",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "sm:left-[50%] sm:top-[50%] sm:max-w-2xl sm:h-auto sm:max-h-[90vh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl"
          )}
          onInteractOutside={(e) => !canClose && e.preventDefault()}
          onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">
            {copy.title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {copy.description}
          </DialogPrimitive.Description>
          <div className="flex min-h-0 flex-col sm:flex-row sm:min-h-[420px]">
            {/* Left panel – branding green */}
            <div className="flex shrink-0 flex-col justify-end bg-primary px-6 py-8 sm:w-[42%] sm:rounded-l-2xl sm:px-8 sm:py-10">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Pro plan
              </h2>
              {plansLoading ? (
                <div className="mt-2 h-8 w-32 rounded bg-gray-900/20 animate-pulse" />
              ) : (
                <div className="mt-2 text-gray-900">
                  <p className="text-lg font-medium sm:text-xl">{priceLine1}</p>
                  {priceLine2 && (
                    <p className="mt-0.5 text-sm text-gray-900/90">
                      {priceLine2}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right panel – form and actions */}
            <div className="flex flex-1 flex-col overflow-y-auto bg-background px-6 py-6 sm:px-8 sm:py-8 sm:rounded-r-2xl">
              <h3 className="text-xl font-bold text-foreground">{copy.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{copy.description}</p>

              <ul className="mt-6 space-y-3">
                {FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Billing toggle */}
              <div className="mt-6">
                <BillingIntervalToggle
                  value={interval}
                  onValueChange={setInterval}
                  savePercent={yearlySavingsPct}
                  label="Billing"
                />
              </div>

              {/* Actions */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {copy.secondaryButton && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSecondary}
                    disabled={loading}
                  >
                    {copy.secondaryButton}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handlePrimary}
                  disabled={loading || plansLoading || !plan}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    copy.primaryButton
                  )}
                </Button>
              </div>
            </div>
          </div>

          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
