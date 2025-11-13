"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Wallet } from "lucide-react";
import { format } from "date-fns";
import { BudgetForm } from "@/components/forms/budget-form";
import { BudgetCard } from "@/components/budgets/budget-card";
import { useToast } from "@/components/toast-provider";
import { formatMoney } from "@/components/common/money";
import { EmptyState } from "@/components/common/empty-state";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { useWriteGuard } from "@/hooks/use-write-guard";

interface Budget {
  id: string;
  amount: number;
  note?: string | null;
  period: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  macroId?: string | null;
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
  macro?: {
    id: string;
    name: string;
  } | null;
  budgetCategories?: Array<{
    category: {
      id: string;
      name: string;
    };
  }>;
}

interface Macro {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  macroId: string;
  macro?: {
    id: string;
    name: string;
  };
}

export default function BudgetsPage() {
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const { checkWriteAccess } = useWriteGuard();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const now = new Date();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [
        { getBudgetsClient },
        { getAllCategoriesClient },
        { getMacrosClient },
      ] = await Promise.all([
        import("@/lib/api/budgets-client"),
        import("@/lib/api/categories-client"),
        import("@/lib/api/categories-client"),
      ]);
      const [budgetsData, categoriesData, macrosData] = await Promise.all([
        getBudgetsClient(now),
        getAllCategoriesClient(),
        getMacrosClient(),
      ]);
      setBudgets(budgetsData as Budget[]);
      setCategories(categoriesData as Category[]);
      setMacros(macrosData as Macro[]);
      setHasLoaded(true);
    } catch (error) {
      console.error("Error loading data:", error);
      setHasLoaded(true);
    } finally {
      setLoading(false);
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
          const { deleteBudgetClient } = await import("@/lib/api/budgets-client");
          await deleteBudgetClient(id);

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

  // Calculate summary statistics
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (b.actualSpend || 0), 0);
  const totalRemaining = totalBudget - totalSpent;
  const budgetsOnTrack = budgets.filter(b => b.status === "ok").length;
  const budgetsWarning = budgets.filter(b => b.status === "warning").length;
  const budgetsOver = budgets.filter(b => b.status === "over").length;
  const averageUsage = budgets.length > 0 
    ? budgets.reduce((sum, b) => sum + (b.percentage || 0), 0) / budgets.length 
    : 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Budgets"
        description={`Track your spending against budgets for ${format(now, "MMMM yyyy")}`}
      />

      {/* Summary Cards */}
      {!loading && hasLoaded && budgets.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">{formatMoney(totalBudget)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">{formatMoney(totalSpent)}</p>
                <p className="text-xs text-muted-foreground">
                  {totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}% of budget
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Remaining</p>
                <p className={`text-2xl font-bold ${totalRemaining < 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                  {formatMoney(totalRemaining)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm">{budgetsOnTrack}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="text-sm">{budgetsWarning}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-destructive" />
                    <span className="text-sm">{budgetsOver}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg usage: {averageUsage.toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budgets Grid */}
      {loading && !hasLoaded ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">Loading budgets...</div>
          </CardContent>
        </Card>
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No budgets yet"
          description="Create your first budget to start tracking your spending and stay on top of your finances."
          actionLabel="Create Your First Budget"
          onAction={() => {
            if (!checkWriteAccess()) return;
            setSelectedBudget(null);
            setIsFormOpen(true);
          }}
          actionIcon={Plus}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              All Budgets ({budgets.length})
            </h3>
            {budgets.length > 0 && (
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
            )}
          </div>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onEdit={(b) => {
                  if (!checkWriteAccess()) return;
                  setSelectedBudget(b);
                  setIsFormOpen(true);
                }}
                onDelete={(id) => {
                  if (!checkWriteAccess()) return;
                  if (deletingId !== id) {
                    handleDelete(id);
                  }
                }}
                deletingId={deletingId}
              />
            ))}
          </div>
        </div>
      )}

      <BudgetForm 
        macros={macros}
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
  );
}
