"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import Link from "next/link";
import type { BasePlannedPayment as PlannedPayment } from "@/src/domain/planned-payments/planned-payments.types";

interface PlannedPaymentWidgetProps {
  upcomingTransactions: any[]; // Still accepts the old format for compatibility
}

export function PlannedPaymentWidget({
  upcomingTransactions,
}: PlannedPaymentWidgetProps) {
  // Sort transactions by date (earliest first) and get top 3 expenses
  const topUpcoming = useMemo(() => {
    const expenses = upcomingTransactions
      .filter((t) => t.type === "expense")
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 3);
    
    return expenses;
  }, [upcomingTransactions]);

  const getCategoryName = (transaction: any) => {
    return (
      transaction.subcategory?.name ||
      transaction.category?.name ||
      "Uncategorized"
    );
  };

  if (topUpcoming.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>What's coming up next</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No upcoming payments found
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>What's coming up next</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 pt-2 border-t border-border">
          {topUpcoming.map((transaction, index) => {
            const amount = Math.abs(transaction.amount || 0);
            const date = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
            const categoryName = getCategoryName(transaction);
            const dateLabel = format(date, "MMM dd");

            return (
              <div key={transaction.id || index} className="flex items-baseline justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {transaction.description || transaction.name || categoryName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dateLabel} • {categoryName}
                  </div>
                </div>
                <div className="text-sm font-semibold text-sentiment-negative tabular-nums flex-shrink-0">
                  -{formatMoney(amount)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <Link
            href="/planned-payment"
            className="text-xs text-content-link hover:underline cursor-pointer"
          >
            View all planned payments
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
