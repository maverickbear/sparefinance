"use client";

import { useState, useEffect } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalForm } from "@/components/forms/goal-form";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, PiggyBank } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { formatMoney } from "@/components/common/money";
import { GoalTopUpDialog } from "@/components/goals/goal-top-up-dialog";
import { GoalWithdrawDialog } from "@/components/goals/goal-withdraw-dialog";
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
  isSystemGoal?: boolean;
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
  const { checkWriteAccess, canWrite } = useWriteGuard();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
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
      const res = await fetch(`/api/v2/goals`);
      if (!res.ok) {
        throw new Error("Failed to fetch goals");
      }
      const data = await res.json();
      setGoals(data || []);
      setHasLoaded(true);
      perf.markDataLoaded();
      
      // OPTIMIZATION: Check emergency fund goal in background, don't block render
      // This ensures the goal exists but doesn't slow down initial page load
      if (data && data.length > 0) {
        // Check if emergency fund exists
        const hasEmergencyFund = data.some((g: Goal) => g.isSystemGoal && g.name?.toLowerCase().includes('emergency'));
        
        if (!hasEmergencyFund) {
          // Create emergency fund in background
          fetch("/api/v2/goals/emergency-fund/calculate", {
            method: "POST",
          }).then((response) => {
            if (response.ok) {
              // Silently reload goals in background
              fetch(`/api/v2/goals`).then((res2) => {
                if (res2.ok) {
                  res2.json().then((data2) => {
                    setGoals(data2 || []);
                  });
                }
              });
            }
          }).catch((error) => {
            // Silently fail - emergency fund creation is not critical
            console.debug("Emergency fund creation failed (non-critical):", error);
          });
        }
      }
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
    <FeatureGuard 
      feature="hasGoals"
      headerTitle="Goals"
    >
      <div>
        <PageHeader
          title="Goals"
        >
        {sortedGoals.length > 0 && canWrite && (
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
              actionLabel={canWrite ? "Create Your First Goal" : undefined}
              onAction={canWrite ? () => {
                if (!checkWriteAccess()) return;
                setSelectedGoal(null);
                setIsFormOpen(true);
              } : undefined}
              actionIcon={canWrite ? Plus : undefined}
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
              throw new Error(error.error || "Failed to withdraw from goal");
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

      {/* Mobile Floating Action Button */}
      {canWrite && (
        <div className="fixed bottom-20 right-4 z-[60] lg:hidden">
          <Button
            size="medium"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => {
              if (!checkWriteAccess()) return;
              setSelectedGoal(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
      </div>
    </FeatureGuard>
  );
}

