"use client";

import { useState, useEffect } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
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
import { FeatureGuard } from "@/components/common/feature-guard";

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
  const perf = usePagePerformance("Budgets");
  const { toast } = useToast();
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const { checkWriteAccess, canWrite } = useWriteGuard();
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
      // OPTIMIZED: Single API call to get both groups and categories using v2 API routes
      const periodParam = now.toISOString();
      const [budgetsResponse, categoriesResponse] = await Promise.all([
        fetch(`/api/v2/budgets?period=${periodParam}`),
        fetch("/api/v2/categories?consolidated=true"),
      ]);
      
      if (!budgetsResponse.ok || !categoriesResponse.ok) {
        throw new Error("Failed to fetch data");
      }
      
      const [budgetsData, categoriesData] = await Promise.all([
        budgetsResponse.json(),
        categoriesResponse.json(),
      ]);
      
      const { groups: macrosData, categories: categoriesList } = categoriesData;
      
      setBudgets(budgetsData as Budget[]);
      setCategories(categoriesList || []);
      setMacros(macrosData || []);
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
    <FeatureGuard 
      feature="hasBudgets"
      headerTitle="Budgets"
    >
    <div>
      <PageHeader
        title="Budgets"
      >
        {canWrite && (
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
      </PageHeader>

      <div className="w-full p-4 lg:p-8">
        {/* Budgets Grid */}
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
          actionLabel={canWrite ? "Create Your First Budget" : undefined}
          onAction={canWrite ? () => {
            if (!checkWriteAccess()) return;
            setSelectedBudget(null);
            setIsFormOpen(true);
          } : undefined}
          actionIcon={canWrite ? Plus : undefined}
        />
        </div>
      ) : (
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

      {/* Mobile Floating Action Button */}
      {canWrite && (
        <div className="fixed bottom-20 right-4 z-[60] lg:hidden">
          <Button
            size="large"
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
