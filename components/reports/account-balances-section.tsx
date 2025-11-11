"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/lib/api/accounts-client";
import type { Transaction } from "@/lib/api/transactions-client";
import { startOfMonth, eachMonthOfInterval, format } from "date-fns";

interface AccountBalancesSectionProps {
  accounts: Account[];
  historicalTransactions: Transaction[];
  now: Date;
}

export function AccountBalancesSection({
  accounts,
  historicalTransactions,
  now,
}: AccountBalancesSectionProps) {
  if (accounts.length === 0) {
    return null;
  }

  // Filter to checking and savings accounts only
  const relevantAccounts = accounts.filter(
    (acc) => acc.type === "checking" || acc.type === "savings"
  );

  if (relevantAccounts.length === 0) {
    return null;
  }

  // Calculate total balance
  const totalBalance = relevantAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  // Calculate balance evolution over last 6 months
  const months = eachMonthOfInterval({
    start: startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
    end: startOfMonth(now),
  });

  const monthlyBalances = months.map((month) => {
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    const transactionsUpToMonth = historicalTransactions.filter(
      (tx) => new Date(tx.date) <= monthEnd
    );

    const balances = new Map<string, number>();
    relevantAccounts.forEach((acc) => {
      balances.set(acc.id, acc.initialBalance || 0);
    });

    transactionsUpToMonth.forEach((tx) => {
      if (!tx.accountId) return;
      const currentBalance = balances.get(tx.accountId) || 0;
      if (tx.type === "income") {
        balances.set(tx.accountId, currentBalance + (Number(tx.amount) || 0));
      } else if (tx.type === "expense") {
        balances.set(tx.accountId, currentBalance - (Number(tx.amount) || 0));
      }
    });

    const monthTotal = Array.from(balances.values()).reduce((sum, bal) => sum + bal, 0);
    return {
      month: format(month, "MMM yyyy"),
      balance: monthTotal,
    };
  });

  const previousBalance = monthlyBalances.length > 1
    ? monthlyBalances[monthlyBalances.length - 2].balance
    : totalBalance;
  const balanceChange = totalBalance - previousBalance;
  const balanceChangePercent = previousBalance > 0
    ? (balanceChange / previousBalance) * 100
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Balances
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <p className="text-2xl font-bold">{formatMoney(totalBalance)}</p>
              <p className="text-xs text-muted-foreground">
                {relevantAccounts.length} account{relevantAccounts.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Balance Change</p>
              <p
                className={cn(
                  "text-2xl font-bold flex items-center gap-2",
                  balanceChange >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {balanceChange >= 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
                {formatMoney(balanceChange)}
              </p>
              <p
                className={cn(
                  "text-sm",
                  balanceChangePercent >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {balanceChangePercent >= 0 ? "+" : ""}
                {balanceChangePercent.toFixed(1)}% vs last month
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Average Balance</p>
              <p className="text-2xl font-bold">
                {formatMoney(totalBalance / relevantAccounts.length)}
              </p>
              <p className="text-xs text-muted-foreground">per account</p>
            </div>
          </div>

          {/* Account List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Account Details</h3>
            {relevantAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex-1">
                  <p className="font-semibold">{account.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{account.type}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatMoney(account.balance || 0)}</p>
                  {account.initialBalance !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Initial: {formatMoney(account.initialBalance)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

