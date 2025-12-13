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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import type { FederalTaxBracket } from "@/src/domain/taxes/federal-brackets.types";
import { useToast } from "@/components/toast-provider";

interface FederalBracketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bracket: FederalTaxBracket | null;
  onSuccess: () => void;
}

export function FederalBracketDialog({
  open,
  onOpenChange,
  bracket,
  onSuccess,
}: FederalBracketDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [minIncome, setMinIncome] = useState<string>("");
  const [maxIncome, setMaxIncome] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    if (bracket) {
      setMinIncome(bracket.minIncome.toString());
      setMaxIncome(bracket.maxIncome?.toString() || "");
      setTaxRate((bracket.taxRate * 100).toFixed(2));
      setIsActive(bracket.isActive);
    }
  }, [bracket]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bracket) {
      return;
    }

    // Validate inputs
    const minIncomeValue = parseFloat(minIncome);
    if (isNaN(minIncomeValue) || minIncomeValue < 0) {
      toast({
        title: "Error",
        description: "Minimum income must be a valid number >= 0",
        variant: "destructive",
      });
      return;
    }

    const maxIncomeValue = maxIncome ? parseFloat(maxIncome) : null;
    if (maxIncome && (isNaN(maxIncomeValue!) || maxIncomeValue! <= minIncomeValue)) {
      toast({
        title: "Error",
        description: "Maximum income must be greater than minimum income",
        variant: "destructive",
      });
      return;
    }

    const taxRateValue = parseFloat(taxRate);
    if (isNaN(taxRateValue) || taxRateValue < 0 || taxRateValue > 100) {
      toast({
        title: "Error",
        description: "Tax rate must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    // Convert percentage to decimal
    const taxRateDecimal = taxRateValue / 100;

    setLoading(true);
    try {
      const response = await fetch(`/api/v2/federal-brackets/${bracket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minIncome: minIncomeValue,
          maxIncome: maxIncomeValue,
          taxRate: taxRateDecimal,
          isActive,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update federal bracket");
      }

      toast({
        title: "Success",
        description: "Federal bracket updated successfully",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update federal bracket",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!bracket) {
    return null;
  }

  const countryName = bracket.countryCode === "US" ? "United States" : "Canada";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Federal Tax Bracket</DialogTitle>
            <DialogDescription>
              Update federal tax bracket for {countryName} - {bracket.taxYear} (Bracket #{bracket.bracketOrder})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={countryName}
                disabled
                size="medium"
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="year">Tax Year</Label>
              <Input
                id="year"
                value={bracket.taxYear}
                disabled
                size="medium"
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minIncome">
                Minimum Income ({bracket.countryCode === "US" ? "USD" : "CAD"})
              </Label>
              <Input
                id="minIncome"
                type="number"
                step="0.01"
                min="0"
                value={minIncome}
                onChange={(e) => setMinIncome(e.target.value)}
                size="medium"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxIncome">
                Maximum Income ({bracket.countryCode === "US" ? "USD" : "CAD"})
                <span className="text-xs text-muted-foreground ml-2">
                  (Leave empty for no limit)
                </span>
              </Label>
              <Input
                id="maxIncome"
                type="number"
                step="0.01"
                min="0"
                value={maxIncome}
                onChange={(e) => setMaxIncome(e.target.value)}
                placeholder="No limit"
                size="medium"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxRate">
                Tax Rate (%)
                <span className="text-xs text-muted-foreground ml-2">
                  (e.g., 14.5 for 14.5%)
                </span>
              </Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                size="medium"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="medium"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="medium" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

