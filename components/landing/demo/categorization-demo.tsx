"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";

// Mock data for categorized transactions
const mockTransactions = [
  {
    id: "1",
    description: "Starbucks Coffee",
    amount: 5.50,
    category: "Food & Dining",
    confidence: 95,
    status: "auto" as const,
  },
  {
    id: "2",
    description: "Uber Ride",
    amount: 12.75,
    category: "Transportation",
    confidence: 98,
    status: "auto" as const,
  },
  {
    id: "3",
    description: "Amazon Purchase",
    amount: 89.99,
    category: "Shopping",
    confidence: 92,
    status: "auto" as const,
  },
  {
    id: "4",
    description: "Netflix Subscription",
    amount: 15.99,
    category: "Entertainment",
    confidence: 99,
    status: "auto" as const,
  },
];

export function CategorizationDemo() {
  return (
    <div className="space-y-4 pointer-events-none">
      {mockTransactions.map((transaction) => (
        <Card key={transaction.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg mb-2">
                  {transaction.description}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {transaction.category}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {transaction.confidence}% confidence
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatMoney(transaction.amount)}</span>
              <span className="text-xs text-muted-foreground">Auto-categorized</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

