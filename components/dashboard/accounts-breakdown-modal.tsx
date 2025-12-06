"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/components/common/money";
import { Wallet, Building2, CreditCard, PiggyBank, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  householdName?: string | null;
  creditLimit?: number | null;
}

interface AccountsBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  totalBalance: number;
}

export function AccountsBreakdownModal({
  isOpen,
  onClose,
  accounts,
  totalBalance,
}: AccountsBreakdownModalProps) {
  // Group accounts by household
  const accountsByHousehold = accounts.reduce((acc, account) => {
    const household = account.householdName || "Unknown";
    if (!acc[household]) {
      acc[household] = [];
    }
    acc[household].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  // Calculate total per household
  const householdTotals = Object.entries(accountsByHousehold).map(([household, accounts]) => ({
    household,
    accounts,
    total: accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0),
  }));

  // Sort by total balance (descending)
  householdTotals.sort((a, b) => b.total - a.total);

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case "checking":
        return "bg-blue-100 dark:bg-blue-900/30 text-primary border-blue-200 dark:border-blue-800";
      case "savings":
        return "bg-green-100 dark:bg-green-900/30 text-sentiment-positive border-green-200 dark:border-green-800";
      case "credit":
        return "bg-red-100 dark:bg-red-900/30 text-sentiment-negative border-red-200 dark:border-red-800";
      case "investment":
        return "bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary border-primary/20 dark:border-primary/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case "checking":
        return <Wallet className="h-4 w-4" />;
      case "savings":
        return <PiggyBank className="h-4 w-4" />;
      case "credit":
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Accounts Breakdown
          </DialogTitle>
          <DialogDescription>
            Detailed view of all accounts across all households
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
          {/* Total Balance Summary */}
          <div className="rounded-lg border bg-gradient-to-br from-card to-card/50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Balance</p>
                <div className="flex items-center gap-2">
                  {totalBalance >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-sentiment-positive" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-sentiment-negative" />
                  )}
                  <p className={cn(
                    "text-3xl font-bold tabular-nums",
                    totalBalance >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
                  )}>
                    {formatMoney(totalBalance)}
                  </p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Accounts</p>
                <div className="flex items-center justify-end gap-2">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  <p className="text-3xl font-bold tabular-nums">{accounts.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Accounts by Household */}
          {householdTotals.map(({ household, accounts, total }, index) => (
            <div key={household} className="space-y-4">
              {index > 0 && <div className="border-t border-border" />}
              
              <div className="flex items-center justify-between rounded-lg border bg-card/50 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{household}</h3>
                    <p className="text-xs text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Household Total</p>
                  <p className={cn(
                    "text-2xl font-bold tabular-nums",
                    total >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
                  )}>
                    {formatMoney(total)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pl-2">
                {accounts.map((account) => {
                  const isCreditCard = account.type === "credit" && account.creditLimit;
                  const available = isCreditCard 
                    ? (account.creditLimit! + account.balance) 
                    : null;

                  return (
                    <div
                      key={account.id}
                      className="group flex items-center justify-between rounded-lg border bg-background p-4 transition-all hover:border-primary/50 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold capitalize border",
                          getAccountTypeColor(account.type)
                        )}>
                          {getAccountTypeIcon(account.type)}
                          <span>{account.type}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{account.name}</p>
                          {isCreditCard && available !== null && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Available: {formatMoney(available)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className={cn(
                          "text-base font-bold tabular-nums",
                          account.balance >= 0 
                            ? "text-sentiment-positive" 
                            : "text-sentiment-negative"
                        )}>
                          {formatMoney(account.balance)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {accounts.length === 0 && (
            <div className="flex items-center justify-center min-h-[400px] w-full">
              <div className="text-center text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No accounts found</p>
              </div>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

