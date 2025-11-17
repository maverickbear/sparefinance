import { IncomeExpensesChart } from "@/components/charts/income-expenses-chart";
import { FinancialHealthWidget } from "@/components/dashboard/financial-health-widget";
import { format } from "date-fns/format";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { eachMonthOfInterval } from "date-fns/eachMonthOfInterval";
import { subMonths } from "date-fns/subMonths";
import { calculateTotalIncome, calculateTotalExpenses } from "@/lib/services/transaction-calculations";

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

    // Use centralized calculation functions to ensure consistency
    // These functions exclude transfers and validate transactions
    const income = calculateTotalIncome(monthTransactions);
    const expenses = calculateTotalExpenses(monthTransactions);

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

  // Use centralized calculation functions to ensure consistency
  const lastMonthIncome = calculateTotalIncome(lastMonthTransactions);
  const lastMonthExpenses = calculateTotalExpenses(lastMonthTransactions);

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

