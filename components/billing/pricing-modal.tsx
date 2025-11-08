"use client";

import { useEffect, useState, Suspense } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PlanSelector } from "@/components/billing/plan-selector";
import { Plan } from "@/lib/validations/plan";
import { Loader2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId?: string;
  onSuccess?: () => void;
}

// Component that uses useSearchParams - must be wrapped in Suspense
function PricingModalContent({ 
  open, 
  onOpenChange, 
  currentPlanId,
  onSuccess
}: PricingModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | undefined>(currentPlanId);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (open) {
      loadPlans();
    }
  }, [open]);

  useEffect(() => {
    // Check for success/cancel from Stripe
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success) {
      // Redirect to billing page after successful payment
      onOpenChange(false);
      router.push("/billing?success=true");
    } else if (canceled) {
      // Show cancel message
      console.log("Checkout was canceled");
    }
  }, [searchParams, router, onOpenChange]);

  async function loadPlans() {
    try {
      setLoading(true);

      // Get plans
      const plansResponse = await fetch("/api/billing/plans");
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.plans);
        setCurrentPlan(plansData.currentPlanId || currentPlanId);
      }
    } catch (error) {
      console.error("Error loading plans:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlan(planId: string, interval: "month" | "year") {
    try {
      setSelecting(true);

      // Create checkout session
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId, interval }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        console.error("Failed to create checkout session:", data.error);
        alert("Failed to create checkout session. Please try again.");
      }
    } catch (error) {
      console.error("Error selecting plan:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setSelecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[100vw] !w-screen !h-screen !max-h-[100vh] !m-0 !rounded-none !flex !flex-col !p-0 !gap-0 !translate-x-0 !translate-y-0 !left-0 !top-0 !inset-0 [&>button]:hidden">
        {/* Header with X button */}
        <div className="flex items-center justify-end px-6 py-4 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="container mx-auto max-w-7xl">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <PlanSelector
                plans={plans}
                currentPlanId={currentPlan}
                onSelectPlan={handleSelectPlan}
                loading={selecting}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Wrapper component that provides Suspense boundary for useSearchParams
export function PricingModal(props: PricingModalProps) {
  return (
    <Suspense fallback={null}>
      <PricingModalContent {...props} />
    </Suspense>
  );
}

