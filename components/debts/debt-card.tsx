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
    totalMonths: number;
    firstPaymentDate: string;
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

  return (
    <Card className={debt.isPaidOff ? "opacity-75" : ""}>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Progress Ring - Left Side */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <ProgressRing
              percentage={debt.progressPct || 0}
              size={80}
              strokeWidth={8}
            />
          </div>

          {/* Main Content - Center */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <CardTitle className="text-xl font-semibold">{debt.name}</CardTitle>
                  {debt.isPaidOff && (
                    <Badge variant="default" className="bg-green-600 dark:bg-green-500 text-white">
                      Paid Off
                    </Badge>
                  )}
                  {debt.isPaused && (
                    <Badge variant="outline" className="border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400">
                      Paused
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{loanTypeLabel}</Badge>
                </div>
                {debt.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-1">
                    {debt.description}
                  </p>
                )}
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

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                <p className="font-semibold text-lg">{formatMoney(debt.currentBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {debt.paymentFrequency && debt.paymentFrequency !== "monthly"
                    ? `${paymentFrequencyLabels[debt.paymentFrequency] || debt.paymentFrequency} Payment`
                    : "Monthly Payment"}
                </p>
                <p className="font-semibold">
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
              {debt.monthsRemaining !== null && debt.monthsRemaining !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Time Remaining</p>
                  <p className="font-semibold">
                    {debt.monthsRemaining === 0
                      ? "Paid off!"
                      : debt.monthsRemaining < 12
                      ? `${Math.round(debt.monthsRemaining)}m`
                      : `${Math.floor(debt.monthsRemaining / 12)}y ${Math.round(debt.monthsRemaining % 12)}m`}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
                <p className="font-semibold">{debt.interestRate.toFixed(2)}%</p>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
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
        </div>
      </CardContent>
    </Card>
  );
}

