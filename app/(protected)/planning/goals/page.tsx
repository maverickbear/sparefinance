"use client";

import { useState, useEffect } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
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
import { PageHeader } from "@/components/common/page-header";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { FeatureGuard } from "@/components/common/feature-guard";

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
  const perf = usePagePerformance("Goals");
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const { checkWriteAccess } = useWriteGuard();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [sortBy, setSortBy] = useState<"progress" | "eta">("progress");
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
      perf.markDataLoaded();
    } catch (error) {
      console.error("Error loading goals:", error);
      setHasLoaded(true);
      perf.markDataLoaded();
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

  // Sort goals
  const sortedGoals = [...goals].sort((a, b) => {
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

  return (
    <FeatureGuard feature="hasGoals" featureName="Goals Tracking" requiredPlan="essential">
      <div>
        <PageHeader
          title="Goals"
        >
        {sortedGoals.length > 0 && (
          <Button
            size="medium"
            onClick={() => {
              if (!checkWriteAccess()) return;
              setSelectedGoal(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Goal
          </Button>
        )}
      </PageHeader>

      <div className="w-full p-4 lg:p-8">
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        {loading && !hasLoaded ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Loading goals...
          </div>
        ) : sortedGoals.length === 0 ? (
          <div className="col-span-full w-full h-full min-h-[400px]">
            <EmptyState
              icon={PiggyBank}
              title="No goals created yet"
              description="Create your first savings goal to start tracking your progress and achieve your financial dreams."
              actionLabel="Create Your First Goal"
              onAction={() => {
                if (!checkWriteAccess()) return;
                setSelectedGoal(null);
                setIsFormOpen(true);
              }}
              actionIcon={Plus}
            />
          </div>
        ) : (
          sortedGoals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onEdit={(g) => {
              if (!checkWriteAccess()) return;
              // Ensure the selected goal has createdAt and updatedAt properties
              setSelectedGoal({ ...g, createdAt: goal.createdAt, updatedAt: goal.updatedAt });
              setIsFormOpen(true);
            }}
            onDelete={(id) => {
              if (!checkWriteAccess()) return;
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
      </div>
    </FeatureGuard>
  );
}

