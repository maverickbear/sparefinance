"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoneyCompact } from "@/components/common/money";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { parseTransactionAmount } from "../utils/transaction-helpers";
import { ArrowUp, ArrowDown } from "lucide-react";

interface UpcomingBillsWidgetProps {
  upcomingTransactions: any[];
}

export function UpcomingBillsWidget({
  upcomingTransactions,
}: UpcomingBillsWidgetProps) {
  // Show both expenses and incomes
  const bills = upcomingTransactions.slice(0, 4);

  const getDaysUntilDue = (date: string | Date) => {
    const dueDate = typeof date === 'string' ? new Date(date) : date;
    const days = differenceInDays(dueDate, new Date());
    return days;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Upcoming Transactions</CardTitle>
        <CardDescription>Recurring transactions in the next 15 days</CardDescription>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No upcoming transactions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bills.map((transaction, index) => {
              const daysUntil = getDaysUntilDue(transaction.date || transaction.dueDate || new Date());
              const amount = parseTransactionAmount(transaction.amount);
              const isExpense = transaction.type === "expense";
              const isIncome = transaction.type === "income";

              return (
                <div
                  key={transaction.id || index}
                  className={cn(
                    "flex items-center justify-between gap-3"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-medium text-foreground">
                        {transaction.description || transaction.category?.name || "Transaction"}
                      </div>
                      {isExpense && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sentiment-negative/10 text-sentiment-negative">
                          Expense
                        </span>
                      )}
                      {isIncome && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sentiment-positive/10 text-sentiment-positive">
                          Income
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isExpense ? "Due" : "Expected"} in {daysUntil} {daysUntil === 1 ? "day" : "days"}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cn(
                      "flex items-center justify-end gap-1.5 text-base font-semibold tabular-nums",
                      isExpense ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                    )}>
                      {isExpense ? (
                        <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                      {formatMoneyCompact(Math.abs(amount))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

