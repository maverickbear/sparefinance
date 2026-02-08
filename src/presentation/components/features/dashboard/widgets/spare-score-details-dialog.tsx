"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SpareScoreDetails } from "@/src/domain/dashboard/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { formatMoney } from "@/components/common/money";

interface SpareScoreDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: SpareScoreDetails | undefined;
}

export function SpareScoreDetailsDialog({
  open,
  onOpenChange,
  data,
}: SpareScoreDetailsDialogProps) {
  if (!data) return null;

  const empty = data.isEmptyState ?? false; // No transactions this month — show "—" instead of 0

  // Next tier boundaries: 85 Excellent, 70 Strong, 55 Fair, 40 Fragile (docs/Spare_Score.md)
  const currentScore = data.score;
  const nextMilestone =
    currentScore < 40 ? 40 :
    currentScore < 55 ? 55 :
    currentScore < 70 ? 70 :
    currentScore < 85 ? 85 :
    100;

  const pointsNeeded = nextMilestone - currentScore;
  const bandStart = nextMilestone === 40 ? 0 : nextMilestone - 15;
  const bandSize = nextMilestone === 40 ? 40 : 15;
  const progressToNext = currentScore >= 100 ? 100 : Math.max(0, Math.min(100, ((currentScore - bandStart) / bandSize) * 100));

  // Prepare data for Radar Chart
  const radarData = [
    {
      subject: "Savings Rate",
      value: Math.min(100, Math.max(0, data.savingsRate * 5)), // Approx: 20% savings = 100 score
      fullMark: 100,
    },
    {
      subject: "Emergency Fund",
      value: Math.min(100, (data.emergencyFundMonths / 6) * 100), // 6 months = 100 score
      fullMark: 100,
    },
    {
      subject: "Debt Management",
      value: data.debtExposure === "Low" ? 100 : data.debtExposure === "Moderate" ? 60 : 30,
      fullMark: 100,
    },
    {
      subject: "Spending Control",
      value: 
        data.spendingDiscipline === "Excellent" ? 100 : 
        data.spendingDiscipline === "Good" ? 80 : 
        data.spendingDiscipline === "Fair" ? 60 : 
        data.spendingDiscipline === "Poor" ? 40 : 20,
      fullMark: 100,
    },
    {
      subject: "Net Cash Flow",
      value: data.netAmount > 0 ? 100 : data.netAmount === 0 ? 50 : 20,
      fullMark: 100,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[40vw] w-full p-0 flex flex-col gap-0 bg-background border-l">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="text-xl">Spare Score Details</SheetTitle>
          <SheetDescription>
            Your financial health score and insights
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">

            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 p-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Current</p>
                    <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-bold">{empty ? "—" : data.score}</span>
                    </div>
                    <p className={cn("text-xs font-medium truncate", empty ? "text-muted-foreground" : "text-primary")}>
                      {empty ? "No data" : data.classification}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 p-4">
                   <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Stats</p>
                    <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-bold">{empty ? "—" : (pointsNeeded > 0 ? pointsNeeded : 0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {empty ? "Add transactions to see score" : "Points to next tier"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 p-4">
                   <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Progress</p>
                    <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-bold">{empty ? "—" : `${Math.round(progressToNext)}%`}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{empty ? "No data" : "To next level"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Score Progress Bar */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">Score Progress</p>
                <p className="text-sm font-bold">{empty ? "— / 100" : `${data.score} / 100`}</p>
              </div>
              <div className="relative h-3 w-full rounded-full bg-secondary overflow-visible">
                {/* Gradient Background */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-80" />
                
                {/* Marker: hide when empty so we don't show "0%" */}
                {!empty && (
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-5 bg-black dark:bg-white border-2 border-white dark:border-black rounded-full z-10 shadow-sm transition-all duration-500"
                    style={{ left: `${data.score}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>0</span>
                <span>Critical</span>
                <span>Fragile</span>
                <span>Fair</span>
                <span>Strong</span>
                <span>Excellent</span>
                <span>100</span>
              </div>
            </div>

            {/* Insights */}
            <div className="space-y-4">
              <h3 className="font-semibold text-base">Insights</h3>
              <div className="grid grid-cols-1 gap-3">
                 {data.alerts.map((alert) => (
                    <Card key={alert.id} className="w-full">
                      <CardContent className="p-4 md:p-6 flex gap-3 items-start w-full">
                        {alert.severity === 'critical' ? (
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        ) : alert.severity === 'warning' ? (
                           <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                        ) : (
                           <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                           <p className="font-medium text-sm">{alert.title}</p>
                           <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{alert.description}</p>
                           {alert.action && (
                             <p className="text-xs text-primary font-medium mt-1.5">{alert.action}</p>
                           )}
                        </div>
                      </CardContent>
                    </Card>
                 ))}
                 
                 {data.suggestions.map((suggestion) => (
                   <Card key={suggestion.id} className="w-full">
                      <CardContent className="p-4 md:p-6 flex gap-3 items-start w-full">
                        <div className={cn(
                          "h-2 w-2 rounded-full mt-1.5 shrink-0", 
                          suggestion.impact === 'high' ? "bg-red-500" : 
                          suggestion.impact === 'medium' ? "bg-yellow-500" : "bg-green-500"
                        )} />
                        <div className="min-w-0 flex-1">
                           <p className="font-medium text-sm">{suggestion.title}</p>
                           <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{suggestion.description}</p>
                        </div>
                      </CardContent>
                   </Card>
                 ))}

                 {data.alerts.length === 0 && data.suggestions.length === 0 && (
                    <div className="flex gap-3 items-center text-muted-foreground p-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm">Great job! No specific recommendations at this time.</span>
                    </div>
                 )}
              </div>
            </div>

            {/* Radar Chart */}
            <div className="space-y-4">
               <div>
                  <h3 className="font-semibold text-base">Score Breakdown</h3>
                  <p className="text-xs text-muted-foreground">Based on your financial data</p>
               </div>
               <div className="h-[250px] w-full flex items-center justify-center border rounded-xl bg-card p-4">
                 <ResponsiveContainer width="100%" height="100%">
                   <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                     <PolarGrid className="text-muted-foreground/20" />
                     <PolarAngleAxis 
                       dataKey="subject" 
                       tick={{ fill: 'currentColor', fontSize: 11 }}
                       className="text-muted-foreground"
                     />
                     <Radar
                       name="Score"
                       dataKey="value"
                       stroke="hsl(var(--primary))"
                       fill="hsl(var(--primary))"
                       fillOpacity={0.3}
                     />
                   </RadarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            {/* Detailed Metrics */}
            <div className="space-y-4 pb-8">
              <h3 className="font-semibold text-base">Key Metrics</h3>
              <Card>
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Monthly Income{data.incomeIsAfterTax ? " (after tax)" : ""}
                      </p>
                      <p className="">{empty ? "—" : formatMoney(data.monthlyIncome)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Monthly Expenses</p>
                      <p className="">{empty ? "—" : formatMoney(data.monthlyExpenses)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Net Flow</p>
                      <p className={cn(empty ? "" : data.netAmount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                        {empty ? "—" : formatMoney(data.netAmount)}
                      </p>
                    </div>
                    <div>
                       <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Savings Rate</p>
                       <p className={cn(empty ? "" : data.savingsRate >= 20 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400")}>
                         {empty ? "—" : `${data.savingsRate.toFixed(1)}%`}
                       </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Emergency Fund</p>
                      <p className={cn(empty ? "" : data.emergencyFundMonths >= 6 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400")}>
                        {empty ? "—" : `${data.emergencyFundMonths.toFixed(1)} months`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Debt Exposure</p>
                      <p className={cn(empty ? "" : data.debtExposure === "Low" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                        {empty ? "—" : data.debtExposure}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
