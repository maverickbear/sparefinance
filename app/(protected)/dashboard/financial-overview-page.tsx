"use client";

import { useMemo, useState, useEffect } from "react";
import { calculateTotalIncome, calculateTotalExpenses } from "./utils/transaction-helpers";
import type { TransactionWithRelations, UpcomingTransaction } from "@/src/domain/transactions/transactions.types";
import type { AccountWithBalance } from "@/src/domain/accounts/accounts.types";
import type { BudgetWithRelations } from "@/src/domain/budgets/budgets.types";
import type { GoalWithCalculations } from "@/src/domain/goals/goals.types";
import type { DebtWithCalculations } from "@/src/domain/debts/debts.types";
import type { BasePlannedPayment } from "@/src/domain/planned-payments/planned-payments.types";
import type { UserServiceSubscription } from "@/src/domain/subscriptions/subscriptions.types";
import type { FinancialHealthData } from "@/src/application/shared/financial-health";
import { PageHeader } from "@/components/common/page-header";
import { SnapshotSection } from "./components/snapshot-section";
import { CashFlowSection } from "./components/cash-flow-section";
import { PlanningSection } from "./components/planning-section";
import { WealthSection } from "./components/wealth-section";

interface ChartTransactionData {
  month: string;
  income: number;
  expenses: number;
}

interface FinancialOverviewPageProps {
  selectedMonthTransactions: TransactionWithRelations[];
  lastMonthTransactions: TransactionWithRelations[];
  savings: number;
  totalBalance: number;
  lastMonthTotalBalance: number;
  accounts: AccountWithBalance[];
  budgets: BudgetWithRelations[];
  upcomingTransactions: UpcomingTransaction[];
  financialHealth: FinancialHealthData;
  goals: GoalWithCalculations[];
  chartTransactions: ChartTransactionData[];
  liabilities: AccountWithBalance[];
  debts: DebtWithCalculations[];
  recurringPayments: TransactionWithRelations[];
  subscriptions: UserServiceSubscription[];
  plannedPayments: BasePlannedPayment[];
  selectedMonthDate: Date;
  expectedIncomeRange?: string | null;
}

export function FinancialOverviewPage({
  selectedMonthTransactions: initialSelectedMonthTransactions,
  lastMonthTransactions: initialLastMonthTransactions,
  savings: initialSavings,
  totalBalance: initialTotalBalance,
  lastMonthTotalBalance: initialLastMonthTotalBalance,
  accounts: initialAccounts,
  budgets: initialBudgets,
  upcomingTransactions: initialUpcomingTransactions,
  financialHealth: initialFinancialHealth,
  goals: initialGoals,
  chartTransactions: initialChartTransactions,
  liabilities: initialLiabilities,
  debts: initialDebts,
  recurringPayments: initialRecurringPayments,
  subscriptions: initialSubscriptions,
  plannedPayments: initialPlannedPayments,
  selectedMonthDate,
  expectedIncomeRange: initialExpectedIncomeRange,
}: FinancialOverviewPageProps) {
  // Local state for dashboard data - initialized from props
  const [selectedMonthTransactions, setSelectedMonthTransactions] = useState(initialSelectedMonthTransactions);
  const [, setLastMonthTransactions] = useState(initialLastMonthTransactions);
  const [, setSavings] = useState(initialSavings);
  const [totalBalance, setTotalBalance] = useState(initialTotalBalance);
  const [, setLastMonthTotalBalance] = useState(initialLastMonthTotalBalance);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [upcomingTransactions, setUpcomingTransactions] = useState(initialUpcomingTransactions);
  const [financialHealth, setFinancialHealth] = useState(initialFinancialHealth);
  const [goals, setGoals] = useState(initialGoals);
  const [, setChartTransactions] = useState(initialChartTransactions);
  const [liabilities, setLiabilities] = useState(initialLiabilities);
  const [debts, setDebts] = useState(initialDebts);
  const [recurringPayments, setRecurringPayments] = useState(initialRecurringPayments);
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [plannedPayments, setPlannedPayments] = useState(initialPlannedPayments);
  const [, setExpectedIncomeRange] = useState(initialExpectedIncomeRange);

  // Update local state when props change
  useEffect(() => {
    setSelectedMonthTransactions(initialSelectedMonthTransactions);
    setLastMonthTransactions(initialLastMonthTransactions);
    setSavings(initialSavings);
    setTotalBalance(initialTotalBalance);
    setLastMonthTotalBalance(initialLastMonthTotalBalance);
    setAccounts(initialAccounts);
    setBudgets(initialBudgets);
    setUpcomingTransactions(initialUpcomingTransactions);
    setFinancialHealth(initialFinancialHealth);
    setGoals(initialGoals);
    setChartTransactions(initialChartTransactions);
    setLiabilities(initialLiabilities);
    setDebts(initialDebts);
    setRecurringPayments(initialRecurringPayments);
    setSubscriptions(initialSubscriptions);
    setPlannedPayments(initialPlannedPayments);
    setExpectedIncomeRange(initialExpectedIncomeRange);
  }, [
    initialSelectedMonthTransactions,
    initialLastMonthTransactions,
    initialSavings,
    initialTotalBalance,
    initialLastMonthTotalBalance,
    initialAccounts,
    initialBudgets,
    initialUpcomingTransactions,
    initialFinancialHealth,
    initialGoals,
    initialChartTransactions,
    initialLiabilities,
    initialDebts,
    initialRecurringPayments,
    initialSubscriptions,
    initialPlannedPayments,
    initialExpectedIncomeRange,
  ]);

  // Helper function to parse date from Supabase format
  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    const normalized = dateStr.replace(' ', 'T').split('.')[0];
    return new Date(normalized);
  };

  // Get today's date (without time) to filter out future transactions
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // Filter transactions to only include those with date <= today
  const pastSelectedMonthTransactions = useMemo(() => {
    return selectedMonthTransactions.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false;
      }
    });
  }, [selectedMonthTransactions, today]);

  // Calculate income and expenses
  const currentIncome = useMemo(() => {
    return calculateTotalIncome(pastSelectedMonthTransactions);
  }, [pastSelectedMonthTransactions]);

  const currentExpenses = useMemo(() => {
    return calculateTotalExpenses(pastSelectedMonthTransactions);
  }, [pastSelectedMonthTransactions]);

  // Calculate net cash flow
  const netCashFlow = currentIncome - currentExpenses;

  // Calculate net worth (assets - debts)
  const totalAssets = useMemo(() => {
    return totalBalance;
  }, [totalBalance]);

  const totalDebts = useMemo(() => {
    let total = 0;

    // Calculate from liabilities
    if (liabilities && liabilities.length > 0) {
      const liabilitiesTotal = liabilities.reduce((sum: number, liability: AccountWithBalance) => {
        const balance = liability.balance ?? null;
        if (balance == null || balance === undefined) {
          return sum;
        }
        let numValue: number;
        if (typeof balance === 'string') {
          numValue = parseFloat(balance);
        } else {
          numValue = Number(balance);
        }
        if (!isNaN(numValue) && isFinite(numValue)) {
          const debtAmount = numValue < 0 ? Math.abs(numValue) : numValue;
          return sum + debtAmount;
        }
        return sum;
      }, 0);
      total += liabilitiesTotal;
    }

    // Calculate from Debt table
    if (debts && debts.length > 0) {
      const debtsTotal = debts.reduce((sum: number, debt: DebtWithCalculations) => {
        if (debt.isPaidOff) {
          return sum;
        }
        const balance = debt.currentBalance ?? null;
        if (balance == null || balance === undefined) {
          return sum;
        }
        let numValue: number;
        if (typeof balance === 'string') {
          numValue = parseFloat(balance);
        } else {
          numValue = Number(balance);
        }
        if (!isNaN(numValue) && isFinite(numValue) && numValue > 0) {
          return sum + numValue;
        }
        return sum;
      }, 0);
      total += debtsTotal;
    }

    return total;
  }, [liabilities, debts]);

  // NET WORTH = Total Assets - Total Debts
  const netWorth = totalAssets - totalDebts;

  return (
    <div>
      <PageHeader
        title="Dashboard"
      />

      <div className="w-full p-4 lg:p-6">
      <div className="py-0 px-0 flex flex-col gap-8">
        <SnapshotSection
        selectedMonthTransactions={pastSelectedMonthTransactions}
        recurringPayments={recurringPayments}
        subscriptions={subscriptions}
        plannedPayments={plannedPayments}
        goals={goals}
        debts={debts}
        financialHealth={financialHealth}
      />

      <CashFlowSection
        income={currentIncome}
        expenses={currentExpenses}
        netCashFlow={netCashFlow}
        selectedMonthDate={selectedMonthDate}
      />

      <PlanningSection
        upcomingTransactions={upcomingTransactions}
        budgets={budgets}
        financialHealth={financialHealth}
      />

      <WealthSection
        netWorth={netWorth}
        totalAssets={totalAssets}
        totalDebts={totalDebts}
        accounts={accounts}
      />
      </div>
      </div>
    </div>
  );
}  