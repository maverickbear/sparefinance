"use client";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProgressRing } from "../goals/progress-ring";
import { formatMoney } from "@/components/common/money";
import {
  MoreVertical,
  Edit,
  Trash2,
  Pause,
  Play,
  DollarSign,
} from "lucide-react";

export interface DebtCardProps {
  debt: {
    id: string;
    name: string;
    loanType: string;
    initialAmount: number;
    downPayment: number;
    currentBalance: number;
    interestRate: number;
    totalMonths: number | null;
    firstPaymentDate: string;
    startDate?: string | null;
    monthlyPayment: number;
    paymentFrequency?: string;
    paymentAmount?: number | null;
    principalPaid: number;
    interestPaid: number;
    additionalContributions: boolean;
    additionalContributionAmount?: number | null;
    priority: "High" | "Medium" | "Low";
    description?: string | null;
    accountId?: string | null;
    isPaidOff: boolean;
    isPaused: boolean;
    monthsRemaining?: number | null;
    totalInterestRemaining?: number;
    progressPct?: number;
  };
  onEdit: (debt: DebtCardProps["debt"]) => void;
  onDelete: (id: string) => void;
  onPause: (id: string, isPaused: boolean) => void;
  onPayment: (id: string) => void;
}

const loanTypeLabels: Record<string, string> = {
  mortgage: "Mortgage",
  car_loan: "Car Loan",
  personal_loan: "Personal Loan",
  credit_card: "Credit Card",
  student_loan: "Student Loan",
  business_loan: "Business Loan",
  other: "Other",
};

const paymentFrequencyLabels: Record<string, string> = {
  monthly: "Monthly",
  biweekly: "Biweekly",
  weekly: "Weekly",
  semimonthly: "Semimonthly",
  daily: "Daily",
};

export function DebtCard({
  debt,
  onEdit,
  onDelete,
  onPause,
  onPayment,
}: DebtCardProps) {
  const loanTypeLabel = loanTypeLabels[debt.loanType] || debt.loanType;

  // Calculate payments left based on payment frequency
  const calculatePaymentsLeft = (): number | null => {
    if (debt.monthsRemaining === null || debt.monthsRemaining === undefined || debt.monthsRemaining === 0) {
      return null;
    }

    const frequency = debt.paymentFrequency || "monthly";
    const months = debt.monthsRemaining;

    switch (frequency) {
      case "monthly":
        return Math.ceil(months);
      case "biweekly":
        // ~26 payments per year = ~2.17 payments per month
        return Math.ceil(months * 2.17);
      case "weekly":
        // ~52 payments per year = ~4.33 payments per month
        return Math.ceil(months * 4.33);
      case "semimonthly":
        // 24 payments per year = 2 payments per month
        return Math.ceil(months * 2);
      case "daily":
        // ~365 payments per year = ~30.42 payments per month
        return Math.ceil(months * 30.42);
      default:
        return Math.ceil(months);
    }
  };

  const paymentsLeft = calculatePaymentsLeft();

  // Calculate months remaining based on startDate + totalMonths
  const calculateMonthsRemaining = (): number | null => {
    if (!debt.startDate || !debt.totalMonths || debt.totalMonths <= 0) {
      return null;
    }

    try {
      const startDate = new Date(debt.startDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + debt.totalMonths);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      if (endDate <= today) {
        return 0; // Already past end date
      }

      // Calculate difference in months
      const yearsDiff = endDate.getFullYear() - today.getFullYear();
      const monthsDiff = endDate.getMonth() - today.getMonth();
      const daysDiff = endDate.getDate() - today.getDate();
      
      let totalMonthsRemaining = yearsDiff * 12 + monthsDiff;
      
      // If the day of month has passed, we're in the next month
      if (daysDiff < 0) {
        totalMonthsRemaining -= 1;
      }
      
      return Math.max(0, totalMonthsRemaining);
    } catch (error) {
      console.error("Error calculating months remaining:", error);
      return null;
    }
  };

  const monthsRemaining = calculateMonthsRemaining();
  const showMonthsRemaining = monthsRemaining !== null;

  return (
    <Card className={debt.isPaidOff ? "opacity-75" : ""}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Header with Progress Ring and Title */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <ProgressRing
                  percentage={debt.progressPct || 0}
                  size={60}
                  strokeWidth={6}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <CardTitle className="text-base font-semibold truncate">{debt.name}</CardTitle>
                  {debt.isPaidOff && (
                    <Badge variant="default" className="bg-green-600 dark:bg-green-500 text-white text-xs">
                      Paid Off
                    </Badge>
                  )}
                  {debt.isPaused && (
                    <Badge variant="outline" className="border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400 text-xs">
                      Paused
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{loanTypeLabel}</Badge>
                  <span className="text-xs text-muted-foreground">{debt.interestRate.toFixed(2)}%</span>
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(debt)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {!debt.isPaidOff && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onPause(debt.id, !debt.isPaused)}
                    >
                      {debt.isPaused ? (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPayment(debt.id)}>
                      <DollarSign className="mr-2 h-4 w-4" />
                      Record Payment
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => onDelete(debt.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Main Metrics */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Current Balance</p>
              <p className="font-semibold text-base">{formatMoney(debt.currentBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                {debt.paymentFrequency && debt.paymentFrequency !== "monthly"
                  ? `${paymentFrequencyLabels[debt.paymentFrequency] || debt.paymentFrequency} Payment`
                  : "Monthly Payment"}
              </p>
              <p className="font-semibold text-base">
                {debt.paymentAmount && debt.paymentAmount > 0
                  ? formatMoney(debt.paymentAmount)
                  : formatMoney(debt.monthlyPayment)}
              </p>
              {debt.paymentFrequency && debt.paymentFrequency !== "monthly" && debt.paymentAmount && (
                <p className="text-xs text-muted-foreground">
                  {formatMoney(debt.monthlyPayment)}/mo
                </p>
              )}
            </div>
            {showMonthsRemaining && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Months Remaining</p>
                <p className="font-semibold">
                  {monthsRemaining === 0
                    ? "Paid off!"
                    : monthsRemaining < 12
                    ? `${monthsRemaining} months`
                    : `${Math.floor(monthsRemaining / 12)} years ${monthsRemaining % 12} months`}
                </p>
              </div>
            )}
            {paymentsLeft !== null && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Payments Left</p>
                <p className="font-semibold">{paymentsLeft}</p>
              </div>
            )}
          </div>

          {/* Additional Info */}
          <div className="pt-3 border-t grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Principal Paid</p>
              <p className="font-medium">{formatMoney(debt.principalPaid)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Interest Paid</p>
              <p className="font-medium">{formatMoney(debt.interestPaid)}</p>
            </div>
            {debt.totalInterestRemaining !== undefined && (
              <div>
                <p className="text-muted-foreground">Interest Remaining</p>
                <p className="font-medium">{formatMoney(debt.totalInterestRemaining)}</p>
              </div>
            )}
            {debt.additionalContributions && debt.additionalContributionAmount && (
              <div>
                <p className="text-muted-foreground">Extra Payment</p>
                <p className="font-medium">{formatMoney(debt.additionalContributionAmount)}/mo</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

