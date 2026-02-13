"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { DashboardLayout } from "./dashboard-layout";
import { TotalBudgetsWidget } from "./widgets/total-budgets-widget";
import { SpendingWidget } from "./widgets/spending-widget";
import { RecentTransactionsWidget } from "./widgets/recent-transactions-widget";
import { GoalsProgressWidget } from "./widgets/goals-progress-widget";
import { RecurringWidget } from "./widgets/recurring-widget";
import { SubscriptionsWidget } from "./widgets/subscriptions-widget";
import { AddTransactionWidget } from "./widgets/add-transaction-widget";
import { ExpectedIncomeWidget } from "./widgets/expected-income-widget";
import { WidgetCard } from "./widgets/widget-card";
import { formatMoney } from "@/components/common/money";
import { SpareScoreDetailsDialog } from "./widgets/spare-score-details-dialog";
import { SpareScoreFullWidthWidget } from "./widgets/spare-score-full-width-widget";
import { RefreshCcw } from "lucide-react";
import { useDashboardSnapshot } from "@/src/presentation/contexts/dashboard-snapshot-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HouseholdMemberOption {
  id: string;
  memberId: string | null;
  name: string | null;
  email: string;
  isOwner?: boolean;
}

interface DashboardWidgetsClientProps {
  initialDate?: Date;
}

/**
 * Dashboard widgets driven by a single aggregated source (GET /api/dashboard).
 * Data comes from DashboardSnapshotProvider: snapshot from storage → version check → conditional refetch.
 * No independent data fetching; Refresh button forces version check and refetch only if version changed.
 */
export function DashboardWidgetsClient({ initialDate }: DashboardWidgetsClientProps) {
  const { data, loading, error, refresh, selectedMemberId, setSelectedMemberId } = useDashboardSnapshot();
  const [showSpareScoreDetails, setShowSpareScoreDetails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [members, setMembers] = useState<HouseholdMemberOption[]>([]);

  useEffect(() => {
    fetch("/api/v2/members", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { members: [] }))
      .then((body: { members?: HouseholdMemberOption[] }) => setMembers(body.members ?? []))
      .catch(() => setMembers([]));
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh(true);
    } finally {
      setIsRefreshing(false);
    }
  };

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
          <Button onClick={handleRefresh} variant="default">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="w-full p-4 lg:p-6">
      <div className="flex flex-row items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex flex-row items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-normal">Your family finances at a glance</h1>
          <Select
            value={selectedMemberId ?? "everyone"}
            onValueChange={(value) => setSelectedMemberId(value === "everyone" ? null : value)}
          >
            <SelectTrigger
              className="w-auto min-w-[8rem] border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 py-0 h-auto font-semibold text-lg text-foreground hover:bg-muted/50 rounded-md gap-0.5 [&>svg]:ml-0.5"
              size="medium"
            >
              <SelectValue placeholder="Everyone" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="everyone">Everyone</SelectItem>
              {members.map((m) => {
                const value = m.memberId ?? m.id;
                const label = m.name || m.email || "Member";
                return (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="small" onClick={handleRefresh} disabled={loading || isRefreshing} className="gap-2">
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <DashboardLayout>
        {/* Stats Section: 4 Columns - Available, Income, Savings, Net Worth */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 lg:mb-6">
           <WidgetCard title="Available" className="min-h-0 h-auto">
              {(() => {
                const available = data.accountStats?.totalAvailable ??
                  (data.accountStats ? (data.accountStats.totalChecking ?? 0) + (data.accountStats.totalSavings ?? 0) : 0);
                const card = data.accountStats?.availableCard;
                const statusConfig = !card
                  ? null
                  : card.status === "at_risk"
                    ? { label: "At risk", emoji: "🟡" }
                    : card.status === "behind"
                      ? { label: "Behind", emoji: "🔴" }
                      : { label: "On track", emoji: "🟢" };
                return (
                  <div className="flex flex-col gap-2">
                    <div className="text-2xl font-bold">
                      {formatMoney(available)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {card?.vsLastMonthDelta != null
                        ? `${formatMoney(card.vsLastMonthDelta)} vs last month`
                        : "— vs last month"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Free to spend: {card?.freeToSpend != null ? formatMoney(card.freeToSpend) : "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Projected end of month: {card?.projectedEndOfMonth != null ? formatMoney(card.projectedEndOfMonth) : "—"}
                    </p>
                    <p className="text-sm font-medium mt-0.5">
                      {statusConfig ? `${statusConfig.emoji} ${statusConfig.label}` : "—"}
                    </p>
                  </div>
                );
              })()}
           </WidgetCard>
           <ExpectedIncomeWidget
             data={data.expectedIncomeOverview ?? null}
             onRefresh={handleRefresh}
             className="min-h-0 h-auto"
           />
           <WidgetCard title="Savings" className="min-h-0 h-auto">
              {(() => {
                const savings = data.accountStats?.totalSavings ?? 0;
                const card = data.accountStats?.savingsCard;
                const statusConfig = !card
                  ? null
                  : card.status === "at_risk"
                    ? { label: "At risk", emoji: "🔴" }
                    : card.status === "below_target"
                      ? { label: "Below target", emoji: "🟡" }
                      : card.status === "on_track"
                        ? { label: "On track", emoji: "🟢" }
                        : { label: "Growing steadily", emoji: "🟢" };
                return (
                  <div className="flex flex-col gap-2">
                    <div className="text-2xl font-bold">
                      {formatMoney(savings)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {card?.savedThisMonth != null
                        ? `${formatMoney(card.savedThisMonth)} this month`
                        : "— this month"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {card?.savingPercentOfIncome != null && card?.savingTargetPercent != null
                        ? `Saving ${card.savingPercentOfIncome}% of income (Target: ${card.savingTargetPercent}%)`
                        : "Saving: —"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {card?.emergencyFundMonths != null
                        ? `Emergency fund covers ${card.emergencyFundMonths} months`
                        : "Emergency fund: —"}
                    </p>
                    <p className="text-sm font-medium mt-0.5">
                      {statusConfig ? `${statusConfig.emoji} ${statusConfig.label}` : "—"}
                    </p>
                  </div>
                );
              })()}
           </WidgetCard>
           <WidgetCard title="Net Worth" className="min-h-0 h-auto">
              {(() => {
                const nw = data.netWorth;
                const hasData = nw != null;
                const netWorth = nw?.netWorth ?? 0;
                const change = nw?.change ?? 0;
                const changePct = nw?.changePercentage ?? 0;
                const assets = nw?.totalAssets ?? 0;
                const liabilities = nw?.totalLiabilities ?? 0;
                const statusLabel =
                  change > 0 ? "Improving" : change < 0 ? "Declining" : "Stable";
                const statusEmoji = change > 0 ? "🟢" : change < 0 ? "🔴" : "🟡";
                return (
                  <div className="flex flex-col gap-2">
                    <div className="text-2xl font-bold">
                      {formatMoney(netWorth)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {hasData ? `${formatMoney(change)} this month` : "— this month"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {hasData
                        ? `${change >= 0 ? "↑" : "↓"} ${Math.abs(changePct).toFixed(1)}% ${change >= 0 ? "growth" : "decline"}`
                        : "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Assets: {hasData ? formatMoney(assets) : "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Liabilities: {hasData ? formatMoney(liabilities) : "—"}
                    </p>
                    <p className="text-sm font-medium mt-0.5">
                      {hasData ? `${statusEmoji} ${statusLabel}` : "—"}
                    </p>
                  </div>
                );
              })()}
           </WidgetCard>
        </div>

        {/* Spare Score - full width with key data */}
        <div className="w-full mb-4 lg:mb-6">
          <SpareScoreFullWidthWidget
            data={data.spareScore}
            onOpenDetails={() => setShowSpareScoreDetails(true)}
          />
        </div>

        <SpareScoreDetailsDialog
          open={showSpareScoreDetails}
          onOpenChange={setShowSpareScoreDetails}
          data={data.spareScore?.details}
        />

        {/* Top Section: 3 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-4 lg:mb-6">
           <TotalBudgetsWidget data={data.totalBudgets} className="h-full" />
           <SpendingWidget data={data.spending} className="h-full" />
           <AddTransactionWidget onTransactionAdded={handleRefresh} />
        </div>

        {/* Existing Grid for remaining widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 auto-rows-fr">
           <GoalsProgressWidget data={data.goalsProgress} className="min-h-0 h-auto" />
           <RecentTransactionsWidget data={data.recentTransactions} className="h-full" />
           
           <RecurringWidget data={data.recurring} className="h-full" />
           <SubscriptionsWidget data={data.subscriptions} className="h-full" />
        </div>
      </DashboardLayout>
    </div>
  );
}
