"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/components/common/money";
import { Wallet, Building2 } from "lucide-react";
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
        return "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400";
      case "savings":
        return "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400";
      case "credit":
        return "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400";
      case "investment":
        return "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary";
      default:
        return "bg-grey-100 dark:bg-grey-900/20 text-grey-700 dark:text-grey-400";
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

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
          {/* Total Balance Summary */}
          <div className="p-6 rounded-[12px] bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                <p className={cn(
                  "text-2xl font-semibold",
                  totalBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {formatMoney(totalBalance)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Total Accounts</p>
                <p className="text-2xl font-semibold">{accounts.length}</p>
              </div>
            </div>
          </div>

          {/* Accounts by Household */}
          {householdTotals.map(({ household, accounts, total }) => (
            <div key={household} className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-[12px] bg-card">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">{household}</h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Household Total</p>
                  <p className={cn(
                    "text-2xl font-semibold",
                    total >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {formatMoney(total)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pl-4">
                {accounts.map((account) => {
                  const isCreditCard = account.type === "credit" && account.creditLimit;
                  const available = isCreditCard 
                    ? (account.creditLimit! + account.balance) 
                    : null;

                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 rounded-[12px] border bg-muted/50"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-xs font-medium capitalize",
                          getAccountTypeColor(account.type)
                        )}>
                          {account.type}
                        </span>
                        <span className="font-medium text-sm">{account.name}</span>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-sm font-semibold",
                          account.balance >= 0 
                            ? "text-green-600 dark:text-green-400" 
                            : "text-red-600 dark:text-red-400"
                        )}>
                          {formatMoney(account.balance)}
                        </p>
                        {isCreditCard && available !== null && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Available: {formatMoney(available)}
                          </p>
                        )}
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

