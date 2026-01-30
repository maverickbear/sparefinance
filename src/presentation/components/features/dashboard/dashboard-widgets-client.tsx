"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { DashboardLayout, DashboardSection, DashboardGrid, DashboardWidgetContainer } from "./dashboard-layout";
import { TotalBudgetsWidget } from "./widgets/total-budgets-widget";
import { SpendingWidget } from "./widgets/spending-widget";
import { RecentTransactionsWidget } from "./widgets/recent-transactions-widget";
import { GoalsProgressWidget } from "./widgets/goals-progress-widget";

import { RecurringWidget } from "./widgets/recurring-widget";
import { SubscriptionsWidget } from "./widgets/subscriptions-widget";
import { AddTransactionWidget } from "./widgets/add-transaction-widget";
import { WidgetCard } from "./widgets/widget-card";
import { SpareScoreDetailsDialog } from "./widgets/spare-score-details-dialog";
import { RefreshCcw } from "lucide-react";
import type { DashboardWidgetsData } from "@/src/domain/dashboard/types";

interface DashboardWidgetsClientProps {
  initialDate?: Date;
}

export function DashboardWidgetsClient({ initialDate }: DashboardWidgetsClientProps) {
  const [data, setData] = useState<DashboardWidgetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSpareScoreDetails, setShowSpareScoreDetails] = useState(false);

  const loadWidgets = async () => {
    try {
      // Don't set loading to true for background refreshes if data exists
      if (!data) setLoading(true);
      setError(null);

      const dateParam = initialDate ? `?date=${initialDate.toISOString()}` : '';
      const response = await fetch(`/api/v2/dashboard/widgets${dateParam}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch widgets: ${response.statusText}`);
      }

      const widgetsData = await response.json();
      setData(widgetsData);
    } catch (err) {
      console.error("Error loading dashboard widgets:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard widgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWidgets();
  }, [initialDate]);

  if (loading) {
    return (
      <div className="w-full p-4 lg:p-8">
        <div className="space-y-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-4 lg:p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Error loading dashboard: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="w-full p-4 lg:p-6">
      <div className="flex flex-row items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your family finances at a glance</h1>
        </div>
        <Button variant="outline" size="small" onClick={loadWidgets} disabled={loading} className="gap-2">
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <DashboardLayout>
        {/* Stats Section: 4 Columns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 lg:mb-6">
           <WidgetCard title="Income" className="min-h-0 h-auto">
              <div className="flex flex-col gap-1">
                 <span className="text-xs text-muted-foreground">Current Checking Balance</span>
                 <div className="text-2xl font-bold">
                   {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.accountStats?.totalChecking || 0)}
                 </div>
              </div>
           </WidgetCard>
           <WidgetCard title="Savings" className="min-h-0 h-auto">
              <div className="flex flex-col gap-1">
                 <span className="text-xs text-muted-foreground">Current Savings Balance</span>
                 <div className="text-2xl font-bold">
                   {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.accountStats?.totalSavings || 0)}
                 </div>
              </div>
           </WidgetCard>
           <WidgetCard title="Net Worth" className="min-h-0 h-auto">
              <div className="flex flex-col gap-1">
                 <span className="text-xs text-muted-foreground">Current Net Position</span>
                 <div className="text-2xl font-bold">
                   {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.netWorth?.netWorth || 0)}
                 </div>
              </div>
           </WidgetCard>
           <WidgetCard 
             title="Spare Score" 
             className="min-h-0 h-auto"
             headerAction={
               <Button variant="outline" size="small" onClick={() => setShowSpareScoreDetails(true)} className="h-8 px-2 text-xs">
                 Details
               </Button>
             }
           >
              <div className="flex flex-col gap-1">
                 <span className="text-xs text-muted-foreground">Current Score</span>
                 <div className="text-2xl font-bold">
                   {data.spareScore?.score || 0}
                 </div>
              </div>
           </WidgetCard>
           
           <SpareScoreDetailsDialog 
              open={showSpareScoreDetails} 
              onOpenChange={setShowSpareScoreDetails} 
              data={data.spareScore?.details}
           />
        </div>

        {/* Top Section: 3 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-4 lg:mb-6">
           <TotalBudgetsWidget data={data.totalBudgets} className="h-full" />
           <SpendingWidget data={data.spending} className="h-full" />
           <AddTransactionWidget onTransactionAdded={loadWidgets} />
        </div>

        {/* Existing Grid for remaining widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 auto-rows-fr">
           <GoalsProgressWidget data={data.goalsProgress} className="h-full" />
           <RecentTransactionsWidget data={data.recentTransactions} className="h-full" />
           
           <RecurringWidget data={data.recurring} className="h-full" />
           <SubscriptionsWidget data={data.subscriptions} className="h-full" />
        </div>
      </DashboardLayout>
    </div>
  );
}
