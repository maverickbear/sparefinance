"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

interface FinancialOverviewProps {
  financial: {
    mrr: number;
    estimatedFutureMRR: number;
    totalEstimatedMRR: number;
    subscriptionDetails: Array<{
      subscriptionId: string;
      userId: string;
      planId: string;
      planName: string;
      status: string;
      monthlyRevenue: number;
      interval: "month" | "year" | "unknown";
      trialEndDate: string | null;
    }>;
    upcomingTrials: Array<{
      subscriptionId: string;
      userId: string;
      planId: string;
      planName: string;
      trialEndDate: string;
      daysUntilEnd: number;
      estimatedMonthlyRevenue: number;
    }>;
  };
  loading?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function FinancialOverview({ financial, loading }: FinancialOverviewProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const annualRunRate = financial.mrr * 12;
  const totalAnnualRunRate = financial.totalEstimatedMRR * 12;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financial.mrr)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(annualRunRate)} annual run rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Future MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(financial.estimatedFutureMRR)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {financial.upcomingTrials.length} trialing users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Estimated MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financial.totalEstimatedMRR)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalAnnualRunRate)} annual run rate
            </p>
          </CardContent>
        </Card>
      </div>

      {financial.upcomingTrials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Upcoming Trial Expirations
            </CardTitle>
            <CardDescription>
              Trials that will expire soon and potential revenue if converted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {financial.upcomingTrials.slice(0, 10).map((trial) => (
                <div
                  key={trial.subscriptionId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{trial.planName}</div>
                    <div className="text-sm text-muted-foreground">
                      Expires in {trial.daysUntilEnd} day{trial.daysUntilEnd !== 1 ? "s" : ""} •{" "}
                      {format(new Date(trial.trialEndDate), "MMM dd, yyyy")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      {formatCurrency(trial.estimatedMonthlyRevenue)}/mo
                    </div>
                    <div className="text-xs text-muted-foreground">Potential MRR</div>
                  </div>
                </div>
              ))}
              {financial.upcomingTrials.length > 10 && (
                <div className="text-sm text-muted-foreground text-center pt-2">
                  + {financial.upcomingTrials.length - 10} more trials
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Revenue Breakdown by Plan</CardTitle>
          <CardDescription>
            Current MRR contribution from each plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(
              financial.subscriptionDetails.reduce((acc, sub) => {
                if (!acc[sub.planName]) {
                  acc[sub.planName] = {
                    planName: sub.planName,
                    count: 0,
                    revenue: 0,
                  };
                }
                acc[sub.planName].count++;
                acc[sub.planName].revenue += sub.monthlyRevenue;
                return acc;
              }, {} as Record<string, { planName: string; count: number; revenue: number }>)
            )
              .sort(([, a], [, b]) => b.revenue - a.revenue)
              .map(([planName, data]) => {
                const percentage =
                  financial.mrr > 0
                    ? ((data.revenue / financial.mrr) * 100).toFixed(1)
                    : "0.0";
                return (
                  <div
                    key={planName}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{planName}</div>
                      <div className="text-sm text-muted-foreground">
                        {data.count} subscription{data.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(data.revenue)}</div>
                      <div className="text-xs text-muted-foreground">{percentage}% of MRR</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

