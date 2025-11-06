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

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
  incomePercentage: number;
  priority: "High" | "Medium" | "Low";
  description?: string | null;
  isPaused: boolean;
  isCompleted: boolean;
  expectedIncome?: number | null;
  targetMonths?: number | null;
}

interface GoalFormProps {
  goal?: Goal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function GoalForm({
  goal,
  open,
  onOpenChange,
  onSuccess,
}: GoalFormProps) {
  const { toast } = useToast();
  const [forecast, setForecast] = useState<{
    monthlyContribution: number;
    monthsToGoal: number | null;
    progressPct: number;
    incomeBasis: number;
    totalAllocation: number;
    allocationError?: string;
  } | null>(null);

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      targetAmount: 0,
      currentBalance: 0,
      incomePercentage: undefined,
      priority: "Medium",
      description: "",
      isPaused: false,
      expectedIncome: undefined,
      targetMonths: undefined,
    },
  });

  // Watch individual values instead of array to avoid unnecessary re-renders
  const targetAmount = form.watch("targetAmount");
  const currentBalance = form.watch("currentBalance");
  const incomePercentage = form.watch("incomePercentage");
  const priority = form.watch("priority");
  const isPaused = form.watch("isPaused");
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
        const effectiveIsPaused = isPaused || false;
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

         // Always calculate incomePercentage from targetMonths when targetMonths is provided
         let effectiveIncomePercentage = 0;
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
        const otherGoals = goals.filter((g: any) => g.id !== goal?.id && !g.isCompleted && !g.isPaused);
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
          isPaused: effectiveIsPaused,
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
  }, [targetAmount, currentBalance, incomePercentage, priority, isPaused, expectedIncome, targetMonths, open, goal, form]);

  // Load goal data when editing
  useEffect(() => {
    if (open && goal) {
      form.reset({
        name: goal.name || "",
        targetAmount: goal.targetAmount || 0,
        currentBalance: goal.currentBalance ?? 0,
        incomePercentage: goal.incomePercentage ?? undefined,
        priority: goal.priority || "Medium",
        description: goal.description || "",
        isPaused: goal.isPaused ?? false,
        expectedIncome: goal.expectedIncome ?? undefined,
        targetMonths: goal.targetMonths ?? undefined,
      });
    } else if (open && !goal) {
      form.reset({
        name: "",
        targetAmount: 0,
        currentBalance: 0,
        incomePercentage: undefined,
        priority: "Medium",
        description: "",
        isPaused: false,
        expectedIncome: undefined,
        targetMonths: undefined,
      });
    }
  }, [open, goal, form]);

  async function onSubmit(data: GoalFormData) {
    try {
      if (forecast?.allocationError) {
        toast({
          title: "Validation Error",
          description: forecast.allocationError,
          variant: "destructive",
        });
        return;
      }

      // Optimistic update: call onSuccess immediately
      if (onSuccess) {
        onSuccess();
      }
      onOpenChange(false);
      form.reset();

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
            isPaused: data.isPaused,
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
            isPaused: data.isPaused,
            expectedIncome: data.expectedIncome,
            targetMonths: data.targetMonths,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to create goal");
        }
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
      // Reload on error to revert optimistic update
      if (onSuccess) {
        onSuccess();
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">Goal Name *</label>
            <Input
              {...form.register("name")}
              placeholder="e.g., Emergency Fund, Down Payment"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Target Amount *</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register("targetAmount", { valueAsNumber: true })}
              />
              {form.formState.errors.targetAmount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.targetAmount.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Starting Balance *
              </label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register("currentBalance", { valueAsNumber: true })}
              />
              {form.formState.errors.currentBalance && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.currentBalance.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Target Months *</label>
            <Select
              value={form.watch("targetMonths") ? form.watch("targetMonths")!.toString() : undefined}
              onValueChange={(value) => {
                form.setValue("targetMonths", Number(value), { shouldValidate: true });
              }}
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
            <label className="text-sm font-medium">Priority *</label>
            <Select
              value={form.watch("priority")}
              onValueChange={(value) =>
                form.setValue("priority", value as "High" | "Medium" | "Low")
              }
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

          {forecast && (
            <div className="rounded-[12px] border bg-muted/50 p-4 space-y-3">
              <h4 className="text-sm font-semibold">Forecast</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Monthly Contribution</p>
                  <p className="font-semibold">
                    {formatMoney(forecast.monthlyContribution)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Progress</p>
                  <p className="font-semibold">
                    {forecast.progressPct.toFixed(1)}%
                  </p>
                </div>
              </div>
              {forecast.monthsToGoal !== null && (
                <div className="text-sm">
                  <p className="text-muted-foreground">ETA</p>
                  <p className="font-semibold">
                    {forecast.monthsToGoal === 0
                      ? "Goal reached!"
                      : forecast.monthsToGoal < 12
                      ? `${Math.round(forecast.monthsToGoal)} month${Math.round(forecast.monthsToGoal) !== 1 ? "s" : ""}`
                      : `${Math.floor(forecast.monthsToGoal / 12)} year${Math.floor(forecast.monthsToGoal / 12) !== 1 ? "s" : ""}, ${Math.round(forecast.monthsToGoal % 12)} month${Math.round(forecast.monthsToGoal % 12) !== 1 ? "s" : ""}`}
                  </p>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Based on income basis: {formatMoney(forecast.incomeBasis)}/month
              </div>
              <div className="text-xs text-muted-foreground">
                Total allocation: {forecast.totalAllocation.toFixed(2)}%
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!!forecast?.allocationError}>
              {goal ? "Update" : "Create"} Goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

