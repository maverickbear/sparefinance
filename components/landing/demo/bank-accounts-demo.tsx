"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { RefreshCw, Unlink, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data
const mockAccounts = [
  {
    id: "1",
    name: "Chase Checking",
    institutionName: "Chase Bank",
    type: "checking",
    balance: 12500,
    isConnected: true,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Chase Savings",
    institutionName: "Chase Bank",
    type: "savings",
    balance: 25000,
    isConnected: true,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Chase Credit Card",
    institutionName: "Chase Bank",
    type: "credit",
    balance: -1250,
    creditLimit: 10000,
    isConnected: true,
    lastSyncedAt: new Date().toISOString(),
  },
];

export function BankAccountsDemo() {
  return (
    <div className="space-y-4 pointer-events-none">
        {mockAccounts.map((account) => {
          const isCreditCard = account.type === "credit" && account.creditLimit;
          const available = isCreditCard 
            ? (account.creditLimit! + account.balance) 
            : null;
          
          return (
            <Card key={account.id} className="transition-all">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base font-semibold truncate">{account.name}</CardTitle>
                      {account.institutionName && (
                        <p className="text-xs text-muted-foreground truncate">{account.institutionName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Sync transactions"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                      title="Disconnect account"
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {account.type}
                  </Badge>
                  {account.isConnected && (
                    <Badge variant="default" className="bg-green-600 dark:bg-green-500 text-white text-xs">
                      Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Balance</div>
                    <div className={cn(
                      "text-2xl font-bold",
                      account.balance >= 0 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-red-600 dark:text-red-400"
                    )}>
                      {formatMoney(account.balance)}
                    </div>
                  </div>
                  {isCreditCard && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Credit Limit</div>
                        <div className="text-sm font-semibold">
                          {formatMoney(account.creditLimit!)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Available</div>
                        <div className={cn(
                          "text-sm font-semibold",
                          available !== null && available >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}>
                          {available !== null ? formatMoney(available) : "-"}
                        </div>
                      </div>
                    </div>
                  )}
                  {account.isConnected && account.lastSyncedAt && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Last synced: Just now
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}

