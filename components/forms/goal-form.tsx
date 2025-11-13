"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { goalSchema, GoalFormData } from "@/lib/validations/goal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { formatMoney } from "@/components/common/money";
import { type Goal as GoalType } from "@/lib/api/goals";
import { calculateProgress, calculateIncomePercentageFromTargetMonths } from "@/lib/utils/goals";
import { useToast } from "@/components/toast-provider";
import { Loader2 } from "lucide-react";
import { DollarAmountInput } from "@/components/common/dollar-amount-input";
import { AccountRequiredDialog } from "@/components/common/account-required-dialog";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
  incomePercentage: number;
  priority: "High" | "Medium" | "Low";
  description?: string | null;
  isPaused?: boolean;
  isCompleted: boolean;
  expectedIncome?: number | null;
  targetMonths?: number | null;
}

interface GoalFormProps {
  goal?: Goal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
}

export function GoalForm({
  goal,
  open,
  onOpenChange,
  onSuccess,
}: GoalFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forecast, setForecast] = useState<{
    monthlyContribution: number;
    monthsToGoal: number | null;
    progressPct: number;
    incomeBasis: number;
    totalAllocation: number;
    allocationError?: string;
  } | null>(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [shouldShowForm, setShouldShowForm] = useState(false);

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      targetAmount: 0,
      currentBalance: 0,
      incomePercentage: undefined,
      priority: "Medium",
      description: "",
      expectedIncome: undefined,
      targetMonths: undefined,
    },
  });

  // Watch individual values instead of array to avoid unnecessary re-renders
  const targetAmount = form.watch("targetAmount");
  const currentBalance = form.watch("currentBalance");
  const incomePercentage = form.watch("incomePercentage");
  const priority = form.watch("priority");
  const expectedIncome = form.watch("expectedIncome");
  const targetMonths = form.watch("targetMonths");

  // Calculate forecast when values change
  useEffect(() => {
    // Don't calculate if dialog is closed
    if (!open) {
      return;
    }

    // Don't calculate if targetAmount is invalid
    if (!targetAmount || targetAmount <= 0) {
      setForecast(null);
      return;
    }

    // Debounce to avoid excessive API calls
    const timeoutId = setTimeout(async () => {
      try {
        const effectiveTargetAmount = targetAmount || 0;
        const effectiveCurrentBalance = currentBalance || 0;
        const baseIncomePercentage = incomePercentage !== undefined && incomePercentage !== null ? incomePercentage : undefined;
        const effectiveTargetMonths = targetMonths !== undefined && targetMonths !== null ? targetMonths : undefined;
        const effectiveExpectedIncome = expectedIncome || null;
        const effectivePriority = (priority || "Medium") as "High" | "Medium" | "Low";

        // Get income basis (using expectedIncome if provided, otherwise calculate from API)
        let incomeBasis = 0;
        if (effectiveExpectedIncome && effectiveExpectedIncome > 0) {
          incomeBasis = effectiveExpectedIncome;
        } else {
          // Fetch income basis from API
          const res = await fetch("/api/goals/income-basis");
          if (res.ok) {
            const data = await res.json();
            incomeBasis = data.incomeBasis || 0;
          }
        }

         // Calculate incomePercentage from targetMonths when targetMonths is provided
         // Otherwise use the incomePercentage from the form
         let effectiveIncomePercentage = baseIncomePercentage || 0;
         if (effectiveTargetMonths && effectiveTargetMonths > 0 && incomeBasis > 0) {
           effectiveIncomePercentage = calculateIncomePercentageFromTargetMonths(
             effectiveTargetAmount,
             effectiveCurrentBalance,
             effectiveTargetMonths,
             incomeBasis
           );
           // Update form value if calculated
           if (effectiveIncomePercentage > 0) {
             form.setValue("incomePercentage", effectiveIncomePercentage, { shouldValidate: false });
           }
         }

        // Check total allocation
        const res = await fetch("/api/goals");
        if (!res.ok) {
          throw new Error("Failed to fetch goals");
        }
        const goals = await res.json();
        const otherGoals = goals.filter((g: any) => g.id !== goal?.id && !g.isCompleted);
        const totalAllocation = otherGoals.reduce((sum: number, g: any) => sum + (g.incomePercentage || 0), 0) + effectiveIncomePercentage;

        let allocationError: string | undefined;
        if (totalAllocation > 100) {
          allocationError = `Total allocation cannot exceed 100%. Current total: ${totalAllocation.toFixed(2)}%`;
        }

        // Calculate progress
        const goalForCalculation: GoalType = {
          id: goal?.id || "",
          name: "",
          targetAmount: effectiveTargetAmount,
          currentBalance: effectiveCurrentBalance,
          incomePercentage: effectiveIncomePercentage,
          priority: effectivePriority,
          isPaused: goal?.isPaused ?? false,
          isCompleted: effectiveCurrentBalance >= effectiveTargetAmount,
          completedAt: null,
          description: null,
          expectedIncome: null,
          targetMonths: effectiveTargetMonths || null,
          createdAt: "",
          updatedAt: "",
        };
        const progress = calculateProgress(goalForCalculation, incomeBasis);

        setForecast({
          monthlyContribution: progress.monthlyContribution,
          monthsToGoal: progress.monthsToGoal,
          progressPct: progress.progressPct,
          incomeBasis,
          totalAllocation,
          allocationError,
        });
      } catch (error) {
        console.error("Error calculating forecast:", error);
        setForecast(null);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [targetAmount, currentBalance, incomePercentage, priority, expectedIncome, targetMonths, open, goal, form]);

  // Load goal data when editing
  useEffect(() => {
    if (open) {
      // If editing a goal, no need to check accounts
      if (goal) {
        setShouldShowForm(true);
        form.reset({
          name: goal.name || "",
          targetAmount: goal.targetAmount || 0,
          currentBalance: goal.currentBalance ?? 0,
          incomePercentage: goal.incomePercentage ?? undefined,
          priority: goal.priority || "Medium",
          description: goal.description || "",
          expectedIncome: goal.expectedIncome ?? undefined,
          targetMonths: goal.targetMonths ?? undefined,
        });
      } else {
        // If creating a new goal, check if there are accounts
        checkAccountsAndShowForm();
      }
    } else {
      setShouldShowForm(false);
      setShowAccountDialog(false);
    }
  }, [open, goal, form]);

  async function checkAccountsAndShowForm() {
    try {
      const accountsRes = await fetch("/api/accounts");
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json().catch(() => []);
        if (accountsData.length === 0) {
          // No accounts, show the dialog
          setShowAccountDialog(true);
          setShouldShowForm(false);
        } else {
          // Has accounts, can show the form
          setShouldShowForm(true);
          form.reset({
            name: "",
            targetAmount: 0,
            currentBalance: 0,
            incomePercentage: undefined,
            priority: "Medium",
            description: "",
            expectedIncome: undefined,
            targetMonths: undefined,
          });
        }
      } else {
        // Error fetching accounts, try to show the form anyway
        setShouldShowForm(true);
      }
    } catch (error) {
      console.error("Error checking accounts:", error);
      // In case of error, try to show the form anyway
      setShouldShowForm(true);
    }
  }

  async function onSubmit(data: GoalFormData) {
    try {
      setIsSubmitting(true);
      if (forecast?.allocationError) {
        toast({
          title: "Validation Error",
          description: forecast.allocationError,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (goal) {
        // Update existing goal
        const res = await fetch(`/api/goals/${goal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            targetAmount: data.targetAmount,
            currentBalance: data.currentBalance,
            incomePercentage: data.incomePercentage,
            priority: data.priority,
            description: data.description || "",
            expectedIncome: data.expectedIncome,
            targetMonths: data.targetMonths,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to update goal");
        }
      } else {
        // Create new goal
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            targetAmount: data.targetAmount,
            currentBalance: data.currentBalance,
            incomePercentage: data.incomePercentage,
            priority: data.priority,
            description: data.description || "",
            expectedIncome: data.expectedIncome,
            targetMonths: data.targetMonths,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to create goal");
        }
      }

      // Close modal and reset form
      onOpenChange(false);
      form.reset();

      // Call onSuccess after successful request to refresh the list
      // Await it to ensure the list is updated before showing the toast
      if (onSuccess) {
        await onSuccess();
      }

      toast({
        title: goal ? "Goal updated" : "Goal created",
        description: goal ? "Your goal has been updated successfully." : "Your goal has been created successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving goal:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save goal",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AccountRequiredDialog
        open={showAccountDialog}
        onOpenChange={(isOpen) => {
          setShowAccountDialog(isOpen);
          if (!isOpen) {
            onOpenChange(false);
          }
        }}
        onAccountCreated={() => {
          setShowAccountDialog(false);
          checkAccountsAndShowForm();
        }}
      />
      {shouldShowForm && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-3xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit" : "Create"} Goal</DialogTitle>
          <DialogDescription>
            {goal
              ? "Update your savings goal details"
              : "Create a new savings goal and set how much of your income to allocate"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
              <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Goal Name
            </label>
            <Input
              {...form.register("name")}
              placeholder="e.g., Emergency Fund, Down Payment"
              required
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Target Amount
              </label>
              <DollarAmountInput
                value={form.watch("targetAmount") || undefined}
                onChange={(value) => form.setValue("targetAmount", value ?? 0, { shouldValidate: true })}
                placeholder="$ 0.00"
                required
              />
              {form.formState.errors.targetAmount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.targetAmount.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Starting Balance
              </label>
              <DollarAmountInput
                value={form.watch("currentBalance") || undefined}
                onChange={(value) => form.setValue("currentBalance", value ?? 0, { shouldValidate: true })}
                placeholder="$ 0.00"
                required
              />
              {form.formState.errors.currentBalance && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.currentBalance.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Target Months
            </label>
            <Select
              value={form.watch("targetMonths") ? form.watch("targetMonths")!.toString() : undefined}
              onValueChange={(value) => {
                form.setValue("targetMonths", Number(value), { shouldValidate: true });
              }}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 months</SelectItem>
                <SelectItem value="6">6 months</SelectItem>
                <SelectItem value="12">12 months (1 year)</SelectItem>
                <SelectItem value="18">18 months</SelectItem>
                <SelectItem value="24">24 months (2 years)</SelectItem>
                <SelectItem value="36">36 months (3 years)</SelectItem>
                <SelectItem value="48">48 months (4 years)</SelectItem>
                <SelectItem value="60">60 months (5 years)</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.targetMonths && (
              <p className="text-xs text-destructive">
                {form.formState.errors.targetMonths.message}
              </p>
            )}
            {forecast?.allocationError && (
              <p className="text-xs text-destructive">
                {forecast.allocationError}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Priority
            </label>
            <Select
              value={form.watch("priority")}
              onValueChange={(value) =>
                form.setValue("priority", value as "High" | "Medium" | "Low")
              }
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.priority && (
              <p className="text-xs text-destructive">
                {form.formState.errors.priority.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              {...form.register("description")}
              placeholder="Add notes about this goal..."
              rows={3}
            />
          </div>

              </div>

              {/* Forecast Panel - Right Side */}
              <div className="lg:sticky lg:top-0 w-full lg:w-[280px]">
          {forecast ? (
            <div className="rounded-[12px] border bg-muted/50 p-6 space-y-3 h-fit">
              <h4 className="text-sm font-semibold">Goal Forecast</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Monthly savings amount</p>
                  <p className="text-base font-semibold">
                    {formatMoney(forecast.monthlyContribution)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Current progress</p>
                  <p className="text-base font-semibold">
                    {forecast.progressPct.toFixed(1)}%
                  </p>
                </div>
                {forecast.monthsToGoal !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Estimated time to reach goal</p>
                    <p className="text-base font-semibold">
                      {forecast.monthsToGoal === 0
                        ? "Goal reached! 🎉"
                        : forecast.monthsToGoal < 12
                        ? `${Math.round(forecast.monthsToGoal)} month${Math.round(forecast.monthsToGoal) !== 1 ? "s" : ""}`
                        : `${Math.floor(forecast.monthsToGoal / 12)} year${Math.floor(forecast.monthsToGoal / 12) !== 1 ? "s" : ""}, ${Math.round(forecast.monthsToGoal % 12)} month${Math.round(forecast.monthsToGoal % 12) !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                )}
                <div className="pt-2 border-t space-y-1.5">
                  <div className="text-xs text-muted-foreground leading-tight">
                    Based on your average monthly income: {formatMoney(forecast.incomeBasis)}
                  </div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    {forecast.totalAllocation.toFixed(2)}% of your income is allocated to this goal
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[12px] border bg-muted/50 p-6 space-y-3 h-fit">
              <h4 className="text-sm font-semibold">Goal Forecast</h4>
              <p className="text-xs text-muted-foreground">
                Enter goal details to see when you'll reach your target
              </p>
            </div>
          )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !!forecast?.allocationError}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {goal ? "Updating..." : "Creating..."}
                </>
              ) : (
                goal ? "Update" : "Create"
              )} Goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
      )}
    </>
  );
}

