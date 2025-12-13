"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, Check, X } from "lucide-react";
import type { Plan, PlanFeatures } from "@/src/domain/subscriptions/subscriptions.validations";
import { formatMoney } from "@/components/common/money";

interface PlansTableProps {
  plans: Plan[];
  loading?: boolean;
  onEdit: (plan: Plan) => void;
}

export function PlansTable({
  plans: initialPlans,
  loading: initialLoading,
  onEdit,
}: PlansTableProps) {
  // Use props directly instead of state to avoid sync issues
  const plans = initialPlans;
  const loading = initialLoading;

  const formatFeatures = (features: PlanFeatures) => {
    const featureList: string[] = [];
    
    if (features.maxTransactions === -1) {
      featureList.push("Unlimited transactions");
    } else {
      featureList.push(`${features.maxTransactions} transactions/month`);
    }
    
    if (features.maxAccounts === -1) {
      featureList.push("Unlimited accounts");
    } else {
      featureList.push(`${features.maxAccounts} accounts`);
    }
    
    if (features.hasInvestments) featureList.push("Investment tracking");
    if (features.hasAdvancedReports) featureList.push("Advanced reports");
    if (features.hasCsvExport) featureList.push("CSV export");
    if (features.hasCsvImport) featureList.push("CSV import");
    if (features.hasDebts) featureList.push("Debt tracking");
    if (features.hasGoals) featureList.push("Goals tracking");
    if (features.hasBankIntegration) featureList.push("Bank integration");
    if (features.hasHousehold) featureList.push("Household members");
    if (features.hasBudgets) featureList.push("Budgets");
    if (features.hasReceiptScanner) featureList.push("Receipt scanner");
    
    return featureList;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No plans found
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead>Price (Monthly)</TableHead>
            <TableHead>Price (Yearly)</TableHead>
            <TableHead>Limits</TableHead>
            <TableHead>Features</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => {
            const features = formatFeatures(plan.features);
            return (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{plan.name}</span>
                    <Badge variant="outline">{plan.id}</Badge>
                  </div>
                </TableCell>
                <TableCell>
                  {formatMoney(plan.priceMonthly)}
                </TableCell>
                <TableCell>
                  {formatMoney(plan.priceYearly)}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {plan.features.maxTransactions === -1 ? (
                      <div className="text-sm">Unlimited transactions</div>
                    ) : (
                      <div className="text-sm">{plan.features.maxTransactions} transactions/month</div>
                    )}
                    {plan.features.maxAccounts === -1 ? (
                      <div className="text-sm">Unlimited accounts</div>
                    ) : (
                      <div className="text-sm">{plan.features.maxAccounts} accounts</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {features.slice(2).map((feature, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="medium"
                    onClick={() => onEdit(plan)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

