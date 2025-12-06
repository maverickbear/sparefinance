import { Suspense } from "react";
import { loadDashboardData } from "../dashboard/data-loader";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { SpareScoreInsightsPage } from "./insights-content";
import { PageHeader } from "@/components/common/page-header";
import { Loader2 } from "lucide-react";
import { recalculateFinancialHealthFromTransactions } from "@/src/application/shared/financial-health";

async function InsightsContent() {
  const selectedMonthDate = startOfMonth(new Date());
  const startDate = startOfMonth(selectedMonthDate);
  const endDate = endOfMonth(selectedMonthDate);
  const data = await loadDashboardData(selectedMonthDate, startDate, endDate);

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

  // Filter to only include past transactions (exclude future ones)
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

  // Get session tokens for emergency fund calculation
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
      }
    }
  } catch (error) {
    // Continue without tokens - function will try to get them
  }

  // Recalculate financial health using only past transactions
  // This ensures the Spare Score matches the income/expenses shown
  // Emergency fund months will be recalculated using the system Goal "Emergency Funds"
  const financialHealth = data.financialHealth 
    ? await recalculateFinancialHealthFromTransactions(
        pastSelectedMonthTransactions,
        data.financialHealth,
        accessToken,
        refreshToken,
        data.accounts
      )
    : null;

  const emergencyFundMonths = financialHealth?.emergencyFundMonths ?? data.financialHealth?.emergencyFundMonths ?? 0;

  return (
    <SpareScoreInsightsPage
      financialHealth={financialHealth}
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

