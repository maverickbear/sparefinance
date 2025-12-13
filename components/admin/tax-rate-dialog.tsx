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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import type { TaxRate } from "@/src/domain/taxes/tax-rates.types";
import { useToast } from "@/components/toast-provider";

interface TaxRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rate: TaxRate | null;
  onSuccess: () => void;
}

export function TaxRateDialog({
  open,
  onOpenChange,
  rate,
  onSuccess,
}: TaxRateDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [taxRate, setTaxRate] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    if (rate) {
      setTaxRate((rate.taxRate * 100).toFixed(4));
      setDisplayName(rate.displayName);
      setDescription(rate.description || "");
      setIsActive(rate.isActive);
    }
  }, [rate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rate) {
      return;
    }

    // Validate tax rate
    const rateValue = parseFloat(taxRate);
    if (isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
      toast({
        title: "Error",
        description: "Tax rate must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    // Convert percentage to decimal
    const taxRateDecimal = rateValue / 100;

    setLoading(true);
    try {
      const response = await fetch(`/api/v2/tax-rates/${rate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxRate: taxRateDecimal,
          displayName,
          description: description || null,
          isActive,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update tax rate");
      }

      toast({
        title: "Success",
        description: "Tax rate updated successfully",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update tax rate",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!rate) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Tax Rate</DialogTitle>
            <DialogDescription>
              Update tax rate for {rate.countryCode} - {rate.stateOrProvinceCode}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={rate.countryCode}
                disabled
                size="medium"
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">State/Province Code</Label>
              <Input
                id="code"
                value={rate.stateOrProvinceCode}
                disabled
                size="medium"
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxRate">
                Tax Rate (%)
                <span className="text-xs text-muted-foreground ml-2">
                  (e.g., 5.0 for 5%)
                </span>
              </Label>
              <Input
                id="taxRate"
                type="number"
                step="0.0001"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                size="medium"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                size="medium"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                size="medium"
                rows={3}
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

