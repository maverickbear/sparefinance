"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/common/plan-badge";
import { Subscription, Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface PlanCardProps {
  subscription: Subscription | null;
  plan: Plan | null;
  onManage?: () => void;
}

export function PlanCard({ subscription, plan, onManage }: PlanCardProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleManage() {
    router.push("/dashboard?openPricingModal=true");
  }

  if (!subscription || !plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">No Active Plan</p>
              <p className="text-xs text-muted-foreground">Please select a plan</p>
            </div>
            <Button
              variant="ghost"
              onClick={handleManage}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const price = subscription.currentPeriodStart && subscription.currentPeriodEnd
    ? plan.priceMonthly
    : 0;

  const billingText = price > 0 
    ? `$${price.toFixed(2)} Billed Monthly`
    : "No active subscription";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium">
                  {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} Plan
                </p>
                <PlanBadge plan={plan.name} />
              </div>
              <p className="text-xs text-muted-foreground">{billingText}</p>
            </div>
              <Button
                variant="ghost"
                onClick={handleManage}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

