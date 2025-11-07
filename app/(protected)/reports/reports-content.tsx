"use client";

import { formatMoney } from "@/components/common/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { PlanFeatures } from "@/lib/validations/plan";
import { FeatureGuard } from "@/components/common/feature-guard";
import type { Budget } from "@/lib/api/budgets";
import type { Transaction } from "@/lib/api/transactions-client";

interface ReportsContentProps {
  limits: PlanFeatures;
  budgets: Budget[];
  transactions: Transaction[];
  now: Date;
}

export function ReportsContent({ limits, budgets, transactions, now }: ReportsContentProps) {
  const currentMonth = startOfMonth(now);
  const endDate = endOfMonth(now);

  // Monthly Summary
  const expensesByCategory = transactions
    .filter((t) => t.type === "expense" && t.category)
    .reduce((acc, t) => {
      const catId = t.categoryId!;
      if (!acc[catId]) {
        acc[catId] = {
          name: t.category!.name,
          actual: 0,
          budget: 0,
        };
      }
      acc[catId].actual += t.amount;
      return acc;
    }, {} as Record<string, { name: string; actual: number; budget: number }>);

  // Merge with budgets
  budgets.forEach((budget) => {
    if (expensesByCategory[budget.categoryId]) {
      expensesByCategory[budget.categoryId].budget = budget.amount;
    }
  });

  // Top 10 expenses
  const topExpenses = transactions
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Reports</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Monthly summary and expense analysis for {format(now, "MMMM yyyy")}
        </p>
      </div>

      {/* Monthly Summary - Available for all plans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-[12px] border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs md:text-sm">Category</TableHead>
                  <TableHead className="text-right text-xs md:text-sm">Budget</TableHead>
                  <TableHead className="text-right text-xs md:text-sm">Actual</TableHead>
                  <TableHead className="text-right text-xs md:text-sm hidden md:table-cell">Difference</TableHead>
                  <TableHead className="text-right text-xs md:text-sm">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Object.values(expensesByCategory) as Array<{ name: string; actual: number; budget: number }>).map((item) => {
                  const difference = item.actual - item.budget;
                  const percentage = item.budget > 0 ? (item.actual / item.budget) * 100 : 0;

                  return (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium text-xs md:text-sm">{item.name}</TableCell>
                      <TableCell className="text-right text-xs md:text-sm">{formatMoney(item.budget)}</TableCell>
                      <TableCell className="text-right text-xs md:text-sm">{formatMoney(item.actual)}</TableCell>
                      <TableCell className={`text-right font-medium text-xs md:text-sm hidden md:table-cell ${
                        difference >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                      }`}>
                        {difference >= 0 ? "+" : ""}{formatMoney(difference)}
                      </TableCell>
                      <TableCell className={`text-right font-medium text-xs md:text-sm ${
                        percentage > 100 ? "text-red-600 dark:text-red-400" :
                        percentage > 90 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
                      }`}>
                        {percentage.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Top 10 Expenses - Advanced feature */}
      <FeatureGuard feature="hasAdvancedReports" featureName="Advanced Reports">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Top 10 Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-[12px] border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Date</TableHead>
                    <TableHead className="text-xs md:text-sm hidden md:table-cell">Description</TableHead>
                    <TableHead className="text-xs md:text-sm">Category</TableHead>
                    <TableHead className="text-xs md:text-sm hidden sm:table-cell">Account</TableHead>
                    <TableHead className="text-right text-xs md:text-sm">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topExpenses.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs md:text-sm whitespace-nowrap">{format(new Date(tx.date), "MMM dd, yyyy")}</TableCell>
                      <TableCell className="text-xs md:text-sm hidden md:table-cell max-w-[150px] truncate">{tx.description || "-"}</TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {tx.category?.name}
                        {tx.subcategory && ` / ${tx.subcategory.name}`}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm hidden sm:table-cell">{tx.account?.name}</TableCell>
                      <TableCell className="text-right font-medium text-red-600 dark:text-red-400 text-xs md:text-sm">
                        {formatMoney(tx.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topExpenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No expenses found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FeatureGuard>
    </div>
  );
}

