"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import type { AccountWithBalance } from "@/src/domain/accounts/accounts.types";

interface AccountsOverviewWidgetProps {
  accounts: AccountWithBalance[];
  liabilities: AccountWithBalance[];
  debts: Array<{ currentBalance?: number | string | null }>;
}

export function AccountsOverviewWidget({
  accounts,
  liabilities,
  debts,
}: AccountsOverviewWidgetProps) {
  const router = useRouter();

  // Calculate totals by account type
  const accountTotals = useMemo(() => {
    // Bank accounts (checking, savings, etc. - not investment or credit)
    const bankAccounts = accounts.filter(
      acc => acc.type === "checking" || acc.type === "savings" || acc.type === "other"
    );
    const bankTotal = bankAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // Credit cards
    const creditCards = accounts.filter(acc => acc.type === "credit");
    const creditTotal = creditCards.reduce((sum, acc) => {
      const balance = acc.balance || 0;
      return sum + Math.abs(balance); // Credit card balances are negative
    }, 0);

    // Investment accounts
    const investmentAccounts = accounts.filter(
      acc => acc.type === "investment"
    );
    const investmentTotal = investmentAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // Loans (from liabilities and debts)
    const loanTotal = [
      ...liabilities.map(l => Math.abs(l.balance || 0)),
      ...debts.map(d => {
        const balance = d.currentBalance;
        if (typeof balance === "string") return parseFloat(balance) || 0;
        return balance || 0;
      }),
    ].reduce((sum, val) => sum + val, 0);

    return {
      bankAccounts: {
        total: bankTotal,
        count: bankAccounts.length,
        description: bankAccounts.length === 1 
          ? bankAccounts[0].name || "Bank account"
          : `${bankAccounts.length} accounts`,
      },
      creditCards: {
        total: creditTotal,
        count: creditCards.length,
        description: creditCards.length === 1
          ? creditCards[0].name || "Credit card"
          : `${creditCards.length} active cards`,
      },
      investments: {
        total: investmentTotal,
        count: investmentAccounts.length,
        description: investmentAccounts.length === 1
          ? investmentAccounts[0].name || "Investment account"
          : `${investmentAccounts.length} accounts`,
      },
      loans: {
        total: loanTotal,
        count: liabilities.length + debts.length,
        description: (liabilities.length + debts.length) === 1
          ? "Loan"
          : `${liabilities.length + debts.length} loans`,
      },
    };
  }, [accounts, liabilities, debts]);

  const accountItems = [
    {
      name: "Bank accounts",
      description: accountTotals.bankAccounts.description,
      value: accountTotals.bankAccounts.total,
      isPositive: true,
    },
    {
      name: "Credit cards",
      description: accountTotals.creditCards.description,
      value: accountTotals.creditCards.total,
      isPositive: false,
    },
    {
      name: "Investment accounts",
      description: accountTotals.investments.description,
      value: accountTotals.investments.total,
      isPositive: true,
    },
    {
      name: "Loans",
      description: accountTotals.loans.description,
      value: accountTotals.loans.total,
      isPositive: false,
    },
  ].filter(item => item.value > 0 || item.name === "Bank accounts" || item.name === "Credit cards");

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Accounts at a glance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {accountItems.map((item, index) => (
            <div key={index} className="flex items-baseline justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{item.name}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
              <div className={cn(
                "text-sm font-semibold tabular-nums flex-shrink-0",
                item.isPositive ? "text-sentiment-positive" : "text-sentiment-negative"
              )}>
                {item.isPositive ? "" : "-"}{formatMoney(Math.abs(item.value))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={() => router.push("/accounts")}
            className="text-xs text-content-link hover:underline cursor-pointer"
          >
            Manage accounts
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

