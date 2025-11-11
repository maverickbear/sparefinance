"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialHealthWidget } from "@/components/dashboard/financial-health-widget";
import { GoalsOverview } from "@/components/dashboard/goals-overview";
import { cn } from "@/lib/utils";

const mockFinancialHealth = {
  score: 85,
  classification: "Excellent" as const,
  monthlyIncome: 8000,
  monthlyExpenses: 3500,
  netAmount: 4500,
  savingsRate: 56.25,
  message: "Your financial health is excellent! Keep up the great work.",
  alerts: [
    {
      id: "1",
      title: "High spending in Shopping category",
      description: "You've exceeded your budget by 18.75%",
      severity: "warning" as const,
      action: "Review your shopping expenses",
    },
  ],
  suggestions: [
    {
      id: "1",
      title: "Increase savings rate",
      description: "Consider saving 20% of your income",
      impact: "high" as const,
    },
  ],
};

const mockGoals = [
  {
    id: "1",
    name: "Emergency Fund",
    targetAmount: 10000,
    currentBalance: 6500,
    incomePercentage: 20,
    priority: "High" as const,
    isCompleted: false,
    progressPct: 65,
    monthsToGoal: 8,
    monthlyContribution: 500,
    incomeBasis: 5000,
  },
  {
    id: "2",
    name: "Vacation",
    targetAmount: 5000,
    currentBalance: 2500,
    incomePercentage: 10,
    priority: "Medium" as const,
    isCompleted: false,
    progressPct: 50,
    monthsToGoal: 5,
    monthlyContribution: 500,
    incomeBasis: 5000,
  },
];

export function DashboardWidgetsDemo() {
  return (
    <div className="relative w-full h-[500px] flex items-center justify-center pointer-events-none">
      {/* First Widget - Behind */}
      <div className="absolute w-[80%] max-w-sm transform -rotate-3 z-10" style={{ transform: "translate(16px, 16px) rotate(-3deg)" }}>
        <div className="pointer-events-none">
          <FinancialHealthWidget 
            data={mockFinancialHealth}
            lastMonthIncome={7500}
            lastMonthExpenses={3700}
          />
        </div>
      </div>

      {/* Second Widget - In Front */}
      <div className="absolute w-[90%] max-w-md transform rotate-2 z-20 shadow-2xl" style={{ transform: "translate(-16px, -16px) rotate(2deg)" }}>
        <div className="pointer-events-none">
          <GoalsOverview goals={mockGoals} />
        </div>
      </div>
    </div>
  );
}

