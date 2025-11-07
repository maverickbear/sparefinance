"use client";

import { useState, useEffect } from "react";
import { getBudgets } from "@/lib/api/budgets";
import { getAllCategories, getMacros } from "@/lib/api/categories";
import { BudgetProgress } from "@/components/budgets/budget-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { Plus, Edit, Trash2, Wallet } from "lucide-react";
import { format } from "date-fns";
import { BudgetForm } from "@/components/forms/budget-form";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/toast-provider";

interface Budget {
  id: string;
  amount: number;
  note?: string | null;
  period: string;
  categoryId?: string | null;
  macroId?: string | null;
  category: {
    id: string;
    name: string;
  };
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
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
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

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this budget?")) return;

    const budgetToDelete = budgets.find(b => b.id === id);
    
    // Optimistic update: remove from UI immediately
    setBudgets(prev => prev.filter(b => b.id !== id));

    try {
      const { deleteBudgetClient } = await import("@/lib/api/budgets-client");
      await deleteBudgetClient(id);

      toast({
        title: "Budget deleted",
        description: "Your budget has been deleted successfully.",
        variant: "success",
      });
      
      // Não precisa recarregar - a atualização otimista já removeu da lista
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
    }
  }

  // Show empty state when no budgets and has loaded (or not loading on first render)
  if ((hasLoaded || !loading) && budgets.length === 0) {
    return (
      <div>
        <EmptyState
          image={<Wallet className="w-full h-full text-muted-foreground opacity-50" />}
          title="No budgets found"
          description="Create a budget to track your spending and stay on top of your finances."
          action={{
            label: "Add Budget",
            onClick: () => {
              setSelectedBudget(null);
              setIsFormOpen(true);
            },
          }}
        />
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
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Budgets</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Track your spending against budgets for {format(now, "MMMM yyyy")}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setSelectedBudget(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Budget
        </Button>
      </div>

      {loading && budgets.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-32" />
                  <div className="flex items-center space-x-1">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
                <Skeleton className="h-3 w-24 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <Card key={budget.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {budget.displayName || budget.category.name}
                </CardTitle>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedBudget(budget);
                        setIsFormOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(budget.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {budget.budgetCategories && budget.budgetCategories.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {budget.budgetCategories.map(bc => bc.category.name).join(", ")}
                  </p>
                )}
                {budget.note && (
                  <p className="text-sm text-muted-foreground">{budget.note}</p>
                )}
              </CardHeader>
              <CardContent>
                <BudgetProgress
                  budget={budget.amount}
                  actual={budget.actualSpend || 0}
                  percentage={budget.percentage || 0}
                  status={budget.status || "ok"}
                />
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
}
