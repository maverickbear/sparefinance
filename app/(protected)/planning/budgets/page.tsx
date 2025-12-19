"use client";

import { useState, useEffect, useRef } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Wallet, Edit, Trash2, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { BudgetForm } from "@/components/forms/budget-form";
import { BudgetMobileCard } from "@/components/budgets/budget-mobile-card";
import { BudgetRuleSelector } from "@/src/presentation/components/features/budgets/budget-rule-selector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BudgetRuleProfile } from "@/src/domain/budgets/budget-rules.types";
import { useToast } from "@/components/toast-provider";
import { formatMoney } from "@/components/common/money";
import { EmptyState } from "@/components/common/empty-state";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { FeatureGuard } from "@/components/common/feature-guard";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  calculateBudgetStatus,
  getBudgetStatusColor,
  getBudgetStatusTextColor,
  getBudgetStatusLabel,
} from "@/lib/utils/budget-utils";

interface Budget {
  id: string;
  amount: number;
  note?: string | null;
  period: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  category: {
    id: string;
    name: string;
  } | null;
  subcategory?: {
    id: string;
    name: string;
  } | null;
  actualSpend?: number;
  percentage?: number;
  status?: "ok" | "warning" | "over";
  displayName?: string;
  budgetCategories?: Array<{
    category: {
      id: string;
      name: string;
    };
  }>;
}

interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  subcategories?: Array<{
    id: string;
    name: string;
  }>;
}

export default function BudgetsPage() {
  const perf = usePagePerformance("Budgets");
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const { checkWriteAccess, canWrite } = useWriteGuard();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedBudgetIds, setSelectedBudgetIds] = useState<Set<string>>(new Set());
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<BudgetRuleProfile | null>(null);
  const [applyingRule, setApplyingRule] = useState(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const now = new Date();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      // OPTIMIZED: Single API call to get budgets and categories using v2 API routes
      const periodParam = now.toISOString();
      const [budgetsResponse, categoriesResponse] = await Promise.all([
        fetch(`/api/v2/budgets?period=${periodParam}`),
        fetch("/api/v2/categories?all=true"),
      ]);
      
      if (!budgetsResponse.ok || !categoriesResponse.ok) {
        throw new Error("Failed to fetch data");
      }
      
      const [budgetsData, categoriesData] = await Promise.all([
        budgetsResponse.json(),
        categoriesResponse.json(),
      ]);
      
      // Filter only expense categories for budgets
      const expenseCategories = (categoriesData || []).filter(
        (cat: Category) => cat.type === "expense"
      );
      
      setBudgets(budgetsData as Budget[]);
      setCategories(expenseCategories);
      setHasLoaded(true);
      perf.markDataLoaded();
    } catch (error) {
      console.error("Error loading data:", error);
      setHasLoaded(true);
      perf.markDataLoaded();
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyRule(rule: BudgetRuleProfile) {
    if (!checkWriteAccess()) return;
    
    try {
      setApplyingRule(true);
      
      const response = await fetch("/api/v2/budgets/rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ruleType: rule.id,
          period: now.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to apply budget rule");
      }

      toast({
        title: "Budget rule applied",
        description: `Budgets have been updated based on the ${rule.name} rule.`,
        variant: "success",
      });

      setIsRuleDialogOpen(false);
      setSelectedRule(null);
      await loadData(); // Reload budgets
    } catch (error) {
      console.error("Error applying budget rule:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to apply budget rule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApplyingRule(false);
    }
  }

  function handleDelete(id: string) {
    if (!checkWriteAccess()) return;
    openDialog(
      {
        title: "Delete Budget",
        description: "Are you sure you want to delete this budget?",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        const budgetToDelete = budgets.find(b => b.id === id);
        
        // Optimistic update: remove from UI immediately
        setBudgets(prev => prev.filter(b => b.id !== id));
        setDeletingId(id);

        try {
          const response = await fetch(`/api/v2/budgets/${id}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete budget");
          }

          toast({
            title: "Budget deleted",
            description: "Your budget has been deleted successfully.",
            variant: "success",
          });
        } catch (error) {
          console.error("Error deleting budget:", error);
          // Revert optimistic update on error
          if (budgetToDelete) {
            setBudgets(prev => [...prev, budgetToDelete]);
          }
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to delete budget",
            variant: "destructive",
          });
        } finally {
          setDeletingId(null);
        }
      }
    );
  }

  function handleDeleteSelected() {
    if (!checkWriteAccess()) return;
    if (selectedBudgetIds.size === 0) return;

    const count = selectedBudgetIds.size;
    openDialog(
      {
        title: "Delete Selected Budgets",
        description: `Are you sure you want to delete ${count} budget${count > 1 ? 's' : ''}? This action cannot be undone.`,
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        const budgetsToDelete = budgets.filter(b => selectedBudgetIds.has(b.id));
        const idsToDelete = Array.from(selectedBudgetIds);
        
        // Optimistic update: remove from UI immediately
        setBudgets(prev => prev.filter(b => !selectedBudgetIds.has(b.id)));
        setSelectedBudgetIds(new Set());
        setDeletingId(idsToDelete[0] || null);

        try {
          // Delete all selected budgets in parallel
          const deletePromises = idsToDelete.map(id =>
            fetch(`/api/v2/budgets/${id}`, { method: "DELETE" })
          );
          
          const responses = await Promise.all(deletePromises);
          const errors = responses.filter(r => !r.ok);
          
          if (errors.length > 0) {
            throw new Error(`Failed to delete ${errors.length} budget${errors.length > 1 ? 's' : ''}`);
          }

          toast({
            title: "Budgets deleted",
            description: `Successfully deleted ${count} budget${count > 1 ? 's' : ''}.`,
            variant: "success",
          });
        } catch (error) {
          console.error("Error deleting budgets:", error);
          // Revert optimistic update on error
          setBudgets(prev => [...prev, ...budgetsToDelete]);
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to delete budgets",
            variant: "destructive",
          });
        } finally {
          setDeletingId(null);
        }
      }
    );
  }

  function handleSelectBudget(id: string, checked: boolean) {
    setSelectedBudgetIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedBudgetIds(new Set(budgets.map((b) => b.id)));
    } else {
      setSelectedBudgetIds(new Set());
    }
  }

  const allSelected = budgets.length > 0 && selectedBudgetIds.size === budgets.length;
  const someSelected = selectedBudgetIds.size > 0 && selectedBudgetIds.size < budgets.length;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  // SIMPLIFIED: Calculate status in frontend for all budgets
  const budgetsWithStatus = budgets.map(budget => {
    const actualSpend = budget.actualSpend || 0;
    const { percentage, status } = calculateBudgetStatus(budget.amount, actualSpend);
    return { ...budget, percentage, status };
  });

  // Calculate summary statistics using calculated status
  const totalBudget = budgetsWithStatus.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgetsWithStatus.reduce((sum, b) => sum + (b.actualSpend || 0), 0);
  const totalRemaining = totalBudget - totalSpent;
  const budgetsOnTrack = budgetsWithStatus.filter(b => b.status === "ok").length;
  const budgetsWarning = budgetsWithStatus.filter(b => b.status === "warning").length;
  const budgetsOver = budgetsWithStatus.filter(b => b.status === "over").length;
  const averageUsage = budgetsWithStatus.length > 0 
    ? budgetsWithStatus.reduce((sum, b) => sum + (b.percentage || 0), 0) / budgetsWithStatus.length 
    : 0;

  return (
    <FeatureGuard 
      feature="hasBudgets"
      headerTitle="Budgets"
    >
    <div>
      <PageHeader
        title="Budgets"
      />

      <div className="w-full p-4 lg:p-8">
        {/* Action Buttons - Moved from header */}
        {canWrite && (
          <div className="flex items-center gap-2 justify-end mb-6">
            {allSelected && (
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={deletingId !== null}
              >
                {deletingId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete Selected
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (!checkWriteAccess()) return;
                setIsRuleDialogOpen(true);
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Apply Budget Rule
            </Button>
            <Button
              onClick={() => {
                if (!checkWriteAccess()) return;
                setSelectedBudget(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Budget
            </Button>
          </div>
        )}
        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {allSelected && canWrite && (
            <div className="sticky top-0 z-10 bg-background pb-2">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDeleteSelected}
                disabled={deletingId !== null}
              >
                {deletingId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete Selected ({selectedBudgetIds.size})
              </Button>
            </div>
          )}
          {loading && !hasLoaded ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-muted-foreground">Loading budgets...</div>
              </CardContent>
            </Card>
          ) : budgets.length === 0 ? (
            <div className="w-full h-full min-h-[400px]">
              <EmptyState
                icon={Wallet}
                title="No budgets yet"
                description="Create your first budget to start tracking your spending and stay on top of your finances."
              />
            </div>
          ) : (
            budgets.map((budget) => (
              <BudgetMobileCard
                key={budget.id}
                budget={budget}
                isSelected={selectedBudgetIds.has(budget.id)}
                onSelect={(checked) => handleSelectBudget(budget.id, checked)}
                onEdit={() => {
                  if (!checkWriteAccess()) return;
                  setSelectedBudget(budget);
                  setIsFormOpen(true);
                }}
                onDelete={() => {
                  if (!checkWriteAccess()) return;
                  if (deletingId !== budget.id) {
                    handleDelete(budget.id);
                  }
                }}
                deleting={deletingId === budget.id}
              />
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    ref={selectAllCheckboxRef}
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    className="h-4 w-4"
                  />
                </TableHead>
                <TableHead className="text-xs md:text-sm">Category</TableHead>
                <TableHead className="text-xs md:text-sm">Budget</TableHead>
                <TableHead className="text-xs md:text-sm">Spent</TableHead>
                <TableHead className="text-xs md:text-sm">Remaining</TableHead>
                <TableHead className="text-xs md:text-sm">Progress</TableHead>
                <TableHead className="text-xs md:text-sm">Status</TableHead>
                <TableHead className="text-xs md:text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !hasLoaded ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading budgets...
                  </TableCell>
                </TableRow>
              ) : budgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No budgets found
                  </TableCell>
                </TableRow>
              ) : (
                budgetsWithStatus.map((budget) => {
                  const percentage = budget.percentage || 0;
                  const clampedPercentage = Math.min(percentage, 100);
                  const actualSpend = budget.actualSpend || 0;
                  const remaining = Math.max(0, budget.amount - actualSpend);
                  const status = budget.status || "ok";

                  return (
                    <TableRow key={budget.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedBudgetIds.has(budget.id)}
                          onCheckedChange={(checked) => handleSelectBudget(budget.id, checked as boolean)}
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-xs md:text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span>{budget.displayName || budget.category?.name || "Unknown"}</span>
                          {budget.subcategory && (
                            <span className="text-xs text-muted-foreground">
                              {budget.subcategory.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {formatMoney(budget.amount)}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {formatMoney(actualSpend)}
                      </TableCell>
                      <TableCell className={cn("text-xs md:text-sm font-medium", getBudgetStatusTextColor(status))}>
                        {formatMoney(remaining)}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="relative flex-1 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full transition-all",
                                getBudgetStatusColor(status)
                              )}
                              style={{ width: `${clampedPercentage}%` }}
                            />
                            {percentage > 100 && (
                              <div
                                className={cn(
                                  "absolute top-0 h-full transition-all opacity-30",
                                  getBudgetStatusColor(status)
                                )}
                                style={{
                                  width: `${((percentage - 100) / percentage) * 100}%`,
                                  left: "100%",
                                }}
                              />
                            )}
                            <div className="absolute top-0 left-0 h-full w-[1px] bg-border" style={{ left: "100%" }} />
                          </div>
                          <span className={cn("text-xs whitespace-nowrap", getBudgetStatusTextColor(status))}>
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(getBudgetStatusColor(status), "text-white text-xs")} variant="default">
                          {getBudgetStatusLabel(status)}
                        </Badge>
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
                                setSelectedBudget(budget);
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
                                if (deletingId !== budget.id) {
                                  handleDelete(budget.id);
                                }
                              }}
                              disabled={deletingId === budget.id}
                            >
                              {deletingId === budget.id ? (
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

      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply Budget Rule</DialogTitle>
            <DialogDescription>
              Select a budget rule to automatically generate or update your budgets for the current month.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <BudgetRuleSelector
              selectedRule={selectedRule?.id}
              onSelect={(rule) => setSelectedRule(rule)}
              showCancel
              onCancel={() => setIsRuleDialogOpen(false)}
              loading={applyingRule}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRuleDialogOpen(false)}
              disabled={applyingRule}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedRule && handleApplyRule(selectedRule)}
              disabled={applyingRule || !selectedRule}
            >
              {applyingRule ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                "Apply Rule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BudgetForm 
        categories={categories} 
        period={now}
        budget={selectedBudget || undefined}
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setSelectedBudget(null);
          }
        }}
        onSuccess={async () => {
          setSelectedBudget(null);
          // Small delay to ensure database is updated
          await new Promise(resolve => setTimeout(resolve, 100));
          loadData();
        }}
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
              setSelectedBudget(null);
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
