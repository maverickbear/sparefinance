"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { DynamicPricingTable } from "./dynamic-pricing-table";
import { EmbeddedCheckout } from "./embedded-checkout";
import { Plan } from "@/src/domain/subscriptions/subscriptions.validations";

interface PlanChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId?: string;
  currentInterval?: "month" | "year" | null; // Current subscription interval
  onSuccess?: () => void;
}

export function PlanChangeModal({
  open,
  onOpenChange,
  currentPlanId,
  currentInterval,
  onSuccess,
}: PlanChangeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<{ plan: Plan; interval: "month" | "year" } | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleUpgradeDowngrade(planId: string, interval: "month" | "year") {
    if (!currentPlanId) {
      // No current subscription, open checkout with selected plan
      try {
        const response = await fetch("/api/billing/plans");
        if (response.ok) {
          const data = await response.json();
          const plan = (data.plans || []).find((p: Plan) => p.id === planId);
          if (plan) {
            setSelectedPlan({ plan, interval });
            setShowCheckout(true);
          }
        }
      } catch (error) {
        console.error("Error loading plan:", error);
      }
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/stripe/subscription", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          interval,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Plan updated successfully",
          variant: "success",
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update plan",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating plan:", error);
      toast({
        title: "Error",
        description: "Failed to update plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open && !showCheckout} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Select a new plan. Changes will be prorated automatically.
            </DialogDescription>
          </DialogHeader>

          <DynamicPricingTable
            currentPlanId={currentPlanId}
            currentInterval={currentInterval}
            onSelectPlan={handleUpgradeDowngrade}
            showTrial={false}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedPlan && (
        <EmbeddedCheckout
          open={showCheckout}
          onOpenChange={(open) => {
            setShowCheckout(open);
            if (!open) {
              setSelectedPlan(null);
            }
          }}
          plan={selectedPlan.plan}
          interval={selectedPlan.interval}
          onSuccess={() => {
            setShowCheckout(false);
            setSelectedPlan(null);
            onOpenChange(false);
            onSuccess?.();
          }}
        />
      )}
    </>
  );
}

