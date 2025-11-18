"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowRight } from "lucide-react";

interface RecurringPayment {
  id: string;
  date: Date | string;
  type: "expense" | "income" | "transfer";
  amount: number;
  description?: string | null;
  account?: { id: string; name: string } | null;
  toAccount?: { id: string; name: string } | null;
  transferToId?: string | null;
  transferFromId?: string | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string; logo?: string | null } | null;
}

interface RecurringPaymentsWidgetProps {
  recurringPayments: RecurringPayment[];
}

export function RecurringPaymentsWidget({
  recurringPayments,
}: RecurringPaymentsWidgetProps) {
  // Sort by type first (expense, income, transfer), then by description
  const sortedPayments = useMemo(() => {
    return [...recurringPayments].sort((a, b) => {
      // First sort by type: expense, income, transfer
      const typeOrder = { expense: 0, income: 1, transfer: 2 };
      const typeDiff = (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
      if (typeDiff !== 0) return typeDiff;
      
      // Then sort by description
      const descA = a.description || a.subcategory?.name || a.category?.name || "";
      const descB = b.description || b.subcategory?.name || b.category?.name || "";
      return descA.localeCompare(descB);
    });
  }, [recurringPayments]);


  const getTypeColor = (type: string) => {
    switch (type) {
      case "expense":
        return "text-red-600 dark:text-red-400";
      case "income":
        return "text-green-600 dark:text-green-400";
      case "transfer":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "expense":
        return "Expense";
      case "income":
        return "Income";
      case "transfer":
        return "Transfer";
      default:
        return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "expense":
        return <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case "income":
        return <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "transfer":
        return <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      default:
        return null;
    }
  };

  const getCategoryName = (payment: RecurringPayment) => {
    return (
      payment.subcategory?.name ||
      payment.category?.name ||
      payment.description ||
      "No category"
    );
  };

  const getAccountName = (payment: RecurringPayment) => {
    return payment.account?.name || "Unspecified account";
  };

  const getToAccountName = (payment: RecurringPayment) => {
    // For transfers, check toAccount first, then try to infer from transferToId/transferFromId
    if (payment.toAccount?.name) {
      return payment.toAccount.name;
    }
    // If it's a transfer but we don't have toAccount info, show generic message
    if (payment.type === "transfer" && (payment.transferToId || payment.transferFromId)) {
      return "Destination account";
    }
    return "Unspecified account";
  };

  // Group by type
  const expenses = sortedPayments.filter((p) => p.type === "expense");
  const incomes = sortedPayments.filter((p) => p.type === "income");
  const transfers = sortedPayments.filter((p) => p.type === "transfer");

  if (sortedPayments.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>
            Recurring Payments
          </CardTitle>
          <CardDescription>Transactions that repeat automatically</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No recurring payments found
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              Recurring Payments
            </CardTitle>
            <CardDescription>
              {sortedPayments.length}{" "}
              {sortedPayments.length === 1
                ? "recurring transaction"
                : "recurring transactions"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {/* Expenses Section */}
          {expenses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Expenses ({expenses.length})
              </h3>
              <div className="space-y-2">
                {expenses.map((payment) => {
                  const amount = Math.abs(payment.amount || 0);
                  const date = payment.date instanceof Date ? payment.date : new Date(payment.date);

                  return (
                    <div
                      key={payment.id}
                      className={cn(
                        "flex items-start justify-between gap-3 p-3 rounded-lg border",
                        "bg-card hover:bg-accent/50 transition-colors"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-sm font-medium text-foreground truncate">
                            {getCategoryName(payment)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{getAccountName(payment)}</span>
                          {payment.description && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate">{payment.description}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Last occurrence: {format(date, "MM/dd/yyyy")}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-semibold tabular-nums text-red-600 dark:text-red-400">
                          -{formatMoney(amount)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {getTypeLabel(payment.type)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Incomes Section */}
          {incomes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Incomes ({incomes.length})
              </h3>
              <div className="space-y-2">
                {incomes.map((payment) => {
                  const amount = Math.abs(payment.amount || 0);
                  const date = payment.date instanceof Date ? payment.date : new Date(payment.date);

                  return (
                    <div
                      key={payment.id}
                      className={cn(
                        "flex items-start justify-between gap-3 p-3 rounded-lg border",
                        "bg-card hover:bg-accent/50 transition-colors"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-sm font-medium text-foreground truncate">
                            {getCategoryName(payment)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{getAccountName(payment)}</span>
                          {payment.description && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate">{payment.description}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Last occurrence: {format(date, "MM/dd/yyyy")}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-semibold tabular-nums text-green-600 dark:text-green-400">
                          +{formatMoney(amount)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {getTypeLabel(payment.type)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transfers Section */}
          {transfers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Transfers ({transfers.length})
              </h3>
              <div className="space-y-2">
                {transfers.map((payment) => {
                  const amount = Math.abs(payment.amount || 0);
                  const date = payment.date instanceof Date ? payment.date : new Date(payment.date);

                  return (
                    <div
                      key={payment.id}
                      className={cn(
                        "flex items-start justify-between gap-3 p-3 rounded-lg border",
                        "bg-card hover:bg-accent/50 transition-colors"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeIcon(payment.type)}
                          <div className="text-sm font-medium text-foreground truncate">
                            {payment.description || "Transfer"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">
                            {getAccountName(payment)} → {getToAccountName(payment)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Last occurrence: {format(date, "MM/dd/yyyy")}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                          {formatMoney(amount)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {getTypeLabel(payment.type)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

