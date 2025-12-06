"use client";

import { useMemo } from "react";
import { IncomeExpensesChart } from "@/components/charts/income-expenses-chart";
import { FinancialHealthWidget } from "@/components/dashboard/financial-health-widget";
import { format } from "date-fns/format";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { eachMonthOfInterval } from "date-fns/eachMonthOfInterval";
import { subMonths } from "date-fns/subMonths";
import { calculateTotalIncome, calculateTotalExpenses } from "@/lib/services/transaction-calculations";
import { TransactionWithRelations } from "@/src/domain/transactions/transactions.types";
import { FinancialHealthData } from "@/src/application/shared/financial-health";

interface CashFlowSectionProps {
  chartTransactions: TransactionWithRelations[];
  financialHealth: FinancialHealthData;
  selectedMonthDate: Date;
}

export function CashFlowSection({ 
  chartTransactions, 
  financialHealth,
  selectedMonthDate 
}: CashFlowSectionProps) {
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
  const pastChartTransactions = useMemo(() => {
    return chartTransactions.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [chartTransactions, today]);

  const sixMonthsAgo = new Date(selectedMonthDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const chartStart = startOfMonth(sixMonthsAgo);
  const chartEnd = endOfMonth(selectedMonthDate);

  const months = eachMonthOfInterval({ start: chartStart, end: chartEnd });
  const monthlyData = useMemo(() => {
    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthTransactions = pastChartTransactions.filter((t) => {
        const txDate = parseTransactionDate(t.date);
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
  }, [pastChartTransactions, months]);

  // Calculate last month's income and expenses
  const lastMonth = subMonths(selectedMonthDate, 1);
  const lastMonthStart = startOfMonth(lastMonth);
  const lastMonthEnd = endOfMonth(lastMonth);
  
  const lastMonthTransactions = useMemo(() => {
    return pastChartTransactions.filter((t) => {
      const txDate = parseTransactionDate(t.date);
      return txDate >= lastMonthStart && txDate <= lastMonthEnd;
    });
  }, [pastChartTransactions, lastMonthStart, lastMonthEnd]);

  // Use centralized calculation functions to ensure consistency
  const lastMonthIncome = useMemo(() => calculateTotalIncome(lastMonthTransactions), [lastMonthTransactions]);
  const lastMonthExpenses = useMemo(() => calculateTotalExpenses(lastMonthTransactions), [lastMonthTransactions]);

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

