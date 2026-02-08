"use client";

import { useState, useEffect } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalForm } from "@/components/forms/goal-form";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, PiggyBank, Edit, Trash2, ArrowUp, ArrowDown } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
          // List already updated optimistically; no refetch needed
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
    <div>
      <PageHeader title="Goals" />

      <div className="w-full p-4 lg:p-8">
        {/* Action Buttons */}
        {canWrite && (
          <div className="flex items-center gap-2 justify-end mb-6">
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
          </div>
        )}

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
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
                title="No goals created yet"
                description="Create your first savings goal to start tracking your progress and achieve your financial dreams."
              />
            </div>
          ) : (
            sortedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={(g) => {
                  if (!checkWriteAccess()) return;
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

        {/* Desktop Table View */}
        <div className="hidden lg:block rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs md:text-sm">Name</TableHead>
                <TableHead className="text-xs md:text-sm">Current Balance</TableHead>
                <TableHead className="text-xs md:text-sm">Target Amount</TableHead>
                <TableHead className="text-xs md:text-sm">Progress</TableHead>
                <TableHead className="text-xs md:text-sm">Priority</TableHead>
                <TableHead className="text-xs md:text-sm">Monthly Contribution</TableHead>
                <TableHead className="text-xs md:text-sm">ETA</TableHead>
                <TableHead className="text-xs md:text-sm">Status</TableHead>
                <TableHead className="text-xs md:text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !hasLoaded ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading goals...
                  </TableCell>
                </TableRow>
              ) : sortedGoals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No goals created yet
                  </TableCell>
                </TableRow>
              ) : (
                sortedGoals.map((goal) => {
                  const progressPct = goal.progressPct || 0;
                  const clampedProgress = Math.min(progressPct, 100);

                  return (
                    <TableRow key={goal.id} className={goal.isCompleted ? "opacity-75" : ""}>
                      <TableCell className="font-medium text-xs md:text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span>{goal.name}</span>
                          {goal.isSystemGoal && (
                            <Badge variant="outline" className="text-xs w-fit">
                              System Goal
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {formatMoney(goal.currentBalance)}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {formatMoney(goal.targetAmount)}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="relative flex-1 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full transition-all",
                                progressPct >= 100 ? "bg-sentiment-positive" : "bg-interactive-primary"
                              )}
                              style={{ width: `${clampedProgress}%` }}
                            />
                          </div>
                          <span className="text-xs whitespace-nowrap">
                            {progressPct.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="default"
                          className={cn(
                            "text-xs",
                            goal.priority === "High" && "bg-sentiment-negative text-white",
                            goal.priority === "Medium" && "bg-sentiment-warning text-white",
                            goal.priority === "Low" && "bg-interactive-primary text-white"
                          )}
                        >
                          {goal.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {goal.monthlyContribution && goal.monthlyContribution > 0
                          ? formatMoney(goal.monthlyContribution)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {goal.monthsToGoal !== null && goal.monthsToGoal !== undefined
                          ? `${Math.ceil(goal.monthsToGoal)} months`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {goal.isCompleted && (
                          <Badge variant="default" className="bg-sentiment-positive text-white text-xs">
                            Completed
                          </Badge>
                        )}
                        {!goal.isCompleted && (
                          <Badge variant="outline" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {canWrite && (
                          <div className="flex space-x-1 md:space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 md:h-10 md:w-10"
                              onClick={() => {
                                if (!checkWriteAccess()) return;
                                setSelectedGoal({ ...goal, createdAt: goal.createdAt, updatedAt: goal.updatedAt });
                                setIsFormOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 md:h-10 md:w-10"
                              onClick={() => {
                                if (!checkWriteAccess()) return;
                                handleTopUp(goal.id);
                              }}
                              disabled={goal.isCompleted}
                            >
                              <ArrowUp className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 md:h-10 md:w-10"
                              onClick={() => {
                                if (!checkWriteAccess()) return;
                                handleWithdraw(goal.id);
                              }}
                              disabled={goal.isCompleted || goal.currentBalance === 0}
                            >
                              <ArrowDown className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 md:h-10 md:w-10"
                              onClick={() => {
                                if (!checkWriteAccess()) return;
                                if (deletingId !== goal.id) {
                                  handleDelete(goal.id);
                                }
                              }}
                              disabled={deletingId === goal.id}
                            >
                              {deletingId === goal.id ? (
                                <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
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
  );
}

