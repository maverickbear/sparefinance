import { UpcomingTransactions } from "@/components/dashboard/upcoming-transactions";
import { BudgetExecutionChart } from "@/components/charts/budget-execution-chart";
import { SavingsDistributionWidget } from "@/components/dashboard/savings-distribution-widget";
import { logger } from "@/lib/utils/logger";

interface TransactionsBudgetSectionProps {
  budgets: any[];
  upcomingTransactions: any[];
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
  goals: any[];
}

export function TransactionsBudgetSection({ 
  budgets, 
  upcomingTransactions,
  selectedMonthTransactions,
  lastMonthTransactions,
  goals,
}: TransactionsBudgetSectionProps) {
  const log = logger.withPrefix("TransactionsBudgetSection");
  
  log.log("Budgets received:", {
    budgetsCount: budgets?.length || 0,
    budgets: budgets?.slice(0, 3).map((b: any) => ({
      id: b.id,
      category: b.category?.name,
      amount: b.amount,
      percentage: b.percentage,
    })),
  });

  const budgetExecutionData = budgets
    .filter((b) => b.category)
    .map((b) => ({
      category: b.category?.name || "Unknown",
      percentage: b.percentage || 0,
    }));

  return (
    <div className="space-y-4 min-w-0">
      <UpcomingTransactions transactions={upcomingTransactions} />
      <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2 min-w-0">
        <BudgetExecutionChart data={budgetExecutionData} />
        <SavingsDistributionWidget
          selectedMonthTransactions={selectedMonthTransactions}
          lastMonthTransactions={lastMonthTransactions}
          goals={goals}
        />
      </div>
    </div>
  );
}

