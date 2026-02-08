"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { cn } from "@/lib/utils";

const INCOME_RANGES: Array<{ value: NonNullable<ExpectedIncomeRange>; label: string }> = [
  { value: "0-50k", label: "$0 - $50,000" },
  { value: "50k-100k", label: "$50,000 - $100,000" },
  { value: "100k-150k", label: "$100,000 - $150,000" },
  { value: "150k-250k", label: "$150,000 - $250,000" },
  { value: "250k+", label: "$250,000+" },
];

function convertToIncomeRange(value: number): ExpectedIncomeRange {
  if (value < 50000) return "0-50k";
  if (value < 100000) return "50k-100k";
  if (value < 150000) return "100k-150k";
  if (value < 250000) return "150k-250k";
  return "250k+";
}

interface ExpectedIncomeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ExpectedIncomeEditDialog({
  open,
  onOpenChange,
  onSuccess,
}: ExpectedIncomeEditDialogProps) {
  const { toast } = useToast();
  const [selectedIncome, setSelectedIncome] = useState<ExpectedIncomeRange>(null);
  const [customIncome, setCustomIncome] = useState<number | undefined>(undefined);
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const customIncomeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      loadCurrentData();
    }
  }, [open]);

  useEffect(() => {
    if (open && useCustom && customIncomeInputRef.current) {
      const t = setTimeout(() => customIncomeInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open, useCustom]);

  async function loadCurrentData() {
    if (!open) return;
    setLoading(true);
    try {
      const incomeResponse = await fetch("/api/v2/onboarding/income");
      if (incomeResponse.ok) {
        const incomeData = await incomeResponse.json();
        if (incomeData.expectedIncome) {
          setSelectedIncome(incomeData.expectedIncome);
        }
        if (
          incomeData.expectedIncomeAmount != null &&
          incomeData.expectedIncomeAmount !== undefined
        ) {
          setCustomIncome(incomeData.expectedIncomeAmount);
          setUseCustom(true);
        } else {
          setCustomIncome(undefined);
          setUseCustom(false);
        }
      }
    } catch (error) {
      console.error("Error loading expected income:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleIncomeChange(value: string) {
    if (value === "custom") {
      setUseCustom(true);
      return;
    }
    setUseCustom(false);
    setCustomIncome(undefined);
    setSelectedIncome(value as ExpectedIncomeRange);
  }

  function handleCustomIncomeChange(value: number | undefined) {
    setCustomIncome(value);
    if (value !== undefined && value > 0) {
      setSelectedIncome(convertToIncomeRange(value));
    }
  }

  async function handleSave() {
    if (useCustom && (!customIncome || customIncome <= 0)) {
      toast({
        title: "Enter your expected annual income",
        description: "Enter your expected annual household income to update.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedIncome && !useCustom) {
      toast({
        title: "Select an income range",
        description: "Select your expected household income to update.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const body: { incomeRange: ExpectedIncomeRange; incomeAmount?: number | null } = {
        incomeRange: selectedIncome,
      };
      if (useCustom && customIncome && customIncome > 0) {
        body.incomeAmount = customIncome;
      } else {
        body.incomeAmount = null;
      }

      const res = await fetch("/api/v2/onboarding/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      toast({
        title: "Income updated",
        description: "Your income has been saved.",
        variant: "success",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Income</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Used to compare your spending with what you expect to earn this month.
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Annual household income</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INCOME_RANGES.map((range) => {
                    const isSelected = !useCustom && selectedIncome === range.value;
                    return (
                      <Card
                        key={range.value}
                        className={cn(
                          "cursor-pointer transition-all hover:border-primary/50",
                          isSelected && "border-primary border-2 bg-primary/5"
                        )}
                        onClick={() => handleIncomeChange(range.value)}
                      >
                        <CardContent className="p-3 flex items-center justify-between">
                          <span className="text-xs font-medium">{range.label}</span>
                        </CardContent>
                      </Card>
                    );
                  })}
                  <Card
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary/50",
                      useCustom && "border-primary border-2 bg-primary/5"
                    )}
                    onClick={() => handleIncomeChange("custom")}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <span className="text-xs font-medium">Custom</span>
                    </CardContent>
                  </Card>
                </div>
              </div>
              {useCustom && (
                <div className="space-y-2">
                  <Label htmlFor="custom-income" className="text-sm text-muted-foreground">
                    Enter annual household income
                  </Label>
                  <DollarAmountInput
                    ref={customIncomeInputRef}
                    id="custom-income"
                    value={customIncome ?? undefined}
                    onChange={handleCustomIncomeChange}
                    placeholder="$ 0.00"
                    className="w-full"
                  />
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              loading ||
              (!selectedIncome && !(useCustom && customIncome && customIncome > 0))
            }
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
