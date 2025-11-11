"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { PromoCode } from "@/lib/api/admin";

const promoCodeSchema = z.object({
  code: z.string().min(1, "Code is required").max(50, "Code must be 50 characters or less"),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.number().min(0.01, "Discount value must be greater than 0"),
  duration: z.enum(["once", "forever", "repeating"]),
  durationInMonths: z.number().optional(),
  maxRedemptions: z.number().optional(),
  expiresAt: z.string().optional(),
  planIds: z.array(z.string()).optional(),
});

type PromoCodeFormData = z.infer<typeof promoCodeSchema>;

interface PromoCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoCode?: PromoCode | null;
  onSuccess?: () => void;
  availablePlans?: { id: string; name: string }[];
}

export function PromoCodeDialog({
  open,
  onOpenChange,
  promoCode,
  onSuccess,
  availablePlans = [],
}: PromoCodeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

  const form = useForm<PromoCodeFormData>({
    resolver: zodResolver(promoCodeSchema),
    defaultValues: promoCode
      ? {
          code: promoCode.code,
          discountType: promoCode.discountType,
          discountValue: promoCode.discountValue,
          duration: promoCode.duration,
          durationInMonths: promoCode.durationInMonths || undefined,
          maxRedemptions: promoCode.maxRedemptions || undefined,
          expiresAt: promoCode.expiresAt
            ? new Date(promoCode.expiresAt).toISOString().split("T")[0]
            : undefined,
          planIds: promoCode.planIds || [],
        }
      : {
          code: "",
          discountType: "percent",
          discountValue: 0,
          duration: "once",
          durationInMonths: undefined,
          maxRedemptions: undefined,
          expiresAt: undefined,
          planIds: [],
        },
  });

  useEffect(() => {
    if (promoCode) {
      setSelectedPlanIds(promoCode.planIds || []);
    } else {
      setSelectedPlanIds([]);
    }
  }, [promoCode, open]);

  const onSubmit = async (data: PromoCodeFormData) => {
    setIsSubmitting(true);
    try {
      const payload: any = {
        ...data,
        planIds: selectedPlanIds,
      };

      if (data.expiresAt) {
        payload.expiresAt = new Date(data.expiresAt).toISOString();
      } else {
        payload.expiresAt = null;
      }

      if (promoCode) {
        // Update
        const response = await fetch("/api/admin/promo-codes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: promoCode.id,
            ...payload,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update promo code");
        }
      } else {
        // Create
        const response = await fetch("/api/admin/promo-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create promo code");
        }
      }

      onOpenChange(false);
      form.reset();
      setSelectedPlanIds([]);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving promo code:", error);
      alert(error instanceof Error ? error.message : "Failed to save promo code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  const duration = form.watch("duration");
  const discountType = form.watch("discountType");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {promoCode ? "Edit Promo Code" : "Create Promo Code"}
          </DialogTitle>
          <DialogDescription>
            {promoCode
              ? "Update the promo code details below."
              : "Create a new promo code that can be used for discounts on subscriptions."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              {...form.register("code")}
              placeholder="GETFREE"
              className="font-mono"
              required
            />
            {form.formState.errors.code && (
              <p className="text-sm text-destructive">
                {form.formState.errors.code.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discountType">Discount Type</Label>
              <Select
                value={form.watch("discountType")}
                onValueChange={(value) => form.setValue("discountType", value as "percent" | "fixed")}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountValue">
                Discount Value {discountType === "percent" ? "(%)" : "($)"}
              </Label>
              <Input
                id="discountValue"
                type="number"
                step={discountType === "percent" ? "1" : "0.01"}
                min="0"
                {...form.register("discountValue", { valueAsNumber: true })}
                placeholder={discountType === "percent" ? "100" : "10.00"}
                required
              />
              {form.formState.errors.discountValue && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.discountValue.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <Select
              value={form.watch("duration")}
              onValueChange={(value) => {
                form.setValue("duration", value as "once" | "forever" | "repeating");
                if (value !== "repeating") {
                  form.setValue("durationInMonths", undefined);
                }
              }}
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Once</SelectItem>
                <SelectItem value="forever">Forever</SelectItem>
                <SelectItem value="repeating">Repeating</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {duration === "repeating" && (
            <div className="space-y-2">
              <Label htmlFor="durationInMonths">Duration in Months</Label>
              <Input
                id="durationInMonths"
                type="number"
                min="1"
                {...form.register("durationInMonths", { valueAsNumber: true })}
                placeholder="3"
                required
              />
              {form.formState.errors.durationInMonths && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.durationInMonths.message}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxRedemptions">Max Redemptions (optional)</Label>
              <Input
                id="maxRedemptions"
                type="number"
                min="1"
                {...form.register("maxRedemptions", { valueAsNumber: true })}
                placeholder="Unlimited"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expires At (optional)</Label>
              <Input
                id="expiresAt"
                type="date"
                {...form.register("expiresAt")}
              />
            </div>
          </div>

          {availablePlans.length > 0 && (
            <div className="space-y-2">
              <Label>Applicable Plans (leave empty for all plans)</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
                {availablePlans.map((plan) => (
                  <label
                    key={plan.id}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlanIds.includes(plan.id)}
                      onChange={() => togglePlan(plan.id)}
                      className="rounded"
                    />
                    <span className="text-sm">{plan.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {promoCode ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

