"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import type { Plan, PlanFeatures } from "@/src/domain/subscriptions/subscriptions.validations";
import { useToast } from "@/components/toast-provider";
import { getDefaultFeatures, mergeFeaturesWithDefaults } from "@/lib/utils/plan-features";
import { getFeatureConfigs } from "@/lib/utils/plan-features-config";

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  onSuccess: () => void;
}

export function PlanDialog({
  open,
  onOpenChange,
  plan,
  onSuccess,
}: PlanDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Get default features to initialize state
  const defaultFeatures = useMemo(() => getDefaultFeatures(), []);
  const [features, setFeatures] = useState<PlanFeatures>(defaultFeatures);
  
  // Get feature configs dynamically from schema
  const featureConfigs = useMemo(() => getFeatureConfigs(), []);
  
  const [planName, setPlanName] = useState<string>("");
  const [priceMonthly, setPriceMonthly] = useState<number>(0);
  const [priceYearly, setPriceYearly] = useState<number>(0);

  useEffect(() => {
    if (plan) {
      setPlanName(plan.name);
      // Merge plan features with defaults to ensure all fields are defined (no undefined values)
      // This automatically handles new features added to the schema that don't exist in the database yet
      // This prevents "uncontrolled to controlled" warnings in Switch components
      setFeatures(mergeFeaturesWithDefaults(plan.features));
      setPriceMonthly(plan.priceMonthly);
      setPriceYearly(plan.priceYearly);
    }
  }, [plan]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan) {
      console.error("No plan selected");
      return;
    }

    console.log("Submitting plan update:", {
      id: plan.id,
      name: planName,
      features,
      priceMonthly,
      priceYearly,
    });

    setLoading(true);
    try {
      const response = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: plan.id,
          name: planName,
          features,
          priceMonthly,
          priceYearly,
        }),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error("API error response:", error);
        throw new Error(error.error || error.details || "Failed to update plan");
      }

      const data = await response.json();
      console.log("API success response:", data);
      
      // Check Stripe sync status
      if (data.stripeSync) {
        if (data.stripeSync.success) {
          toast({
            title: "Plan updated",
            description: `Plan ${planName} has been updated successfully and synced to Stripe.`,
          });
        } else if (data.stripeSync.warnings && data.stripeSync.warnings.length > 0) {
          toast({
            title: "Plan updated with warnings",
            description: `Plan updated, but some Stripe sync operations had issues: ${data.stripeSync.warnings.join(", ")}`,
            variant: "default",
          });
        } else {
          toast({
            title: "Plan updated",
            description: `Plan ${planName} updated, but Stripe sync failed: ${data.stripeSync.error || "Unknown error"}`,
            variant: "default",
          });
        }
      } else {
        toast({
          title: "Plan updated",
          description: `Plan ${planName} has been updated successfully.`,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating plan:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update plan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Plan: {plan?.name}</DialogTitle>
          <DialogDescription>
            Update plan features and pricing. Changes will be synced to Stripe if configured.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="px-6 pb-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="planName">Plan Name</Label>
              <Input
                id="planName"
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                required
                placeholder="e.g., Essential Plan, Pro Plan"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceMonthly">Monthly Price (CAD)</Label>
                <Input
                  id="priceMonthly"
                  type="number"
                  step="0.01"
                  value={priceMonthly}
                  onChange={(e) => setPriceMonthly(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceYearly">Yearly Price (CAD)</Label>
                <Input
                  id="priceYearly"
                  type="number"
                  step="0.01"
                  value={priceYearly}
                  onChange={(e) => setPriceYearly(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold">Limits</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxTransactions">Max Transactions</Label>
                  <Input
                    id="maxTransactions"
                    type="number"
                    value={features.maxTransactions === -1 ? "" : features.maxTransactions}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFeatures({
                        ...features,
                        maxTransactions: value === "" ? -1 : parseInt(value) || 0,
                      });
                    }}
                    placeholder="-1 for unlimited"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use -1 for unlimited
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAccounts">Max Accounts</Label>
                  <Input
                    id="maxAccounts"
                    type="number"
                    value={features.maxAccounts === -1 ? "" : features.maxAccounts}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFeatures({
                        ...features,
                        maxAccounts: value === "" ? -1 : parseInt(value) || 0,
                      });
                    }}
                    placeholder="-1 for unlimited"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use -1 for unlimited
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold">Features</h3>
              <div className="grid grid-cols-2 gap-4">
                {featureConfigs
                  .filter((config) => config.type === "boolean")
                  .map((config) => (
                    <div key={config.key} className="flex items-center justify-between">
                      <Label htmlFor={config.key}>{config.label}</Label>
                      <Switch
                        id={config.key}
                        checked={features[config.key] as boolean}
                        onCheckedChange={(checked) =>
                          setFeatures({ ...features, [config.key]: checked })
                        }
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

