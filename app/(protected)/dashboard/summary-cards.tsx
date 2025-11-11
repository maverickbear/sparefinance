"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { AccountsBreakdownModal } from "@/components/dashboard/accounts-breakdown-modal";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
  savings: number;
  totalBalance: number;
  lastMonthTotalBalance: number;
  accounts: any[];
}

export function SummaryCards({ 
  selectedMonthTransactions, 
  lastMonthTransactions, 
  savings,
  totalBalance,
  lastMonthTotalBalance,
  accounts,
}: SummaryCardsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Get today's date (without time)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper function to parse date from Supabase format
  // Supabase returns dates as "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    // Handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" formats
    const normalized = dateStr.replace(' ', 'T').split('.')[0]; // Remove milliseconds if present
    return new Date(normalized);
  };

  // Filter transactions to only include those with date <= today
  // Temporarily include ALL transactions from the selected month to debug
  const pastTransactions = selectedMonthTransactions.filter((t) => {
    if (!t.date) return false;
    // For now, include all transactions to see if date filtering is the issue
    // TODO: Re-enable date filtering once we confirm transactions are being returned
    return true;
    
    // Original date filtering code (commented out for debugging):
    // try {
    //   const txDate = parseTransactionDate(t.date);
    //   txDate.setHours(0, 0, 0, 0);
    //   return txDate <= today;
    // } catch (error) {
    //   console.error("Error parsing transaction date:", t.date, error);
    //   return true;
    // }
  });

  const pastLastMonthTransactions = lastMonthTransactions.filter((t) => {
    if (!t.date) return false;
    try {
      const txDate = parseTransactionDate(t.date);
      txDate.setHours(0, 0, 0, 0);
      return txDate <= today;
    } catch (error) {
      console.error("Error parsing transaction date:", t.date, error);
      return true; // Include if date parsing fails
    }
  });

  // Debug: Log transactions to understand the issue
  // IMPORTANT: Monthly Income should show transactions from the SELECTED MONTH (from MonthSelector)
  // selectedMonthTransactions already contains transactions from the selected month
  console.log("🔍 [summary-cards] Processing transactions for Monthly Income (SELECTED MONTH):", {
    note: "Monthly Income shows transactions from the month selected in MonthSelector at the top",
      totalTransactions: selectedMonthTransactions.length,
      pastTransactions: pastTransactions.length,
      today: today.toISOString(),
      allTransactionTypes: [...new Set(selectedMonthTransactions.map(t => t?.type).filter(Boolean))],
    incomeTransactions: pastTransactions.filter((t) => t && t.type === "income"),
    incomeTransactionsCount: pastTransactions.filter((t) => t && t.type === "income").length,
    expenseTransactionsCount: pastTransactions.filter((t) => t && t.type === "expense").length,
    incomeTransactionsDetails: pastTransactions
      .filter((t) => t && t.type === "income")
      .map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        amountType: typeof t.amount,
        parsedAmount: t.amount != null ? (typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount)) : null,
        date: t.date,
        description: t.description,
      })),
    sampleTransactions: selectedMonthTransactions.slice(0, 5).map(t => ({ 
        id: t?.id,
        type: t?.type, 
        amount: t?.amount, 
        amountType: typeof t?.amount,
        parsed: t?.amount != null ? (typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount)) : null,
        date: t?.date,
      })),
    });

  const currentIncome = pastTransactions
    .filter((t) => t && t.type === "income")
    .reduce((sum, t) => {
      // Handle various amount formats: number, string, null, undefined
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      const newSum = sum + amount;
      console.log("🔍 [summary-cards] Calculating income - transaction:", {
        id: t.id,
        type: t.type,
        amount: t.amount,
        parsedAmount: amount,
        currentSum: sum,
        newSum: newSum,
      });
      return newSum;
    }, 0);

  console.log("🔍 [summary-cards] Final Monthly Income calculation:", {
    currentIncome,
    incomeTransactionsCount: pastTransactions.filter((t) => t && t.type === "income").length,
    totalPastTransactions: pastTransactions.length,
  });

  const currentExpenses = pastTransactions
    .filter((t) => t && t.type === "expense")
    .reduce((sum, t) => {
      // Handle various amount formats: number, string, null, undefined
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  console.log("🔍 [summary-cards] Final Monthly Expenses calculation:", {
    currentExpenses,
    expenseTransactionsCount: pastTransactions.filter((t) => t && t.type === "expense").length,
  });

  const lastMonthIncome = pastLastMonthTransactions
    .filter((t) => t && t.type === "income")
    .reduce((sum, t) => {
      // Handle various amount formats: number, string, null, undefined
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  const lastMonthExpenses = pastLastMonthTransactions
    .filter((t) => t && t.type === "expense")
    .reduce((sum, t) => {
      // Handle various amount formats: number, string, null, undefined
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  const incomeMomChange = lastMonthIncome > 0
    ? ((currentIncome - lastMonthIncome) / lastMonthIncome) * 100
    : 0;

  const expensesMomChange = lastMonthExpenses > 0
    ? ((currentExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : 0;

  // Calculate balance change
  const balanceChange = totalBalance - lastMonthTotalBalance;
  const balanceChangePercent = lastMonthTotalBalance !== 0
    ? (balanceChange / Math.abs(lastMonthTotalBalance)) * 100
    : 0;

  return (
    <>
      <div className="grid gap-3 sm:gap-4 md:gap-5 grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            "hover:border-primary/50"
          )}
          onClick={() => setIsModalOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-500" />
              <div className={`text-lg md:text-xl font-semibold ${
                totalBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}>
                {formatMoney(totalBalance)}
              </div>
            </div>
            {balanceChange !== 0 && (
              <div className={`text-xs mt-1 ${
                balanceChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}>
                {balanceChange >= 0 ? "+" : ""}{formatMoney(balanceChange)} ({balanceChangePercent >= 0 ? "+" : ""}{balanceChangePercent.toFixed(1)}%)
              </div>
            )}
          </CardContent>
        </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">Monthly Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-500" />
            <div className="text-lg md:text-xl font-semibold text-foreground">{formatMoney(currentIncome)}</div>
          </div>
          <div className={`text-xs mt-1 ${
            lastMonthIncome > 0
              ? incomeMomChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
          }`}>
            {lastMonthIncome > 0
              ? `${incomeMomChange >= 0 ? "+" : ""}${incomeMomChange.toFixed(1)}% vs last month`
              : "No data last month"
            }
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">Monthly Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-500" />
            <div className="text-lg md:text-xl font-semibold text-foreground">{formatMoney(currentExpenses)}</div>
          </div>
          <div className={`text-xs mt-1 ${
            lastMonthExpenses > 0
              ? expensesMomChange >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              : "text-muted-foreground"
          }`}>
            {lastMonthExpenses > 0
              ? `${expensesMomChange >= 0 ? "+" : ""}${expensesMomChange.toFixed(1)}% vs last month`
              : "No data last month"
            }
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">Savings/Investments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg md:text-xl font-semibold text-foreground">{formatMoney(savings)}</div>
        </CardContent>
      </Card>
    </div>

    <AccountsBreakdownModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      accounts={accounts}
      totalBalance={totalBalance}
    />
    </>
  );
}

