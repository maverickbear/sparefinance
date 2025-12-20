"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/components/common/money";
import type { AccountWithBalance } from "@/src/domain/accounts/accounts.types";
import type { FinancialHealthData } from "@/src/application/shared/financial-health";
import { Target, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast-provider";

interface EmergencyFundWidgetProps {
  financialHealth: FinancialHealthData | null;
  accounts: AccountWithBalance[];
}

// Circular progress indicator component
function CircularProgress({ percentage }: { percentage: number }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
        {/* Background circle */}
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="12"
        />
        {/* Progress circle */}
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-foreground">
            {Math.round(percentage)}%
          </div>
          <div className="text-xs text-muted-foreground">of goal</div>
        </div>
      </div>
    </div>
  );
}

export function EmergencyFundWidget({
  financialHealth,
  accounts,
}: EmergencyFundWidgetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  
  const emergencyFundMonths = financialHealth?.emergencyFundMonths ?? 0;
  const recommendedMonths = 6;
  const targetMonths = 8;

  // Calculate emergency fund amount
  const emergencyFundAmount = useMemo(() => {
    const savingsAccounts = accounts.filter((acc) => acc.type === "savings");
    return savingsAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

  // Calculate monthly expenses (from financial health or estimate)
  const monthlyExpenses = financialHealth?.monthlyExpenses || 0;
  // Use the higher target (8 months) for goal calculation
  const targetAmount = monthlyExpenses * targetMonths;
  const progressPercentage = targetAmount > 0 ? (emergencyFundAmount / targetAmount) * 100 : 0;
  const remainingAmount = Math.max(0, targetAmount - emergencyFundAmount);

  // Calculate automation recommendation
  // Suggest $250/month as a reasonable default, or calculate based on remaining amount
  const suggestedMonthlyAmount = 250;
  const monthsToGoal = remainingAmount > 0 && suggestedMonthlyAmount > 0 
    ? Math.ceil(remainingAmount / suggestedMonthlyAmount)
    : 0;

  // Check if emergency fund is not defined (no savings accounts or no monthly expenses to calculate target)
  const hasEmergencyFundDefined = emergencyFundAmount > 0 || monthlyExpenses > 0;

  const handleAddEmergencyFund = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/goals/ensure-emergency-fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to create emergency fund");
      }

      toast({
        title: "Emergency fund created",
        description: "Your emergency fund goal has been set up successfully.",
        variant: "success",
      });

      // Refresh the page to show updated data
      router.refresh();
    } catch (error) {
      console.error("Error creating emergency fund:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create emergency fund",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Emergency fund</h2>
        {!hasEmergencyFundDefined && (
          <Button
            variant="outline"
            size="small"
            onClick={handleAddEmergencyFund}
            disabled={isCreating}
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add
          </Button>
        )}
      </div>

      {hasEmergencyFundDefined ? (
        <>
          {/* Current Amount */}
          <div>
            <div className="text-3xl font-bold text-foreground">
              {formatMoney(emergencyFundAmount)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {emergencyFundMonths.toFixed(1)} months of coverage
            </div>
          </div>

          {/* Progress Circle and Goal Details */}
          <div className="flex items-center gap-6">
            <CircularProgress percentage={progressPercentage} />
            
            {/* Goal Details */}
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                Goal: <span className="font-semibold text-foreground">{formatMoney(targetAmount)}</span> ({recommendedMonths}-{targetMonths} months)
              </div>
              <div className="text-sm text-muted-foreground">
                Remaining: <span className="font-semibold text-foreground">{formatMoney(remainingAmount)}</span>
              </div>
            </div>
          </div>

          {/* Next Step Section */}
          {remainingAmount > 0 && (
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <div className="flex items-start gap-3 mb-3">
                <Target className="w-5 h-5 text-foreground mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Next step</h3>
                  <p className="text-sm text-muted-foreground">
                    Automate {formatMoney(suggestedMonthlyAmount)}/month to reach your goal in {monthsToGoal} months.
                  </p>
                </div>
              </div>
              <Button 
                variant="default" 
                size="medium"
                className="w-full bg-foreground text-background hover:bg-foreground/90"
              >
                Automate transfer
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            No emergency fund set up yet. Add one to start tracking your progress.
          </p>
        </div>
      )}
    </div>
  );
}

