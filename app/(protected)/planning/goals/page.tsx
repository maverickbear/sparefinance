"use client";

import { useState, useEffect } from "react";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalForm } from "@/components/forms/goal-form";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, PiggyBank } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/toast-provider";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

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
  createdAt: string;
  updatedAt: string;
  monthlyContribution?: number;
  monthsToGoal?: number | null;
  progressPct?: number;
  incomeBasis?: number;
}

export default function GoalsPage() {
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
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
          const { deleteGoalClient } = await import("@/lib/api/goals-client");
          await deleteGoalClient(id);

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

  async function submitTopUp() {
    if (!selectedGoal) return;

    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    const goalId = selectedGoal.id;
    const oldBalance = selectedGoal.currentBalance;
    
    setTopUpLoading(true);
    // Optimistic update: update UI immediately
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, currentBalance: g.currentBalance + amount } : g));

    try {
      const { topUpGoalClient } = await import("@/lib/api/goals-client");
      await topUpGoalClient(goalId, amount);

      toast({
        title: "Top-up added",
        description: `Successfully added ${formatMoney(amount)} to your goal.`,
        variant: "success",
      });

      setIsTopUpOpen(false);
      setTopUpAmount("");
      setSelectedGoal(null);
      loadGoals();
    } catch (error) {
      console.error("Error adding top-up:", error);
      // Revert optimistic update on error
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, currentBalance: oldBalance } : g));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add top-up",
        variant: "destructive",
      });
    } finally {
      setTopUpLoading(false);
    }
  }

  async function submitWithdraw() {
    if (!selectedGoal) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amount > selectedGoal.currentBalance) {
      toast({
        title: "Validation Error",
        description: "Withdrawal amount cannot exceed current balance",
        variant: "destructive",
      });
      return;
    }

    const goalId = selectedGoal.id;
    const oldBalance = selectedGoal.currentBalance;
    
    setWithdrawLoading(true);
    // Optimistic update: update UI immediately
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, currentBalance: g.currentBalance - amount } : g));

    try {
      const { withdrawFromGoalClient } = await import("@/lib/api/goals-client");
      await withdrawFromGoalClient(goalId, amount);

      toast({
        title: "Withdrawal successful",
        description: `Successfully withdrew ${formatMoney(amount)} from your goal.`,
        variant: "success",
      });

      setIsWithdrawOpen(false);
      setWithdrawAmount("");
      setSelectedGoal(null);
      loadGoals();
    } catch (error) {
      console.error("Error withdrawing:", error);
      // Revert optimistic update on error
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, currentBalance: oldBalance } : g));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to withdraw",
        variant: "destructive",
      });
    } finally {
      setWithdrawLoading(false);
    }
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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Goals</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Track your progress toward your financial goals
            </p>
          </div>
        </div>
        {!(sortedGoals.length === 0 && filterBy === "all") && (
          <Button
            onClick={() => {
              setSelectedGoal(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Goal
          </Button>
        )}
      </div>

      {goals.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-4 items-center">
            <Select value={filterBy} onValueChange={(value) => setFilterBy(value as typeof filterBy)}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Goals</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="eta">ETA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground">Total Allocation: </span>
            <span className={`font-semibold ${totalAllocation > 100 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
              {totalAllocation.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        {loading && !hasLoaded ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Loading goals...
          </div>
        ) : sortedGoals.length === 0 ? (
          <div className="col-span-full min-h-[400px]">
            <EmptyState
              icon={PiggyBank}
              title={filterBy === "all" ? "No goals created yet" : `No ${filterBy} goals found`}
              description={
                filterBy === "all"
                  ? "Create your first savings goal to start tracking your progress and achieve your financial dreams."
                  : `Try adjusting your filters to see ${filterBy === "active" ? "completed" : "active"} goals.`
              }
              actionLabel={filterBy === "all" ? "Create Your First Goal" : undefined}
              onAction={
                filterBy === "all"
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
          sortedGoals.map((goal) => (
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
          ))
        )}
      </div>

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

      <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Top-up</DialogTitle>
            <DialogDescription>
              Add money to {selectedGoal?.name || "this goal"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTopUpOpen(false)} disabled={topUpLoading}>
              Cancel
            </Button>
            <Button onClick={submitTopUp} disabled={topUpLoading}>
              {topUpLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Top-up"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw from Goal</DialogTitle>
            <DialogDescription>
              Withdraw money from {selectedGoal?.name || "this goal"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              {selectedGoal && (
                <p className="text-xs text-muted-foreground">
                  Current balance: {formatMoney(selectedGoal.currentBalance)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWithdrawOpen(false)} disabled={withdrawLoading}>
              Cancel
            </Button>
            <Button onClick={submitWithdraw} disabled={withdrawLoading}>
              {withdrawLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Withdrawing...
                </>
              ) : (
                "Withdraw"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}

