import { GoalsOverview } from "@/components/dashboard/goals-overview";
import { CategoryExpensesChart } from "@/components/charts/category-expenses-chart";

interface ChartsSectionProps {
  selectedMonthTransactions: any[];
  goals: any[];
}

export function ChartsSection({ 
  selectedMonthTransactions, 
  goals 
}: ChartsSectionProps) {

  const currentIncome = selectedMonthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const expensesByCategory = selectedMonthTransactions
    .filter((t) => t.type === "expense" && t.category && t.category.name)
    .reduce((acc, t) => {
      const catName = t.category?.name || "Uncategorized";
      const catId = t.category?.id || null;
      if (!acc[catName]) {
        acc[catName] = { value: 0, id: catId };
      }
      acc[catName].value += t.amount;
      return acc;
    }, {} as Record<string, { value: number; id: string | null }>);

  const categoryExpensesData = Object.entries(expensesByCategory).map(
    ([name, data]) => {
      const typedData = data as { value: number; id: string | null };
      return { name, value: typedData.value, categoryId: typedData.id };
    }
  );

  return (
    <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2">
      <GoalsOverview goals={goals} />
      <CategoryExpensesChart 
        data={categoryExpensesData} 
        totalIncome={currentIncome} 
      />
    </div>
  );
}

