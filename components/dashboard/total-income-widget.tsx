"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { logger } from "@/src/infrastructure/utils/logger";

interface TotalIncomeWidgetProps {
  transactions: any[];
}

export function TotalIncomeWidget({ transactions }: TotalIncomeWidgetProps) {
  // Calculate total income from all income transactions
  // Note: transactions are already filtered by type="income" in the query, but we filter again for safety
  const incomeTransactions = transactions.filter((t) => t && t.type === "income");
  
  const totalIncome = incomeTransactions.reduce((sum, t) => {
    let amount = 0;
    if (t.amount != null) {
      const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
      amount = isNaN(parsed) ? 0 : parsed;
    }
    return sum + amount;
  }, 0);

  const incomeCount = incomeTransactions.length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Total Income
        </CardTitle>
        <CardDescription>
          Sum of all income transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total Amount */}
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-2xl font-semibold",
              totalIncome > 0 
                ? "text-green-600 dark:text-green-400" 
                : "text-muted-foreground"
            )}>
              {formatMoney(totalIncome)}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {incomeCount} {incomeCount === 1 ? 'transaction' : 'transactions'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

