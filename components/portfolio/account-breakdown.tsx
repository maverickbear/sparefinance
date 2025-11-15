"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { Account } from "@/lib/api/portfolio";
import { Wallet } from "lucide-react";

interface AccountBreakdownProps {
  accounts: Account[];
}

export function AccountBreakdown({ accounts }: AccountBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {accounts.map((account) => (
            <div key={account.id} className="flex flex-col p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                <div>
                  <div className="font-semibold">{account.name}</div>
                  <div className="text-sm text-muted-foreground">{account.type}</div>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="font-semibold">{formatMoney(account.value)}</div>
                <div className="text-sm text-muted-foreground">
                  {account.allocationPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

