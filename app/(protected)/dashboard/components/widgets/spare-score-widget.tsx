"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { formatMoney } from "@/components/common/money";
import type { FinancialHealthData } from "@/src/application/shared/financial-health";
import { sentiment } from "@/lib/design-system/colors";

interface SpareScoreWidgetProps {
  financialHealth: FinancialHealthData | null;
  // Note: Historical data would need to be fetched separately
  // For now, we'll show current score components
}

// Simple radar chart for score components
function ScoreRadarChart({ data }: { data: Array<{ name: string; value: number; max: number }> }) {
  const chartData = data.map((item) => ({
    ...item,
    percentage: (item.value / item.max) * 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={chartData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
        />
        <Radar
          name="Score"
          dataKey="percentage"
          stroke={sentiment.positive}
          fill={sentiment.positive}
          fillOpacity={0.3}
        />
        <Tooltip
          formatter={(value: number) => `${value.toFixed(1)}%`}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function SpareScoreWidget({
  financialHealth,
}: SpareScoreWidgetProps) {
  const spareScore = financialHealth?.score ?? 0;
  const hasNoData = financialHealth
    ? (financialHealth.monthlyIncome === 0 && financialHealth.monthlyExpenses === 0 && spareScore === 0)
    : true;

  const getClassification = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: sentiment.positive };
    if (score >= 60) return { label: "Good", color: sentiment.positive };
    if (score >= 40) return { label: "Fair", color: sentiment.warning };
    return { label: "Needs Work", color: sentiment.negative };
  };

  const classification = getClassification(spareScore);

  // Calculate score components (simplified - would need actual component breakdown from financial health)
  const scoreComponents = useMemo(() => {
    if (!financialHealth || hasNoData) return [];

    // Estimate components based on available data
    // In a real implementation, these would come from the financial health calculation
    const savingsRate = financialHealth.savingsRate || 0;
    const emergencyFundMonths = financialHealth.emergencyFundMonths || 0;
    const debtExposure = financialHealth.debtExposure === "Low" ? 80 : financialHealth.debtExposure === "Moderate" ? 50 : 20;
    const spendingDiscipline = financialHealth.spendingDiscipline === "Excellent" ? 90 : financialHealth.spendingDiscipline === "Good" ? 70 : financialHealth.spendingDiscipline === "Fair" ? 50 : 30;

    // Net amount component (positive = good)
    const netAmount = financialHealth.netAmount || 0;
    const netAmountScore = netAmount > 0 ? Math.min(100, (netAmount / (financialHealth.monthlyIncome || 1)) * 100) : 0;

    return [
      { name: "Savings Rate", value: Math.min(100, savingsRate * 100), max: 100 },
      { name: "Emergency Fund", value: Math.min(100, (emergencyFundMonths / 8) * 100), max: 100 },
      { name: "Debt Management", value: debtExposure, max: 100 },
      { name: "Spending Control", value: spendingDiscipline, max: 100 },
      { name: "Net Cash Flow", value: netAmountScore, max: 100 },
    ];
  }, [financialHealth, hasNoData]);

  // Calculate progress to next classification
  const nextThreshold = spareScore < 40 ? 40 : spareScore < 60 ? 60 : spareScore < 80 ? 80 : 100;
  const progressToNext = nextThreshold > spareScore ? ((spareScore / nextThreshold) * 100) : 100;
  const pointsNeeded = Math.max(0, nextThreshold - spareScore);

  // Get insights
  const insights = useMemo(() => {
    if (hasNoData) return [];
    const insightsList = [];

    if (financialHealth?.savingsRate && financialHealth.savingsRate < 0.1) {
      insightsList.push({
        type: "warning",
        title: "Low Savings Rate",
        message: `Your savings rate is ${(financialHealth.savingsRate * 100).toFixed(1)}%. Aim for at least 10-20% to improve your score.`,
      });
    }

    if (financialHealth?.emergencyFundMonths && financialHealth.emergencyFundMonths < 3) {
      insightsList.push({
        type: "warning",
        title: "Build Emergency Fund",
        message: `You have ${financialHealth.emergencyFundMonths.toFixed(1)} months of emergency fund. Aim for 6-8 months.`,
      });
    }

    if (financialHealth?.debtExposure && financialHealth.debtExposure !== "Low") {
      insightsList.push({
        type: "warning",
        title: "Debt Management",
        message: `Your debt exposure is ${financialHealth.debtExposure}. Focus on paying down debt to improve your score.`,
      });
    }

    if (spareScore >= 80) {
      insightsList.push({
        type: "positive",
        title: "Excellent Score",
        message: "You're doing great! Keep maintaining good financial habits.",
      });
    }

    return insightsList;
  }, [financialHealth, spareScore, hasNoData]);

  return (
    <div className="space-y-6 px-6 pb-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Current Score</div>
          <div className={`text-4xl font-bold ${classification.color}`}>
            {hasNoData ? "—" : spareScore}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {classification.label}
          </div>
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Next Milestone</div>
          <div className="text-2xl font-bold text-foreground">{nextThreshold}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {pointsNeeded > 0 ? `${pointsNeeded} points needed` : "Maximum reached"}
          </div>
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Progress</div>
          <div className="text-2xl font-bold text-foreground">{progressToNext.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground mt-1">
            To next classification
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {!hasNoData && (
        <div className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Score Progress</span>
            <span className="text-sm font-semibold text-foreground">
              {spareScore} / 100
            </span>
          </div>
          <div className="relative h-4 w-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500">
            <div
              className="absolute top-0 h-full w-1.5 bg-white border-2 border-black rounded-full shadow-md transform -translate-x-1/2"
              style={{ left: `${spareScore}%`, transition: 'left 0.5s ease-out' }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground font-medium">
            <span>0</span>
            <span>40</span>
            <span>60</span>
            <span>80</span>
            <span>100</span>
          </div>
        </div>
      )}

      {/* Score Components Radar Chart */}
      {scoreComponents.length > 0 && (
        <ChartCard
          title="Score Components"
          description="Breakdown of factors affecting your Spare Score"
        >
          <ScoreRadarChart data={scoreComponents} />
        </ChartCard>
      )}

      {/* Financial Health Metrics */}
      {financialHealth && !hasNoData && (
        <div className="border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Financial Health Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Monthly Income</div>
              <div className="text-lg font-semibold text-foreground">
                {formatMoney(financialHealth.monthlyIncome || 0)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Monthly Expenses</div>
              <div className="text-lg font-semibold text-foreground">
                {formatMoney(financialHealth.monthlyExpenses || 0)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Net Amount</div>
              <div
                className={`text-lg font-semibold ${(financialHealth.netAmount || 0) >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
                  }`}
              >
                {formatMoney(financialHealth.netAmount || 0)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Savings Rate</div>
              <div className="text-lg font-semibold text-foreground">
                {((financialHealth.savingsRate || 0) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Emergency Fund</div>
              <div className="text-lg font-semibold text-foreground">
                {(financialHealth.emergencyFundMonths || 0).toFixed(1)} months
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Debt Exposure</div>
              <div className="text-lg font-semibold text-foreground capitalize">
                {financialHealth.debtExposure || "Unknown"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Insights & Recommendations</h3>
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-2">
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 ${insight.type === "positive" ? "bg-sentiment-positive" : "bg-sentiment-warning"
                    }`}
                />
                <div>
                  <div className="text-sm font-medium text-foreground">{insight.title}</div>
                  <div className="text-xs text-muted-foreground">{insight.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasNoData && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No data available to calculate Spare Score.</p>
          <p className="text-xs mt-1">Add income and expense transactions to see your score.</p>
        </div>
      )}
    </div>
  );
}

