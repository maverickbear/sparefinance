"use client";

import { useState, useEffect } from "react";
import { usePagePerformance } from "@/hooks/use-page-performance";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Loader2, Plus, Trash2 } from "lucide-react";
import { CategoryBudgetSlider } from "@/src/presentation/components/features/budgets/category-budget-slider";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/toast-provider";

interface Budget {
  id: string;
  amount: number;
  period: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
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
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [processingCategoryId, setProcessingCategoryId] = useState<string | null>(null);
  const now = new Date();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
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
      
      // Sync selectedCategoryIds with budgets in database
      // Only show categories that have budgets in the current period
      const budgetsWithCategories = (budgetsData as Budget[])
        .filter((b) => b.categoryId && !b.subcategoryId)
        .map((b) => b.categoryId!);
      
      // Get unique category IDs from budgets
      const categoryIdsFromBudgets = [...new Set(budgetsWithCategories)];
      
      // Update selectedCategoryIds to match budgets in database
      // This ensures we only show categories that actually have budgets
      setSelectedCategoryIds(categoryIdsFromBudgets);
      
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

  function handleOpenDialog() {
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
  }

  async function handleCreateBudget(categoryId: string) {
    setProcessingCategoryId(categoryId);
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    try {
      const response = await fetch("/api/v2/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: periodStart.toISOString(),
          categoryId: categoryId,
          amount: 0,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to create budget" }));
        throw new Error(errorData.error || "Failed to create budget");
      }
      
      // Recarregar dados para refletir mudanças
      await loadData();
      
      toast({
        title: "Success",
        description: "Budget created successfully",
      });
    } catch (error) {
      console.error("Error creating budget:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create budget",
        variant: "destructive",
      });
    } finally {
      setProcessingCategoryId(null);
    }
  }

  async function handleDeleteBudget(categoryId: string) {
    setProcessingCategoryId(categoryId);
    
    const budgetToDelete = budgets.find(
      (b) => b.categoryId === categoryId && !b.subcategoryId
    );
    
    if (!budgetToDelete?.id) {
      setProcessingCategoryId(null);
      return;
    }
    
    // Optimistic update: remove from UI immediately
    const previousBudgets = budgets;
    setBudgets((prev) => prev.filter((b) => b.id !== budgetToDelete.id));
    setSelectedCategoryIds((prev) => prev.filter((id) => id !== categoryId));
    
    try {
      const response = await fetch(`/api/v2/budgets/${budgetToDelete.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to delete budget" }));
        throw new Error(errorData.error || "Failed to delete budget");
      }
      
      // Recarregar dados para garantir sincronização com o banco
      await loadData();
      
      toast({
        title: "Success",
        description: "Budget deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting budget:", error);
      // Revert optimistic update on error
      setBudgets(previousBudgets);
      setSelectedCategoryIds((prev) => {
        if (!prev.includes(categoryId)) {
          return [...prev, categoryId];
        }
        return prev;
      });
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete budget",
        variant: "destructive",
      });
    } finally {
      setProcessingCategoryId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Budgets" />

      <div className="w-full p-4 lg:p-8">
        {/* Action Buttons */}
        <div className="flex items-center gap-2 justify-end mb-6">
          <Button
            size="medium"
            onClick={handleOpenDialog}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Budget
          </Button>
        </div>

        {loading && !hasLoaded ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-muted-foreground">Loading categories...</div>
            </CardContent>
          </Card>
        ) : categories.length === 0 ? (
          <div className="w-full h-full min-h-[400px]">
            <EmptyState
              icon={Wallet}
              title="No categories found"
              description="Categories will appear here once they are created."
            />
          </div>
        ) : selectedCategoryIds.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-muted-foreground mb-4">
                No categories selected for budgets
              </div>
              <Button onClick={handleOpenDialog} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Budget
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {categories
              .filter((category) => selectedCategoryIds.includes(category.id))
              .map((category) => {
                const categoryBudget = budgets.find(
                  (b) => b.categoryId === category.id && !b.subcategoryId
                );
                const subcategoryBudgets = budgets.filter(
                  (b) => b.categoryId === category.id && b.subcategoryId !== null
                );
                return (
                  <CategoryBudgetSlider
                    key={`${category.id}-${categoryBudget?.id || 'no-budget'}`}
                    category={category}
                    budget={categoryBudget || null}
                    subcategoryBudgets={subcategoryBudgets}
                    period={now}
                    onBudgetChange={loadData}
                    maxAmount={10000}
                    step={50}
                  />
                );
              })}
          </div>
        )}
      </div>

      {/* Manage Budget Categories - lateral drawer */}
      <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent side="right" className="sm:max-w-[600px] w-full p-0 flex flex-col gap-0 overflow-hidden bg-background border-l">
          <SheetHeader className="p-6 pb-4 border-b shrink-0">
            <SheetTitle className="text-xl">Manage Budget Categories</SheetTitle>
            <SheetDescription>
              Create or delete budgets for categories. Changes are saved immediately.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6">
              {categories.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No categories available
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {categories.map((category) => {
                    const hasBudget = budgets.some(
                      (b) => b.categoryId === category.id && !b.subcategoryId
                    );
                    const isProcessing = processingCategoryId === category.id;

                    return (
                      <div
                        key={category.id}
                        className="flex flex-col items-center justify-center gap-2 p-3 rounded-md border hover:bg-muted/50 aspect-square"
                      >
                        <span className="text-sm font-medium text-center line-clamp-2">
                          {category.name}
                        </span>
                        <Button
                          size="icon"
                          variant={hasBudget ? "destructive" : "outline"}
                          className="shrink-0 h-8 w-8"
                          onClick={() => {
                            if (hasBudget) {
                              handleDeleteBudget(category.id);
                            } else {
                              handleCreateBudget(category.id);
                            }
                          }}
                          disabled={isProcessing}
                          aria-label={hasBudget ? "Delete budget" : "Create budget"}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : hasBudget ? (
                            <Trash2 className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t flex justify-end shrink-0 bg-background">
            <Button variant="outline" onClick={handleCloseDialog}>
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
