"use client";

import { useMemo } from "react";
import { GoalsOverview } from "@/components/dashboard/goals-overview";
import { CategoryExpensesChart } from "@/components/charts/category-expenses-chart";
import { logger } from "@/src/infrastructure/utils/logger";

interface ChartsSectionProps {
  selectedMonthTransactions: any[];
  goals: any[];
}

export function ChartsSection({ 
  selectedMonthTransactions, 
  goals 
}: ChartsSectionProps) {
  const log = logger.withPrefix("ChartsSection");
  
  log.log("Goals received:", {
    goalsCount: goals?.length || 0,
    goals: goals?.slice(0, 3).map((g: any) => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
    })),
  });

  // Helper function to parse date from Supabase format
  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    // Handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" formats
    const normalized = dateStr.replace(' ', 'T').split('.')[0]; // Remove milliseconds if present
    return new Date(normalized);
  };

  // Get today's date (without time) to filter out future transactions
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // Filter transactions to only include those with date <= today
  // Exclude future transactions as they haven't happened yet
  const pastSelectedMonthTransactions = useMemo(() => {
    return selectedMonthTransactions.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [selectedMonthTransactions, today]);

  const currentIncome = useMemo(() => {
    return pastSelectedMonthTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [pastSelectedMonthTransactions]);

  const expensesByCategory = useMemo(() => {
    return pastSelectedMonthTransactions
      .filter((t) => t.type === "expense" && t.category && t.category.name)
      .reduce((acc, t) => {
        const catName = t.category?.name || "Uncategorized";
        const catId = t.category?.id || null;
        if (!acc[catName]) {
          acc[catName] = { value: 0, id: catId };
        }
        acc[catName].value += (Number(t.amount) || 0);
        return acc;
      }, {} as Record<string, { value: number; id: string | null }>);
  }, [pastSelectedMonthTransactions]);

  const categoryExpensesData = Object.entries(expensesByCategory).map(
    ([name, data]) => {
      const typedData = data as { value: number; id: string | null };
      return { name, value: typedData.value, categoryId: typedData.id };
    }
  );

  return (
    <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2 min-w-0">
      <GoalsOverview goals={goals} />
      <CategoryExpensesChart 
        data={categoryExpensesData} 
        totalIncome={currentIncome} 
      />
    </div>
  );
}

