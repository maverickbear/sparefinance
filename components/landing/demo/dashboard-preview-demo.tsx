"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";
import { FullDashboardDemo } from "./full-dashboard-demo";
import { ChartDemo } from "./chart-demo";

export function DashboardPreviewDemo() {
  const summaryCards = [
    {
      title: "Total Balance",
      value: "$45,230.00",
      change: "+12.5%",
      trend: "up" as const,
      icon: Wallet,
    },
    {
      title: "Monthly Income",
      value: "$8,000.00",
      change: "+12.5%",
      trend: "up" as const,
      icon: TrendingUp,
    },
    {
      title: "Monthly Expenses",
      value: "$3,500.00",
      change: "-5.2%",
      trend: "down" as const,
      icon: TrendingDown,
    },
    {
      title: "Savings",
      value: "$4,500.00",
      change: "+15.3%",
      trend: "up" as const,
      icon: PiggyBank,
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6">
      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          const isPositive = card.trend === "up";
          return (
            <Card key={index} className="shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {card.change}
                  </span>
                </div>
                <CardTitle className="text-sm font-medium text-muted-foreground mt-2">
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart */}
      <div className="w-full">
        <ChartDemo />
      </div>
    </div>
  );
}

// Keep the old component for backward compatibility if needed
export function DashboardPreviewDemoOld() {
  const summaryCards = [
    {
      title: "Total Balance",
      value: "$12,450.00",
      change: "+12.5%",
      trend: "up" as const,
      icon: Wallet,
    },
    {
      title: "Income",
      value: "$5,200.00",
      change: "+8.2%",
      trend: "up" as const,
      icon: TrendingUp,
    },
    {
      title: "Expenses",
      value: "$3,750.00",
      change: "-5.1%",
      trend: "down" as const,
      icon: TrendingDown,
    },
    {
      title: "Savings",
      value: "$1,450.00",
      change: "+15.3%",
      trend: "up" as const,
      icon: PiggyBank,
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          const isPositive = card.trend === "up";
          return (
            <Card key={index} className="shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isPositive ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {card.change}
                  </span>
                </div>
                <CardTitle className="text-sm font-medium text-muted-foreground mt-2">
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart Placeholder */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Monthly Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Chart visualization</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

