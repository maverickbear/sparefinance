"use client";

import { useState, useEffect } from "react";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalForm } from "@/components/forms/goal-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Loader2, PiggyBank } from "lucide-react";
import { formatMoney } from "@/components/common/money";
import { GoalTopUpDialog } from "@/components/goals/goal-top-up-dialog";
import { GoalWithdrawDialog } from "@/components/goals/goal-withdraw-dialog";
import { EmptyState } from "@/components/common/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/toast-provider";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useWriteGuard } from "@/hooks/use-write-guard";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
  incomePercentage: number;
  priority: "High" | "Medium" | "Low";
  isCompleted: boolean;
  completedAt?: string | null;
  description?: string | null;
  expectedIncome?: number | null;
  targetMonths?: number | null;
  isSystemGoal?: boolean;
  createdAt: string;
  updatedAt: string;
  monthlyContribution?: number;
  monthsToGoal?: number | null;
  progressPct?: number;
  incomeBasis?: number;
}

export function GoalsTab() {
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const { canWrite } = useWriteGuard();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [sortBy, setSortBy] = useState<"priority" | "progress" | "eta">("priority");
  const [filterBy, setFilterBy] = useState<"all" | "active" | "completed">("all");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      setLoading(true);
      // Add timestamp to bypass browser cache
      const res = await fetch(`/api/goals?t=${Date.now()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch goals");
      }
      const data = await res.json();
      console.log("Goals loaded:", data);
      setGoals(data || []);
      setHasLoaded(true);
    } catch (error) {
      console.error("Error loading goals:", error);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id: string) {
    openDialog(
      {
        title: "Delete Goal",
        description: "Are you sure you want to delete this goal?",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        const goalToDelete = goals.find(g => g.id === id);
        
        // Optimistic update: remove from UI immediately
        setGoals(prev => prev.filter(g => g.id !== id));
        setDeletingId(id);

        try {
          const response = await fetch(`/api/v2/goals/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete goal");
          }

          toast({
            title: "Goal deleted",
            description: "Your goal has been deleted successfully.",
            variant: "success",
          });
          
          loadGoals();
        } catch (error) {
          console.error("Error deleting goal:", error);
          // Revert optimistic update on error
          if (goalToDelete) {
            setGoals(prev => [...prev, goalToDelete]);
          }
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to delete goal",
            variant: "destructive",
          });
        } finally {
          setDeletingId(null);
        }
      }
    );
  }

  async function handleTopUp(id: string) {
    setSelectedGoal(goals.find((g) => g.id === id) || null);
    setIsTopUpOpen(true);
  }

  async function handleWithdraw(id: string) {
    setSelectedGoal(goals.find((g) => g.id === id) || null);
    setIsWithdrawOpen(true);
  }


  // Filter and sort goals
  const filteredGoals = goals.filter((goal) => {
    if (filterBy === "active") return !goal.isCompleted;
    if (filterBy === "completed") return goal.isCompleted;
    return true;
  });

  const sortedGoals = [...filteredGoals].sort((a, b) => {
    if (sortBy === "priority") {
      const priorityOrder = { High: 3, Medium: 2, Low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }
    if (sortBy === "progress") {
      return (b.progressPct || 0) - (a.progressPct || 0);
    }
    if (sortBy === "eta") {
      const aETA = a.monthsToGoal ?? Infinity;
      const bETA = b.monthsToGoal ?? Infinity;
      return aETA - bETA;
    }
    return 0;
  });

  // Calculate total allocation
  const activeGoals = goals.filter((g) => !g.isCompleted);
  const totalAllocation = activeGoals.reduce((sum, g) => sum + (g.incomePercentage || 0), 0);

  // Calculate summary statistics
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrent = goals.reduce((sum, g) => sum + g.currentBalance, 0);
  const totalProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
  const activeGoalsCount = activeGoals.length;
  const completedGoalsCount = goals.filter(g => g.isCompleted).length;
  const highPriorityGoals = activeGoals.filter(g => g.priority === "High").length;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold">Savings Goals</h2>
          <p className="text-sm text-muted-foreground">
            Track your progress toward your financial goals
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedGoal(null);
            setIsFormOpen(true);
          }}
          size="large"
          className="w-full md:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Goal
        </Button>
      </div>

      {/* Summary Cards */}
      {!loading && hasLoaded && goals.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Target</p>
                <p className="text-2xl font-bold">{formatMoney(totalTarget)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Saved</p>
                <p className="text-2xl font-bold">{formatMoney(totalCurrent)}</p>
                <p className="text-xs text-muted-foreground">
                  {totalProgress.toFixed(1)}% complete
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Active Goals</p>
                <p className="text-2xl font-bold">{activeGoalsCount}</p>
                <p className="text-xs text-muted-foreground">
                  {highPriorityGoals} high priority
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Allocation</p>
                <p className={`text-2xl font-bold ${totalAllocation > 100 ? "text-red-600 dark:text-red-400" : totalAllocation > 90 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
                  {totalAllocation.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {completedGoalsCount} completed
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Controls */}
      {!loading && hasLoaded && goals.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-muted/50 rounded-lg border">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={filterBy} onValueChange={(value) => setFilterBy(value as typeof filterBy)}>
              <SelectTrigger className="h-9 w-auto min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Goals</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="h-9 w-auto min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Sort by Priority</SelectItem>
                <SelectItem value="progress">Sort by Progress</SelectItem>
                <SelectItem value="eta">Sort by ETA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm font-medium">
            <span className="text-muted-foreground">Showing </span>
            <span className="text-foreground">{sortedGoals.length}</span>
            <span className="text-muted-foreground"> of {goals.length} goals</span>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      {loading && !hasLoaded ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">Loading goals...</div>
          </CardContent>
        </Card>
      ) : sortedGoals.length === 0 ? (
        <div className="w-full h-full min-h-[400px]">
        <EmptyState
          icon={PiggyBank}
          title={filterBy === "all" ? "No goals created yet" : `No ${filterBy} goals found`}
          description={
            filterBy === "all"
              ? "Create your first savings goal to start tracking your progress and achieve your financial dreams."
              : `Try adjusting your filters to see ${filterBy === "active" ? "completed" : "active"} goals.`
          }
          actionLabel={filterBy === "all" && canWrite ? "Create Your First Goal" : undefined}
          onAction={
            filterBy === "all" && canWrite
              ? () => {
                  setSelectedGoal(null);
                  setIsFormOpen(true);
                }
              : undefined
          }
          actionIcon={filterBy === "all" ? Plus : undefined}
        />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {filterBy === "all" ? "All Goals" : filterBy === "active" ? "Active Goals" : "Completed Goals"} ({sortedGoals.length})
            </h3>
          </div>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {sortedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={(g) => {
                  // Ensure the selected goal has createdAt and updatedAt properties
                  setSelectedGoal({ ...g, createdAt: goal.createdAt, updatedAt: goal.updatedAt });
                  setIsFormOpen(true);
                }}
                onDelete={(id) => {
                  if (deletingId !== id) {
                    handleDelete(id);
                  }
                }}
                onTopUp={handleTopUp}
                onWithdraw={handleWithdraw}
              />
            ))}
          </div>
        </div>
      )}

      <GoalForm
        goal={selectedGoal || undefined}
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setSelectedGoal(null);
          }
        }}
        onSuccess={async () => {
          await loadGoals();
          setSelectedGoal(null);
        }}
      />

      <GoalTopUpDialog
        open={isTopUpOpen}
        onOpenChange={setIsTopUpOpen}
        goal={selectedGoal}
        onConfirm={async (amount) => {
          if (!selectedGoal) return;
          const goalId = selectedGoal.id;
          const oldBalance = selectedGoal.currentBalance;
          
          setTopUpLoading(true);
          setGoals(prev => prev.map(g => g.id === goalId ? { ...g, currentBalance: g.currentBalance + amount } : g));

          try {
            const response = await fetch(`/api/v2/goals/${goalId}/top-up`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ amount }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || "Failed to add top-up");
            }

            toast({
              title: "Top-up added",
              description: `Successfully added ${formatMoney(amount)} to your goal.`,
              variant: "success",
            });

            setIsTopUpOpen(false);
            setSelectedGoal(null);
            loadGoals();
          } catch (error) {
            console.error("Error adding top-up:", error);
            setGoals(prev => prev.map(g => g.id === goalId ? { ...g, currentBalance: oldBalance } : g));
            toast({
              title: "Error",
              description: error instanceof Error ? error.message : "Failed to add top-up",
              variant: "destructive",
            });
          } finally {
            setTopUpLoading(false);
          }
        }}
        loading={topUpLoading}
      />

      <GoalWithdrawDialog
        open={isWithdrawOpen}
        onOpenChange={setIsWithdrawOpen}
        goal={selectedGoal}
        onConfirm={async (amount) => {
          if (!selectedGoal) return;
          const goalId = selectedGoal.id;
          const oldBalance = selectedGoal.currentBalance;
          
          setWithdrawLoading(true);
          setGoals(prev => prev.map(g => g.id === goalId ? { ...g, currentBalance: g.currentBalance - amount } : g));

          try {
            const response = await fetch(`/api/v2/goals/${goalId}/withdraw`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ amount }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || "Failed to withdraw");
            }

            toast({
              title: "Withdrawal successful",
              description: `Successfully withdrew ${formatMoney(amount)} from your goal.`,
              variant: "success",
            });

            setIsWithdrawOpen(false);
            setSelectedGoal(null);
            loadGoals();
          } catch (error) {
            console.error("Error withdrawing:", error);
            setGoals(prev => prev.map(g => g.id === goalId ? { ...g, currentBalance: oldBalance } : g));
            toast({
              title: "Error",
              description: error instanceof Error ? error.message : "Failed to withdraw",
              variant: "destructive",
            });
          } finally {
            setWithdrawLoading(false);
          }
        }}
        loading={withdrawLoading}
      />
      {ConfirmDialog}
    </div>
  );
}

