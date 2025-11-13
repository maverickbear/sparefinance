import { GoalsOverview } from "@/components/dashboard/goals-overview";
import { CategoryExpensesChart } from "@/components/charts/category-expenses-chart";
import { logger } from "@/lib/utils/logger";

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

  const currentIncome = selectedMonthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const expensesByCategory = selectedMonthTransactions
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

  const categoryExpensesData = Object.entries(expensesByCategory).map(
    ([name, data]) => {
      const typedData = data as { value: number; id: string | null };
      return { name, value: typedData.value, categoryId: typedData.id };
    }
  );

  return (
    <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2">
      <GoalsOverview goals={goals} />
      <CategoryExpensesChart 
        data={categoryExpensesData} 
        totalIncome={currentIncome} 
      />
    </div>
  );
}

