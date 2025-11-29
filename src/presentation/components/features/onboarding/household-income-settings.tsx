"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";

const INCOME_RANGES: Array<{ value: NonNullable<ExpectedIncomeRange>; label: string }> = [
  { value: "0-50k", label: "$0 - $50,000" },
  { value: "50k-100k", label: "$50,000 - $100,000" },
  { value: "100k-150k", label: "$100,000 - $150,000" },
  { value: "150k-250k", label: "$150,000 - $250,000" },
  { value: "250k+", label: "$250,000+" },
];

export function HouseholdIncomeSettings() {
  const { toast } = useToast();
  const [selectedIncome, setSelectedIncome] = useState<ExpectedIncomeRange>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCurrentIncome();
  }, []);

  async function loadCurrentIncome() {
    try {
      setLoading(true);
      const response = await fetch("/api/v2/onboarding/income");
      if (!response.ok) {
        throw new Error("Failed to load income");
      }

      const data = await response.json();
      if (data.expectedIncome) {
        setSelectedIncome(data.expectedIncome);
      }
    } catch (error) {
      console.error("Error loading current income:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedIncome) {
      toast({
        title: "Please select an income range",
        description: "Select your expected household income to update your settings.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/v2/onboarding/income", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ incomeRange: selectedIncome }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save income");
      }

      toast({
        title: "Income updated",
        description: "Your expected income has been updated successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving income:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save income. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expected Household Income</CardTitle>
          <CardDescription>
            Used to tailor your budgets and insights. Not shared with anyone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expected Household Income</CardTitle>
        <CardDescription>
          Used to tailor your budgets and insights. Not shared with anyone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={selectedIncome || undefined}
          onValueChange={(value) => setSelectedIncome(value as ExpectedIncomeRange)}
        >
          <div className="space-y-3">
            {INCOME_RANGES.map((range) => (
              <div key={range.value} className="flex items-center space-x-2">
                <RadioGroupItem value={range.value} id={`settings-${range.value}`} />
                <Label htmlFor={`settings-${range.value}`} className="cursor-pointer flex-1">
                  {range.label}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={saving || !selectedIncome}
            size="small"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

