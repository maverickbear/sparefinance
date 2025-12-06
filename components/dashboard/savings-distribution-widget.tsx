"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/components/common/money";
import { useToast } from "@/components/toast-provider";
import type { Goal } from "@/src/domain/goals/goals.types";
import { ArrowRight, Plus, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SavingsDistributionWidgetProps {
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
  goals: (Goal | any)[]; // Accept both Goal and GoalWithCalculations
}

export function SavingsDistributionWidget({
  selectedMonthTransactions,
  lastMonthTransactions,
  goals,
}: SavingsDistributionWidgetProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false);
  const [distributionAmounts, setDistributionAmounts] = useState<Record<string, number>>({});
  const [isDistributing, setIsDistributing] = useState(false);

  // Helper function to parse date from Supabase format
  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    // Handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" formats
    const normalized = dateStr.replace(' ', 'T').split('.')[0]; // Remove milliseconds if present
    return new Date(normalized);
  };

  // Get today's date (without time) to filter out future transactions
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // Filter transactions to only include those with date <= today
  // Exclude future transactions as they haven't happened yet
  const pastSelectedMonthTransactions = useMemo(() => {
    return selectedMonthTransactions.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [selectedMonthTransactions, today]);

  const pastLastMonthTransactions = useMemo(() => {
    return lastMonthTransactions.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [lastMonthTransactions, today]);

  // Calculate expenses for current month and last month
  // Only include past transactions (exclude future ones)
  const currentMonthExpenses = useMemo(() => {
    return pastSelectedMonthTransactions
      .filter((t) => t && t.type === "expense")
      .reduce((sum, t) => {
        const amount = t.amount != null ? (typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount)) : 0;
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
  }, [pastSelectedMonthTransactions]);

  const lastMonthExpenses = useMemo(() => {
    return pastLastMonthTransactions
      .filter((t) => t && t.type === "expense")
      .reduce((sum, t) => {
        const amount = t.amount != null ? (typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount)) : 0;
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
  }, [pastLastMonthTransactions]);

  // Calculate savings (positive when current expenses < last month expenses)
  const savings = useMemo(() => {
    if (lastMonthExpenses <= 0 || currentMonthExpenses >= lastMonthExpenses) {
      return 0;
    }
    return lastMonthExpenses - currentMonthExpenses;
  }, [currentMonthExpenses, lastMonthExpenses]);

  // Calculate potential savings (when current expenses > last month expenses)
  const potentialSavings = useMemo(() => {
    if (lastMonthExpenses <= 0 || currentMonthExpenses <= lastMonthExpenses) {
      return 0;
    }
    return currentMonthExpenses - lastMonthExpenses;
  }, [currentMonthExpenses, lastMonthExpenses]);

  // Determine widget state: savings (positive) or overspending (negative)
  const hasSavings = savings > 0;
  const hasOverspending = potentialSavings > 0;
  const hasLastMonthData = lastMonthExpenses > 0;

  // Filter active goals (not completed, not paused)
  const activeGoals = useMemo(() => {
    return goals.filter(
      (goal) => !goal.isCompleted && !goal.isPaused
    );
  }, [goals]);

  // Calculate distribution amounts based on priority and incomePercentage
  const calculateDistribution = (totalAmount: number) => {
    if (activeGoals.length === 0) return {};

    // Sort by priority: High -> Medium -> Low
    const sortedGoals = [...activeGoals].sort((a, b) => {
      const priorityOrder: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
      const aPriority = priorityOrder[a.priority as string] || 0;
      const bPriority = priorityOrder[b.priority as string] || 0;
      return bPriority - aPriority;
    });

    // Calculate total incomePercentage
    const totalIncomePercentage = sortedGoals.reduce(
      (sum, goal) => sum + (goal.incomePercentage || 0),
      0
    );

    const distribution: Record<string, number> = {};

    if (totalIncomePercentage > 0) {
      // Distribute proportionally based on incomePercentage
      sortedGoals.forEach((goal) => {
        const percentage = goal.incomePercentage || 0;
        const amount = (totalAmount * percentage) / totalIncomePercentage;
        distribution[goal.id] = Math.round(amount * 100) / 100; // Round to 2 decimals
      });
    } else {
      // Distribute equally if no incomePercentage
      const equalAmount = totalAmount / sortedGoals.length;
      sortedGoals.forEach((goal) => {
        distribution[goal.id] = Math.round(equalAmount * 100) / 100;
      });
    }

    // Adjust for rounding errors
    const totalDistributed = Object.values(distribution).reduce((sum, val) => sum + val, 0);
    const difference = totalAmount - totalDistributed;
    if (Math.abs(difference) > 0.01 && sortedGoals.length > 0) {
      // Add difference to first goal (highest priority)
      distribution[sortedGoals[0].id] = (distribution[sortedGoals[0].id] || 0) + difference;
    }

    return distribution;
  };

  const handleOpenDistributionDialog = () => {
    const distribution = calculateDistribution(savings);
    setDistributionAmounts(distribution);
    setIsDistributionDialogOpen(true);
  };

  const handleAmountChange = (goalId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setDistributionAmounts((prev) => ({
      ...prev,
      [goalId]: Math.max(0, amount),
    }));
  };

  const handleDistribute = async () => {
    const totalDistributed = Object.values(distributionAmounts).reduce((sum, val) => sum + val, 0);
    
    if (Math.abs(totalDistributed - savings) > 0.01) {
      toast({
        title: "Invalid Distribution",
        description: `Total distributed (${formatMoney(totalDistributed)}) must equal savings (${formatMoney(savings)})`,
        variant: "destructive",
      });
      return;
    }

    setIsDistributing(true);
    try {
      // Distribute to each goal
      const promises = Object.entries(distributionAmounts)
        .filter(([_, amount]) => amount > 0)
        .map(async ([goalId, amount]) => {
          const response = await fetch(`/api/v2/goals/${goalId}/top-up`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ amount }),
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to top up goal");
          }
          
          return await response.json();
        });

      await Promise.all(promises);

      toast({
        title: "Savings Distributed",
        description: `Successfully distributed ${formatMoney(savings)} to your goals.`,
        variant: "success",
      });

      setIsDistributionDialogOpen(false);
      setDistributionAmounts({});
      
      // Refresh the page to show updated goal balances
      router.refresh();
    } catch (error) {
      console.error("Error distributing savings:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to distribute savings",
        variant: "destructive",
      });
    } finally {
      setIsDistributing(false);
    }
  };

  // Always show widget - either savings or overspending (if we have last month data)
  // If no last month data, show neutral message
  if (!hasLastMonthData) {
    return (
      <Card className="w-full max-w-full">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <CardTitle className="text-lg font-semibold">
                Monthly Savings
              </CardTitle>
              <CardDescription className="text-sm">
                Compare your monthly expenses to see how much you save
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Not enough data from last month for comparison. Keep recording your transactions to see your savings!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-full">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <CardTitle className="text-lg font-semibold">
                {hasSavings ? "You Saved!" : "You Could Have Saved"}
              </CardTitle>
              <CardDescription className="text-sm">
                {hasSavings 
                  ? "You spent less this month compared to last month"
                  : `You spent ${formatMoney(potentialSavings)} more than last month`
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-2xl font-semibold",
              hasSavings 
                ? "text-sentiment-positive"
                : "text-sentiment-warning"
            )}>
              {formatMoney(hasSavings ? savings : potentialSavings)}
            </span>
            <span className="text-sm text-muted-foreground">
              {hasSavings ? "saved" : "more than last month"}
            </span>
          </div>

          {hasSavings ? (
            // Show distribution options when there are actual savings
            activeGoals.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Distribute this amount among your goals:
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activeGoals.slice(0, 3).map((goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{goal.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="default"
                            className={cn(
                              goal.priority === "High" && "bg-sentiment-negative",
                              goal.priority === "Medium" && "bg-sentiment-warning",
                              goal.priority === "Low" && "bg-interactive-primary"
                            )}
                          >
                            {goal.priority}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {goal.progressPct != null ? `${goal.progressPct.toFixed(1)}%` : '0%'} complete
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeGoals.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{activeGoals.length - 3} more goal{activeGoals.length - 3 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleOpenDistributionDialog}
                  className="w-full bg-sentiment-positive hover:bg-sentiment-positive dark:bg-sentiment-positive dark:hover:bg-sentiment-positive"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Distribute Automatically
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Create a goal to start saving intelligently!
                </p>
                <Button
                  onClick={() => router.push("/planning/goals")}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Goal
                </Button>
              </div>
            )
          ) : (
            // Show educational message when overspending
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                If you had spent the same as last month, you could have saved this amount and distributed it among your goals.
              </p>
              {activeGoals.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Your active goals:
                  </p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {activeGoals.slice(0, 2).map((goal) => (
                      <div
                        key={goal.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{goal.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="default"
                              className={cn(
                                goal.priority === "High" && "bg-sentiment-negative",
                                goal.priority === "Medium" && "bg-sentiment-warning",
                                goal.priority === "Low" && "bg-interactive-primary"
                              )}
                            >
                              {goal.priority}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {goal.progressPct != null ? `${goal.progressPct.toFixed(1)}%` : '0%'} complete
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => router.push("/planning/goals")}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Goal
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution Dialog */}
      <Dialog open={isDistributionDialogOpen} onOpenChange={setIsDistributionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Distribute Savings</DialogTitle>
            <DialogDescription>
              Adjust the amounts to distribute {formatMoney(savings)} among your goals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {activeGoals.map((goal) => {
              const amount = distributionAmounts[goal.id] || 0;
              const percentage = savings > 0 ? (amount / savings) * 100 : 0;

              return (
                <div key={goal.id} className="space-y-2 p-3 rounded-lg border border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{goal.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="default"
                          className={cn(
                            goal.priority === "High" && "bg-sentiment-negative",
                            goal.priority === "Medium" && "bg-sentiment-warning",
                            goal.priority === "Low" && "bg-interactive-primary"
                          )}
                        >
                          {goal.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {goal.progressPct != null ? `${goal.progressPct.toFixed(1)}%` : '0%'} complete
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={savings}
                        value={amount.toFixed(2)}
                        onChange={(e) => handleAmountChange(goal.id, e.target.value)}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Current balance</span>
                        <span className="font-medium">{formatMoney(goal.currentBalance)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">New balance</span>
                        <span className="font-medium text-sentiment-positive">
                          {formatMoney(goal.currentBalance + amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total to distribute:</span>
              <span
                className={cn(
                  "font-bold",
                  Math.abs(
                    Object.values(distributionAmounts).reduce((sum, val) => sum + val, 0) - savings
                  ) > 0.01
                    ? "text-sentiment-negative"
                    : "text-sentiment-positive"
                )}
              >
                {formatMoney(
                  Object.values(distributionAmounts).reduce((sum, val) => sum + val, 0)
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Available savings:</span>
              <span>{formatMoney(savings)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDistributionDialogOpen(false)}
              disabled={isDistributing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDistribute}
              disabled={
                isDistributing ||
                Math.abs(
                  Object.values(distributionAmounts).reduce((sum, val) => sum + val, 0) - savings
                ) > 0.01
              }
              className="bg-sentiment-positive hover:bg-sentiment-positive dark:bg-sentiment-positive dark:hover:bg-sentiment-positive"
            >
              {isDistributing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Distributing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Confirm Distribution
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

