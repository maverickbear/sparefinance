"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { AnimatedNumber } from "@/components/common/animated-number";
import { AccountsBreakdownModal } from "@/components/dashboard/accounts-breakdown-modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HouseholdMember } from "@/src/domain/members/members.types";
import { convertToMonthlyPayment } from "@/lib/utils/debts";

interface BalanceCardProps {
  totalBalance: number;
  lastMonthTotalBalance: number;
  accounts: any[];
  selectedMemberId?: string | null;
  onMemberChange?: (memberId: string | null) => void;
  householdMembers?: HouseholdMember[];
  isLoadingMembers?: boolean;
  pastSelectedMonthTransactions: any[];
  recurringPayments?: any[];
  subscriptions?: any[];
  plannedPayments?: any[];
  goals?: any[];
  debts?: any[];
}

export function BalanceCard({
  totalBalance,
  lastMonthTotalBalance,
  accounts,
  selectedMemberId = null,
  onMemberChange,
  householdMembers = [],
  isLoadingMembers = false,
  pastSelectedMonthTransactions,
  recurringPayments = [],
  subscriptions = [],
  plannedPayments = [],
  goals = [],
  debts = [],
}: BalanceCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleMemberChange = (value: string) => {
    const memberId = value === "all" ? null : value;
    onMemberChange?.(memberId);
  };

  // Calculate balance change (absolute amount)
  const balanceChange = totalBalance - lastMonthTotalBalance;

  // Calculate current income and expenses
  const currentIncome = pastSelectedMonthTransactions
    .filter((t) => t && t.type === "income")
    .reduce((sum, t) => {
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + amount;
    }, 0);

  const currentExpenses = pastSelectedMonthTransactions
    .filter((t) => t && t.type === "expense")
    .reduce((sum, t) => {
      let amount = 0;
      if (t.amount != null) {
        const parsed = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount);
        amount = isNaN(parsed) ? 0 : parsed;
      }
      return sum + Math.abs(amount);
    }, 0);

  // Calculate total bills (recurring payments + subscriptions)
  const totalBills = recurringPayments
    .filter((rp: any) => rp.type === "expense" && rp.recurring !== false)
    .reduce((sum: number, rp: any) => {
      let monthlyAmount = Math.abs(rp.amount || 0);
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

  // Calculate total goals contributions
  const totalGoalsContributions = goals
    .filter((g: any) => !g.isCompleted && !g.isPaused && g.monthlyContribution)
    .reduce((sum: number, g: any) => sum + (g.monthlyContribution || 0), 0);

  // Calculate total minimum debt payments
  const totalMinimumDebtPayments = debts
    .filter((d: any) => !d.isPaidOff && !d.isPaused)
    .reduce((sum: number, debt: any) => {
      let monthlyPayment = debt.monthlyPayment || 0;
      if (debt.paymentAmount && debt.paymentFrequency) {
        monthlyPayment = convertToMonthlyPayment(
          debt.paymentAmount,
          debt.paymentFrequency as "monthly" | "biweekly" | "weekly" | "semimonthly" | "daily"
        );
      }
      if (debt.additionalContributions && debt.additionalContributionAmount) {
        monthlyPayment += debt.additionalContributionAmount;
      }
      return sum + monthlyPayment;
    }, 0);

  // Calculate Available to Spend
  const availableToSpend = currentIncome - totalBills - totalGoalsContributions - totalMinimumDebtPayments;

  // Check if there are connected accounts
  const hasConnectedAccounts = accounts.some((acc: any) => acc.externalId);

  // Get selected member name
  const selectedMemberName = selectedMemberId
    ? (() => {
      const fullName = householdMembers.find(m => m.memberId === selectedMemberId)?.name || "Unknown";
      return fullName.split(" ")[0];
    })()
    : "All Households";

  return (
    <>
      <Card
        className="bg-primary border-primary cursor-pointer transition-all"
        onClick={() => setIsModalOpen(true)}
      >
        <CardContent className="p-4 md:p-5 flex flex-col h-full min-h-[160px]">
          {/* Household Selector */}
          <div className="flex items-start justify-between mb-4">
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
                  .filter((member) => member.memberId)
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

          {/* Balance Amount Label */}
          <div className="text-foreground text-lg font-semibold mb-1">Total Balance</div>

          {/* Balance Amount */}
          <div className="text-2xl md:text-3xl font-bold mb-2 tabular-nums text-foreground">
            <AnimatedNumber value={totalBalance} format="money" />
          </div>

          {/* Balance Change Tag */}
          {lastMonthTotalBalance !== 0 && (
            <div className="inline-flex items-center text-sm font-medium mb-3 text-foreground">
              {balanceChange >= 0 ? "+" : ""}{formatMoney(balanceChange)} vs last month
            </div>
          )}

          {/* Available to Spend Section */}
          <div>
            <div className="text-foreground text-xs mb-1">Safe to Spend</div>
            <div className="text-lg md:text-xl font-semibold mb-1 tabular-nums text-foreground/90">
              <AnimatedNumber value={availableToSpend} format="money" />
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              After all bills & obligations
            </div>
            {hasConnectedAccounts && (
              <div className="text-[10px] text-foreground mt-2">
                Based on connected accounts
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AccountsBreakdownModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={accounts}
        totalBalance={totalBalance}
      />
    </>
  );
}

