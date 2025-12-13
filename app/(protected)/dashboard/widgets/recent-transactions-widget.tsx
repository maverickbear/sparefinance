"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { TransactionWithRelations } from "@/src/domain/transactions/transactions.types";

interface RecentTransactionsWidgetProps {
  transactions: TransactionWithRelations[];
}

export function RecentTransactionsWidget({
  transactions,
}: RecentTransactionsWidgetProps) {
  const router = useRouter();

  // Get most recent transactions (last 4-5)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB.getTime() - dateA.getTime(); // Most recent first
      })
      .slice(0, 5);
  }, [transactions]);

  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    if (!dateStr || typeof dateStr !== 'string') {
      return new Date();
    }
    try {
      const normalized = dateStr.replace(' ', 'T').split('.')[0];
      const date = new Date(normalized);
      if (isNaN(date.getTime())) {
        return new Date();
      }
      return date;
    } catch (error) {
      return new Date();
    }
  };

  if (recentTransactions.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Latest transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">No recent transactions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Latest transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentTransactions.map((transaction) => {
            const amount = Number(transaction.amount) || 0;
            const isIncome = transaction.type === "income";
            const absAmount = Math.abs(amount);
            const date = parseTransactionDate(transaction.date);
            const categoryName = transaction.category?.name || "Uncategorized";

            return (
              <div key={transaction.id} className="flex items-baseline justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {transaction.description || "Transaction"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {categoryName} • {format(date, "MMM dd")}
                  </div>
                </div>
                <div className={cn(
                  "text-sm font-semibold tabular-nums flex-shrink-0",
                  isIncome ? "text-sentiment-positive" : "text-sentiment-negative"
                )}>
                  {isIncome ? "+" : "-"}{formatMoney(absAmount)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={() => router.push("/transactions")}
            className="text-xs text-content-link hover:underline cursor-pointer"
          >
            View all transactions
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

