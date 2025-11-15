import { IncomeExpensesChart } from "@/components/charts/income-expenses-chart";
import { FinancialHealthWidget } from "@/components/dashboard/financial-health-widget";
import { format } from "date-fns/format";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { eachMonthOfInterval } from "date-fns/eachMonthOfInterval";
import { subMonths } from "date-fns/subMonths";

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
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const expenses = monthTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      month: format(month, "MMM"),
      income,
      expenses,
    };
  });

  // Calculate last month's income and expenses
  const lastMonth = subMonths(selectedMonthDate, 1);
  const lastMonthStart = startOfMonth(lastMonth);
  const lastMonthEnd = endOfMonth(lastMonth);
  
  const lastMonthTransactions = chartTransactions.filter((t) => {
    const txDate = new Date(t.date);
    return txDate >= lastMonthStart && txDate <= lastMonthEnd;
  });

  const lastMonthIncome = lastMonthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const lastMonthExpenses = lastMonthTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  return (
    <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2 min-w-0">
      <IncomeExpensesChart data={monthlyData} />
      {financialHealth && (
        <FinancialHealthWidget 
          data={financialHealth}
          lastMonthIncome={lastMonthIncome}
          lastMonthExpenses={lastMonthExpenses}
        />
      )}
    </div>
  );
}

