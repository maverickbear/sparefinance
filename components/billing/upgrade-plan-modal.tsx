"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StripePricingTable } from "@/components/billing/stripe-pricing-table";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface UpgradePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId?: string;
  onSuccess?: () => void;
  preloadedPlans?: any[]; // Not used anymore, kept for backward compatibility
}

export function UpgradePlanModal({ 
  open, 
  onOpenChange, 
  currentPlanId,
  onSuccess,
  preloadedPlans = []
}: UpgradePlanModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Get Stripe Pricing Table ID from environment
  const pricingTableId = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  useEffect(() => {
    if (open) {
      loadCustomerInfo();
      setLoading(false);
    }
  }, [open]);

  async function loadCustomerInfo() {
    try {
      const response = await fetch("/api/stripe/customer");
      if (response.ok) {
        const data = await response.json();
        setCustomerId(data.customerId);
        setCustomerEmail(data.customerEmail);
        setUserId(data.userId || null);
      }
    } catch (error) {
      console.error("Error loading customer info:", error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle className="text-2xl">Choose Your Plan</DialogTitle>
          <DialogDescription className="text-base">
            Select a plan to upgrade your subscription. You can change or cancel at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !pricingTableId || !publishableKey ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Pricing table is not configured. Please set NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your environment variables.
              </p>
              <button
                onClick={() => router.push("/pricing")}
                className="text-primary hover:underline"
              >
                Go to Pricing Page
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-full max-w-4xl">
                <StripePricingTable
                  pricingTableId={pricingTableId}
                  publishableKey={publishableKey}
                  customerId={customerId || undefined}
                  customerEmail={customerEmail || undefined}
                  clientReferenceId={userId || undefined}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

