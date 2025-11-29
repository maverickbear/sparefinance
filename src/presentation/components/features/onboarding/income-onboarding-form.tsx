"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";

const INCOME_RANGES: Array<{ value: NonNullable<ExpectedIncomeRange>; label: string }> = [
  { value: "0-50k", label: "$0 - $50,000" },
  { value: "50k-100k", label: "$50,000 - $100,000" },
  { value: "100k-150k", label: "$100,000 - $150,000" },
  { value: "150k-250k", label: "$150,000 - $250,000" },
  { value: "250k+", label: "$250,000+" },
];

interface IncomeOnboardingFormProps {
  onSuccess?: () => void;
}

export function IncomeOnboardingForm({ onSuccess }: IncomeOnboardingFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedIncome, setSelectedIncome] = useState<ExpectedIncomeRange>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!selectedIncome) {
      toast({
        title: "Please select an income range",
        description: "Select your expected household income to personalize your dashboard.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

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
        title: "Income saved",
        description: "Your dashboard has been personalized based on your expected income.",
        variant: "success",
      });

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error saving income:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save income. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    router.push("/dashboard");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalize your financial plan</CardTitle>
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
                <RadioGroupItem value={range.value} id={range.value} />
                <Label htmlFor={range.value} className="cursor-pointer flex-1">
                  {range.label}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>

        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedIncome}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue"
            )}
          </Button>
          <Button
            onClick={handleSkip}
            variant="outline"
            disabled={loading}
          >
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

