"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DebtWithCalculations } from "@/src/domain/debts/debts.types";
import { format } from "date-fns";

interface DebtAnalysisSectionProps {
  debts: DebtWithCalculations[];
}

export function DebtAnalysisSection({ debts }: DebtAnalysisSectionProps) {
  if (debts.length === 0) {
    return null;
  }

  const activeDebts = debts.filter((d) => !d.isPaidOff && !d.isPaused);
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.currentBalance, 0);
  const totalPrincipalPaid = activeDebts.reduce((sum, d) => sum + d.principalPaid, 0);
  const totalInterestPaid = activeDebts.reduce((sum, d) => sum + d.interestPaid, 0);
  const totalInitialAmount = activeDebts.reduce((sum, d) => sum + d.initialAmount - d.downPayment, 0);
  const totalPaid = totalPrincipalPaid + totalInterestPaid;
  const overallProgress = totalInitialAmount > 0 ? (totalPaid / totalInitialAmount) * 100 : 0;

  const highPriorityDebts = activeDebts.filter((d) => d.priority === "High");
  const mediumPriorityDebts = activeDebts.filter((d) => d.priority === "Medium");
  const lowPriorityDebts = activeDebts.filter((d) => d.priority === "Low");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Debt Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Debt</p>
              <p className="text-2xl font-bold">{formatMoney(totalDebt)}</p>
              <p className="text-xs text-muted-foreground">
                {activeDebts.length} active debt{activeDebts.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Principal Paid</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatMoney(totalPrincipalPaid)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalInitialAmount > 0
                  ? `${((totalPrincipalPaid / totalInitialAmount) * 100).toFixed(1)}% of total`
                  : ""}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Interest Paid</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatMoney(totalInterestPaid)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalPaid > 0
                  ? `${((totalInterestPaid / totalPaid) * 100).toFixed(1)}% of payments`
                  : ""}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Overall Progress</p>
              <p className="text-2xl font-bold">{overallProgress.toFixed(1)}%</p>
              <Progress value={overallProgress} className="mt-2" />
            </div>
          </div>

          {/* Debt List by Priority */}
          <div className="space-y-4">
            {highPriorityDebts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  High Priority Debts
                </h3>
                <div className="space-y-2">
                  {highPriorityDebts.map((debt) => (
                    <DebtCard key={debt.id} debt={debt} />
                  ))}
                </div>
              </div>
            )}

            {mediumPriorityDebts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  Medium Priority Debts
                </h3>
                <div className="space-y-2">
                  {mediumPriorityDebts.map((debt) => (
                    <DebtCard key={debt.id} debt={debt} />
                  ))}
                </div>
              </div>
            )}

            {lowPriorityDebts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Low Priority Debts
                </h3>
                <div className="space-y-2">
                  {lowPriorityDebts.map((debt) => (
                    <DebtCard key={debt.id} debt={debt} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DebtCard({ debt }: { debt: DebtWithCalculations }) {
  const progress = debt.initialAmount - debt.downPayment > 0
    ? ((debt.principalPaid / (debt.initialAmount - debt.downPayment)) * 100)
    : 0;

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="font-semibold">{debt.name}</p>
          <p className="text-sm text-muted-foreground">{debt.loanType}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{formatMoney(debt.currentBalance)}</p>
          <p className="text-xs text-muted-foreground">remaining</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{progress.toFixed(1)}%</span>
        </div>
        <Progress value={progress} className="h-2" />

        <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
          <div>
            <p className="text-muted-foreground">
              {debt.loanType === "credit_card" 
                ? (debt.monthlyPayment > 0 ? "Minimum Payment" : "Payment")
                : "Monthly Payment"}
            </p>
            <p className="font-medium">
              {debt.loanType === "credit_card" && debt.monthlyPayment === 0
                ? "Flexible"
                : formatMoney(debt.monthlyPayment)}
            </p>
          </div>
          {debt.monthsRemaining !== null && (
            <div>
              <p className="text-muted-foreground">Months Remaining</p>
              <p className="font-medium">{debt.monthsRemaining}</p>
            </div>
          )}
        </div>

        {debt.interestRate > 0 && (
          <div className="pt-2 border-t text-xs text-muted-foreground">
            Interest Rate: {debt.interestRate.toFixed(2)}% | Interest Paid:{" "}
            {formatMoney(debt.interestPaid)}
          </div>
        )}
      </div>
    </div>
  );
}

