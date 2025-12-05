"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { AnimatedNumber } from "@/components/common/animated-number";
import { ArrowUpRight, ArrowDownRight, PiggyBank } from "lucide-react";
import { AccountsBreakdownModal } from "@/components/dashboard/accounts-breakdown-modal";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HouseholdMember } from "@/src/domain/members/members.types";
import { Badge } from "@/components/ui/badge";
import { formatExpectedIncomeRange, formatMonthlyIncomeFromRange } from "@/src/presentation/utils/format-expected-income";
import { convertToMonthlyPayment } from "@/lib/utils/debts";

interface SummaryCardsProps {
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
  savings: number;
  totalBalance: number;
  lastMonthTotalBalance: number;
  accounts: any[];
  selectedMemberId?: string | null;
  onMemberChange?: (memberId: string | null) => void;
  householdMembers?: HouseholdMember[];
  isLoadingMembers?: boolean;
  financialHealth?: any;
  expectedIncomeRange?: string | null;
  recurringPayments?: any[];
  subscriptions?: any[];
  goals?: any[];
  debts?: any[];
}

export function SummaryCards({ 
  selectedMonthTransactions, 
  lastMonthTransactions, 
  savings,
  totalBalance,
  lastMonthTotalBalance,
  accounts,
  selectedMemberId = null,
  onMemberChange,
  householdMembers = [],
  isLoadingMembers = false,
  financialHealth,
  expectedIncomeRange,
  recurringPayments = [],
  subscriptions = [],
  goals = [],
  debts = [],
}: SummaryCardsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Get selected month from URL or use current month (same logic as MonthSelector)
  const monthParam = searchParams.get("month");
  const selectedMonth = monthParam 
    ? (() => {
        // Parse YYYY-MM-DD format and create date in local timezone
        const [year, month, day] = monthParam.split('-').map(Number);
        return startOfMonth(new Date(year, month - 1, day));
      })()
    : startOfMonth(new Date());
  
  // Calculate start and end dates for the selected month
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const startDateStr = format(monthStart, "yyyy-MM-dd");
  const endDateStr = format(monthEnd, "yyyy-MM-dd");
  
  // Get today's date (without time)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleMemberChange = (value: string) => {
    const memberId = value === "all" ? null : value;
    onMemberChange?.(memberId);
  };

  // Transactions are already filtered by household member and date in FinancialOverviewPage
  // So we can use them directly for calculations
  const pastTransactions = selectedMonthTransactions;
  const pastLastMonthTransactions = lastMonthTransactions;

  const currentIncome = pastTransactions
    .filter((t) => t && t.type === "income")
    .reduce((sum, t) => {
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  const currentExpenses = pastTransactions
    .filter((t) => t && t.type === "expense")
    .reduce((sum, t) => {
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  const lastMonthIncome = pastLastMonthTransactions
    .filter((t) => t && t.type === "income")
    .reduce((sum, t) => {
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  const lastMonthExpenses = pastLastMonthTransactions
    .filter((t) => t && t.type === "expense")
    .reduce((sum, t) => {
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  const incomeMomChange = lastMonthIncome > 0
    ? ((currentIncome - lastMonthIncome) / lastMonthIncome) * 100
    : 0;

  const expensesMomChange = lastMonthExpenses > 0
    ? ((currentExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : 0;

  // Calculate monthly savings (income - expenses) for current month
  const monthlySavings = currentIncome - currentExpenses;
  
  // Calculate monthly savings for last month
  const lastMonthSavings = lastMonthIncome - lastMonthExpenses;
  
  // Calculate savings change percentage
  const savingsChange = lastMonthSavings !== 0
    ? ((monthlySavings - lastMonthSavings) / Math.abs(lastMonthSavings)) * 100
    : 0;

  // Calculate balance change (absolute amount)
  const balanceChange = totalBalance - lastMonthTotalBalance;

  // Calculate balance change percentage
  const balanceChangePercentage = lastMonthTotalBalance !== 0
    ? ((totalBalance - lastMonthTotalBalance) / Math.abs(lastMonthTotalBalance)) * 100
    : 0;

  // Check if income/expenses are projected (based on expected income)
  // If financialHealth.isProjected is true, it means we're using projected values
  const isIncomeProjected = financialHealth?.isProjected && expectedIncomeRange;
  const isExpenseProjected = financialHealth?.isProjected;

  // Get selected member name or "All Households"
  const selectedMemberName = selectedMemberId 
    ? (() => {
        const fullName = householdMembers.find(m => m.memberId === selectedMemberId)?.name || "Unknown";
        // Extract only the first name
        return fullName.split(" ")[0];
      })()
    : "All Households";

  // Calculate total bills (recurring payments + subscriptions) for current month
  // Recurring payments are transactions marked as recurring - we'll sum their amounts
  // Note: These are typically already monthly values, but we check for frequency if available
  const totalBills = recurringPayments
    .filter((rp: any) => rp.type === "expense" && rp.recurring !== false)
    .reduce((sum: number, rp: any) => {
      let monthlyAmount = Math.abs(rp.amount || 0);
      // Convert to monthly equivalent if frequency is available
      if (rp.recurringFrequency) {
        switch (rp.recurringFrequency) {
          case "weekly":
            monthlyAmount = Math.abs(rp.amount || 0) * 4.33;
            break;
          case "biweekly":
            monthlyAmount = Math.abs(rp.amount || 0) * 2.17;
            break;
          case "semimonthly":
            monthlyAmount = Math.abs(rp.amount || 0) * 2;
            break;
          case "daily":
            monthlyAmount = Math.abs(rp.amount || 0) * 30;
            break;
          default:
            monthlyAmount = Math.abs(rp.amount || 0);
        }
      }
      return sum + monthlyAmount;
    }, 0) +
    subscriptions
      .filter((s: any) => s.isActive)
      .reduce((sum: number, sub: any) => {
        let monthlyAmount = sub.amount || 0;
        // Convert to monthly equivalent
        switch (sub.billingFrequency) {
          case "weekly":
            monthlyAmount = (sub.amount || 0) * 4.33;
            break;
          case "biweekly":
            monthlyAmount = (sub.amount || 0) * 2.17;
            break;
          case "semimonthly":
            monthlyAmount = (sub.amount || 0) * 2;
            break;
          case "daily":
            monthlyAmount = (sub.amount || 0) * 30;
            break;
          default:
            monthlyAmount = sub.amount || 0;
        }
        return sum + monthlyAmount;
      }, 0);

  // Calculate total goals contributions (monthlyContribution from active, non-paused goals)
  const totalGoalsContributions = goals
    .filter((g: any) => !g.isCompleted && !g.isPaused && g.monthlyContribution)
    .reduce((sum: number, g: any) => sum + (g.monthlyContribution || 0), 0);

  // Calculate total minimum debt payments
  const totalMinimumDebtPayments = debts
    .filter((d: any) => !d.isPaidOff && !d.isPaused)
    .reduce((sum: number, debt: any) => {
      let monthlyPayment = debt.monthlyPayment || 0;
      // Use paymentAmount with frequency if available, otherwise use monthlyPayment
      if (debt.paymentAmount && debt.paymentFrequency) {
        monthlyPayment = convertToMonthlyPayment(
          debt.paymentAmount,
          debt.paymentFrequency as "monthly" | "biweekly" | "weekly" | "semimonthly" | "daily"
        );
      }
      // Add additional contributions if any
      if (debt.additionalContributions && debt.additionalContributionAmount) {
        monthlyPayment += debt.additionalContributionAmount;
      }
      return sum + monthlyPayment;
    }, 0);

  // Calculate Available to Spend = Income - Bills - Goals - Minimum Debt Payments
  const availableToSpend = currentIncome - totalBills - totalGoalsContributions - totalMinimumDebtPayments;

  // Calculate last month's available to spend for comparison
  // Note: We'll use the same bills/goals/debts for last month (they're typically consistent month-to-month)
  // In a more sophisticated implementation, we could calculate based on last month's actual data
  const lastMonthAvailableToSpend = lastMonthIncome - totalBills - totalGoalsContributions - totalMinimumDebtPayments;
  const availableToSpendChange = availableToSpend - lastMonthAvailableToSpend;

  // Check if there are connected accounts (accounts with plaidItemId or externalId)
  const hasConnectedAccounts = accounts.some((acc: any) => acc.plaidItemId || acc.externalId);

  return (
    <>
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Primary Color Card - Left Side */}
        <Card 
          className="md:col-span-1 bg-primary border-primary cursor-pointer transition-all"
          onClick={() => setIsModalOpen(true)}
        >
          <CardContent className="p-4 md:p-5 flex flex-col h-full min-h-[160px]">
            {/* Logo and Household Selector */}
            <div className="flex items-start justify-between mb-4">
              {/* Household Selector */}
              <Select
                value={selectedMemberId || "all"}
                onValueChange={handleMemberChange}
              >
                <SelectTrigger className="!w-auto inline-flex bg-transparent border-0 text-accent-foreground hover:text-accent-foreground/80 hover:bg-accent-foreground/10 h-auto px-2 py-1 text-xs font-normal shadow-none focus:ring-0 focus:ring-offset-0 rounded transition-colors">
                  <SelectValue>
                    {isLoadingMembers ? "Loading..." : selectedMemberName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Households</SelectItem>
                  {householdMembers
                    .filter((member) => member.memberId) // Only show members with memberId (accepted invitations)
                    .map((member) => {
                      const fullName = member.name || member.email;
                      const firstName = fullName.split(" ")[0];
                      return (
                        <SelectItem key={member.id} value={member.memberId!}>
                          {firstName}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            {/* Balance Amount Label - Use content.secondary for labels (accent-foreground provides contrast on green background) */}
            <div className="text-accent-foreground/80 text-lg font-semibold mb-1">Balance Amount</div>

            {/* Balance Amount - Use content.primary to emphasise primary content (accent-foreground provides contrast on green background) */}
            <div className="text-2xl md:text-3xl font-bold mb-2 tabular-nums text-accent-foreground">
              <AnimatedNumber value={totalBalance} format="money" />
            </div>

            {/* Balance Change Tag - Use content.secondary for supportive text */}
            {lastMonthTotalBalance !== 0 && (
              <div className={cn(
                "inline-flex items-center text-sm font-medium mb-3 text-accent-foreground/80"
              )}>
                {balanceChange >= 0 ? "+" : ""}{formatMoney(balanceChange)} vs last month
              </div>
            )}

            {/* Available to Spend Section */}
            <div>
              {/* Label - Use content.secondary for labels */}
              <div className="text-accent-foreground/80 text-xs mb-1">Available to spend</div>
              {/* Amount - Use content.primary to emphasise primary content */}
              <div className="text-xl md:text-2xl font-bold mb-1 tabular-nums text-accent-foreground">
                <AnimatedNumber value={availableToSpend} format="money" />
              </div>
              {/* Description - Use content.secondary for supportive text */}
              <div className="text-sm text-accent-foreground/70 mb-2">
                after bills, goals & minimum debt
              </div>
              {hasConnectedAccounts && (
                <div className="text-[10px] text-accent-foreground/60 mt-2">
                  Based on connected accounts
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Income Card */}
        <Card className="cursor-pointer" onClick={() => {
            router.push(`/transactions?type=income&startDate=${startDateStr}&endDate=${endDateStr}`);
          }}>
            <CardContent className="p-4 md:p-5">
              <div className="flex flex-col items-start gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <ArrowUpRight className="h-4 w-4 text-foreground" />
                </div>
                <div className="text-lg font-semibold">Monthly Income</div>
              </div>
              
              {/* Amount */}
              <div className="text-xl md:text-2xl font-bold mb-2 tabular-nums">
                <AnimatedNumber value={currentIncome} format="money" />
              </div>

              {/* Projected Badge */}
              {isIncomeProjected && expectedIncomeRange && (
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-4">
                    Projected
                  </Badge>
                </div>
              )}
              {isIncomeProjected && expectedIncomeRange && (
                <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                  <div>Based on {formatExpectedIncomeRange(expectedIncomeRange)}</div>
                  <div className="font-medium">
                    {formatMonthlyIncomeFromRange(expectedIncomeRange)}/month
                  </div>
                </div>
              )}

              {/* Percentage Change Tag - Moved below projected info */}
              <div className="text-sm font-medium mb-1">
                <span className={cn(
                  incomeMomChange >= 0 
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}>
                  {incomeMomChange >= 0 ? "+" : ""}{incomeMomChange.toFixed(2)}%
                </span>
                <span className="text-grey-300"> vs last month</span>
              </div>
            </CardContent>
          </Card>

        {/* Total Expense Card */}
        <Card className="cursor-pointer" onClick={() => {
            router.push(`/transactions?type=expense&startDate=${startDateStr}&endDate=${endDateStr}`);
          }}>
            <CardContent className="p-4 md:p-5">
              <div className="flex flex-col items-start gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <ArrowDownRight className="h-4 w-4 text-foreground" />
                </div>
                <div className="text-lg font-semibold">Monthly Expense</div>
              </div>
              
              {/* Amount */}
              <div className="text-xl md:text-2xl font-bold mb-2 tabular-nums">
                <AnimatedNumber value={currentExpenses} format="money" />
              </div>

              {/* Percentage Change Tag */}
              <div className="text-sm font-medium mb-1">
                <span className={cn(
                  expensesMomChange >= 0 
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                )}>
                  {expensesMomChange >= 0 ? "+" : ""}{expensesMomChange.toFixed(2)}%
                </span>
                <span className="text-grey-300"> vs last month</span>
              </div>

              {/* Projected Badge */}
              {isExpenseProjected && (
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-4">
                    Projected
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

        {/* Monthly Savings Card */}
        <Card className="cursor-pointer">
            <CardContent className="p-4 md:p-5">
              <div className="flex flex-col items-start gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <PiggyBank className="h-4 w-4 text-foreground" />
                </div>
                <div className="text-lg font-semibold">Monthly Savings</div>
              </div>
              
              {/* Amount */}
              <div className="text-xl md:text-2xl font-bold mb-2 tabular-nums">
                <AnimatedNumber value={monthlySavings} format="money" />
              </div>

              {/* Percentage Change Tag */}
              <div className="text-sm font-medium mb-1">
                <span className={cn(
                  savingsChange >= 0 
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}>
                  {savingsChange >= 0 ? "+" : ""}{savingsChange.toFixed(2)}%
                </span>
                <span className="text-grey-300"> vs last month</span>
              </div>
            </CardContent>
          </Card>
      </div>

      <AccountsBreakdownModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={accounts}
        totalBalance={totalBalance}
      />
    </>
  );
}
