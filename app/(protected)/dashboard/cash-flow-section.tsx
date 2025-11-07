import { IncomeExpensesChart } from "@/components/charts/income-expenses-chart";
import { FinancialHealthWidget } from "@/components/dashboard/financial-health-widget";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";

interface CashFlowSectionProps {
  chartTransactions: any[];
  financialHealth: any;
  selectedMonthDate: Date;
}

export function CashFlowSection({ 
  chartTransactions, 
  financialHealth,
  selectedMonthDate 
}: CashFlowSectionProps) {
  const sixMonthsAgo = new Date(selectedMonthDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const chartStart = startOfMonth(sixMonthsAgo);
  const chartEnd = endOfMonth(selectedMonthDate);

  const months = eachMonthOfInterval({ start: chartStart, end: chartEnd });
  const monthlyData = months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const monthTransactions = chartTransactions.filter((t) => {
      const txDate = new Date(t.date);
      return txDate >= monthStart && txDate <= monthEnd;
    });

    const income = monthTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = monthTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      month: format(month, "MMM"),
      income,
      expenses,
    };
  });

  return (
    <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2">
      <IncomeExpensesChart data={monthlyData} />
      {financialHealth && (
        <FinancialHealthWidget data={financialHealth} />
      )}
    </div>
  );
}

