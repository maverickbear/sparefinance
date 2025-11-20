import { Suspense } from "react";
import { loadDashboardData } from "../dashboard/data-loader";
import { startOfMonth } from "date-fns/startOfMonth";
import { SpareScoreInsightsPage } from "./insights-content";
import { PageHeader } from "@/components/common/page-header";
import { Loader2 } from "lucide-react";

async function InsightsContent() {
  const selectedMonthDate = startOfMonth(new Date());
  const data = await loadDashboardData(selectedMonthDate);

  // Calculate current income and expenses
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    const normalized = dateStr.replace(' ', 'T').split('.')[0];
    return new Date(normalized);
  };

  const pastSelectedMonthTransactions = data.selectedMonthTransactions.filter((t) => {
    if (!t.date) return false;
    try {
      const txDate = parseTransactionDate(t.date);
      txDate.setHours(0, 0, 0, 0);
      return txDate <= today;
    } catch (error) {
      return false;
    }
  });

  const currentIncome = pastSelectedMonthTransactions
    .filter((t) => t && t.type === "income")
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + Math.abs(amount);
    }, 0);

  const currentExpenses = pastSelectedMonthTransactions
    .filter((t) => t && t.type === "expense")
    .reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + Math.abs(amount);
    }, 0);

  const emergencyFundMonths = data.financialHealth?.emergencyFundMonths ?? 0;

  return (
    <SpareScoreInsightsPage
      financialHealth={data.financialHealth}
      currentIncome={currentIncome}
      currentExpenses={currentExpenses}
      emergencyFundMonths={emergencyFundMonths}
      selectedMonthTransactions={data.selectedMonthTransactions}
      lastMonthTransactions={data.lastMonthTransactions}
    />
  );
}

export default function InsightsPage() {
  return (
    <>
      <PageHeader title="Spare Score Insights & Actions" />
      <div className="w-full p-4 lg:p-8">
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }>
          <InsightsContent />
        </Suspense>
      </div>
    </>
  );
}

