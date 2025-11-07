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

  // Filter transactions to only include those with date <= today
  const pastTransactions = selectedMonthTransactions.filter((t) => {
    const txDate = new Date(t.date);
    txDate.setHours(0, 0, 0, 0);
    return txDate <= today;
  });

  const pastLastMonthTransactions = lastMonthTransactions.filter((t) => {
    const txDate = new Date(t.date);
    txDate.setHours(0, 0, 0, 0);
    return txDate <= today;
  });

  const currentIncome = pastTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const currentExpenses = pastTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const lastMonthExpenses = pastLastMonthTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const momChange = lastMonthExpenses > 0
    ? ((currentExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : 0;

  // Calculate balance change
  const balanceChange = totalBalance - lastMonthTotalBalance;
  const balanceChangePercent = lastMonthTotalBalance !== 0
    ? (balanceChange / Math.abs(lastMonthTotalBalance)) * 100
    : 0;

  return (
    <>
      <div className="grid gap-6 md:gap-8 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            "hover:border-primary/50"
          )}
          onClick={() => setIsModalOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Total Balance</CardTitle>
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
          <CardTitle className="text-xs text-muted-foreground font-normal">Monthly Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-500" />
            <div className="text-lg md:text-xl font-semibold text-foreground">{formatMoney(currentIncome)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs text-muted-foreground font-normal">Monthly Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-500" />
            <div className="text-lg md:text-xl font-semibold text-foreground">{formatMoney(currentExpenses)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs text-muted-foreground font-normal">Savings/Investments</CardTitle>
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

