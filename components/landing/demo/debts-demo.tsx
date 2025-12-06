"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/components/common/money";
import { CreditCard, TrendingDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data
const mockDebts = [
  {
    id: "1",
    name: "Credit Card",
    loanType: "credit_card",
    currentBalance: 3500,
    initialAmount: 5000,
    interestRate: 18.5,
    monthlyPayment: 150,
    totalMonths: 36,
    principalPaid: 1500,
    interestPaid: 450,
    priority: "High" as const,
    progressPct: 30,
    monthsRemaining: 24,
  },
  {
    id: "2",
    name: "Car Loan",
    loanType: "car_loan",
    currentBalance: 12000,
    initialAmount: 25000,
    interestRate: 5.5,
    monthlyPayment: 450,
    totalMonths: 60,
    principalPaid: 13000,
    interestPaid: 3200,
    priority: "Medium" as const,
    progressPct: 52,
    monthsRemaining: 28,
  },
];

const getLoanTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    credit_card: "Credit Card",
    car_loan: "Car Loan",
    student_loan: "Student Loan",
    mortgage: "Mortgage",
    personal_loan: "Personal Loan",
    business_loan: "Business Loan",
    other: "Other",
  };
  return labels[type] || type;
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "High":
      return "bg-sentiment-negative text-white";
    case "Medium":
      return "bg-sentiment-warning text-white";
    case "Low":
      return "bg-interactive-primary text-white";
    default:
      return "bg-gray-500 text-white";
  }
};

export function DebtsDemo() {
  return (
    <div className="relative w-full h-[500px] flex items-center justify-center pointer-events-none">
      {/* First Widget - Behind */}
      <div className="absolute w-[85%] max-w-sm transform -rotate-3 z-10" style={{ transform: "translate(20px, 20px) rotate(-3deg)" }}>
        <Card className="transition-all">
          {(() => {
            const debt = mockDebts[0];
            return (
              <>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base font-semibold truncate">{debt.name}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">
                          {getLoanTypeLabel(debt.loanType)}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn("text-xs", getPriorityColor(debt.priority))}>
                      {debt.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Current Balance</span>
                      <span className="font-semibold text-sentiment-negative">
                        {formatMoney(debt.currentBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Monthly Payment</span>
                      <span className="font-semibold">{formatMoney(debt.monthlyPayment)}</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{debt.progressPct}%</span>
                    </div>
                    <Progress value={debt.progressPct} className="h-2" />
                  </div>
                </CardContent>
              </>
            );
          })()}
        </Card>
      </div>

      {/* Second Widget - In Front */}
      <div className="absolute w-[90%] max-w-md transform rotate-2 z-20 shadow-2xl" style={{ transform: "translate(-20px, -20px) rotate(2deg)" }}>
        <Card className="transition-all">
          {(() => {
            const debt = mockDebts[1];
            return (
              <>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base font-semibold truncate">{debt.name}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">
                          {getLoanTypeLabel(debt.loanType)}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn("text-xs", getPriorityColor(debt.priority))}>
                      {debt.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Current Balance</span>
                      <span className="font-semibold text-sentiment-negative">
                        {formatMoney(debt.currentBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Monthly Payment</span>
                      <span className="font-semibold">{formatMoney(debt.monthlyPayment)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Interest Rate</span>
                      <span className="font-semibold">{debt.interestRate}%</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{debt.progressPct}%</span>
                    </div>
                    <Progress value={debt.progressPct} className="h-2" />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{debt.monthsRemaining} months left</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      <span>{formatMoney(debt.principalPaid)} paid</span>
                    </div>
                  </div>
                </CardContent>
              </>
            );
          })()}
        </Card>
      </div>
    </div>
  );
}
