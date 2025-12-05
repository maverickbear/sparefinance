"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const futureMRRPercentage = financial.mrr > 0
    ? ((financial.estimatedFutureMRR / financial.mrr) * 100).toFixed(1)
    : "0.0";
  const growthPotential = financial.totalEstimatedMRR > 0
    ? ((financial.estimatedFutureMRR / financial.totalEstimatedMRR) * 100).toFixed(1)
    : "0.0";

  // Calculate average revenue per subscription
  const avgRevenuePerSubscription = financial.subscriptionDetails.length > 0
    ? financial.mrr / financial.subscriptionDetails.length
    : 0;

  // Calculate total potential from trials
  const totalTrialPotential = financial.upcomingTrials.reduce(
    (sum, trial) => sum + trial.estimatedMonthlyRevenue,
    0
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Monthly Recurring Revenue
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-sentiment-positive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financial.mrr)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {formatCurrency(annualRunRate)} annual run rate
              </p>
              <p className="text-xs font-medium text-primary">
                {financial.subscriptionDetails.length} active subscriptions
              </p>
            </div>
            {avgRevenuePerSubscription > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Avg: {formatCurrency(avgRevenuePerSubscription)}/subscription
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-sentiment-positive/20 bg-gradient-to-br from-background to-sentiment-positive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-sentiment-positive" />
              Estimated Future MRR
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-sentiment-positive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sentiment-positive">
              {formatCurrency(financial.estimatedFutureMRR)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-sentiment-positive rounded-full"
                  style={{ 
                    width: `${financial.totalEstimatedMRR > 0 
                      ? Math.min((financial.estimatedFutureMRR / financial.totalEstimatedMRR) * 100, 100)
                      : 0}%` 
                  }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                From {financial.upcomingTrials.length} trialing users
              </p>
              <p className="text-xs font-medium text-sentiment-positive">
                +{futureMRRPercentage}% potential
              </p>
            </div>
            {financial.upcomingTrials.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Avg: {formatCurrency(totalTrialPotential / financial.upcomingTrials.length)}/trial
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Total Estimated MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financial.totalEstimatedMRR)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totalAnnualRunRate)} annual run rate
              </p>
              <p className="text-xs font-medium text-primary">
                {growthPotential}% from trials
              </p>
            </div>
            {financial.mrr > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {((financial.totalEstimatedMRR / financial.mrr - 1) * 100).toFixed(1)}% growth potential
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {financial.upcomingTrials.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Trial Expirations
                </CardTitle>
                <CardDescription className="mt-1">
                  Trials that will expire soon and potential revenue if converted
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-sentiment-positive">
                  {formatCurrency(totalTrialPotential)}
                </div>
                <div className="text-xs text-muted-foreground">Total Potential</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {financial.upcomingTrials.slice(0, 10).map((trial) => {
                const isUrgent = trial.daysUntilEnd <= 7;
                const isSoon = trial.daysUntilEnd <= 14;
                return (
                  <div
                    key={trial.subscriptionId}
                    className={cn(
                      "flex items-center justify-between p-3 border rounded-lg transition-colors",
                      isUrgent && "border-sentiment-warning/50 bg-sentiment-warning/5",
                      isSoon && !isUrgent && "border-primary/30"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{trial.planName}</div>
                        {isUrgent && (
                          <AlertCircle className="h-4 w-4 text-sentiment-warning" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <span>
                          Expires in {trial.daysUntilEnd} day{trial.daysUntilEnd !== 1 ? "s" : ""}
                        </span>
                        <span>•</span>
                        <span>{format(new Date(trial.trialEndDate), "MMM dd, yyyy")}</span>
                      </div>
                      {isUrgent && (
                        <div className="text-xs text-sentiment-warning font-medium mt-1">
                          Urgent: Expires soon
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sentiment-positive">
                        {formatCurrency(trial.estimatedMonthlyRevenue)}/mo
                      </div>
                      <div className="text-xs text-muted-foreground">Potential MRR</div>
                      {financial.mrr > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {((trial.estimatedMonthlyRevenue / financial.mrr) * 100).toFixed(2)}% of current MRR
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {financial.upcomingTrials.length > 10 && (
                <div className="text-sm text-muted-foreground text-center pt-2 border-t">
                  + {financial.upcomingTrials.length - 10} more trial{financial.upcomingTrials.length - 10 !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Revenue Breakdown by Plan
              </CardTitle>
              <CardDescription className="mt-1">
                Current MRR contribution from each plan with detailed metrics
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{financial.subscriptionDetails.length}</div>
              <div className="text-xs text-muted-foreground">Total Plans</div>
            </div>
          </div>
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
                const avgRevenuePerSub = data.count > 0
                  ? data.revenue / data.count
                  : 0;
                return (
                  <div
                    key={planName}
                    className="p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium">{planName}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <span>{data.count} subscription{data.count !== 1 ? "s" : ""}</span>
                          {avgRevenuePerSub > 0 && (
                            <>
                              <span>•</span>
                              <span>Avg: {formatCurrency(avgRevenuePerSub)}/sub</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-lg">{formatCurrency(data.revenue)}</div>
                        <div className="text-xs text-muted-foreground">{percentage}% of MRR</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="text-xs font-medium text-muted-foreground min-w-[50px] text-right">
                        {percentage}%
                      </div>
                    </div>
                  </div>
                );
              })}
            {Object.keys(
              financial.subscriptionDetails.reduce((acc, sub) => {
                acc[sub.planName] = true;
                return acc;
              }, {} as Record<string, boolean>)
            ).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No subscription data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

