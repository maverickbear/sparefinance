"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plan } from "@/lib/validations/plan";
import { Check, Star } from "lucide-react";
import { useState } from "react";

interface PlanSelectorProps {
  plans: Plan[];
  currentPlanId?: string;
  onSelectPlan: (planId: string, interval: "month" | "year") => void;
  loading?: boolean;
  showComparison?: boolean;
}

export function PlanSelector({ plans, currentPlanId, onSelectPlan, loading, showComparison = false }: PlanSelectorProps) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const sortedPlans = [...plans].sort((a, b) => {
    const order = { free: 0, basic: 1, premium: 2 };
    return (order[a.name] || 0) - (order[b.name] || 0);
  });

  // Only show interval selector for paid plans
  const hasPaidPlans = sortedPlans.some(p => p.priceMonthly > 0);

  return (
    <div className="space-y-6">
      {hasPaidPlans && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-[12px] border p-1 bg-muted">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={`px-4 py-2 rounded-[12px] text-sm font-medium transition-colors ${
                interval === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={`px-4 py-2 rounded-[12px] text-sm font-medium transition-colors flex items-center gap-2 ${
                interval === "year"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5 py-0 h-4 font-semibold">
                10% OFF
              </Badge>
            </button>
          </div>
        </div>
      )}

      {showComparison ? (
        // Comparison table view
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Features</th>
                  {sortedPlans.map((plan) => (
                    <th key={plan.id} className="px-6 py-3 text-center text-sm font-semibold text-foreground">
                      {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground">Price</td>
                  {sortedPlans.map((plan) => {
                    const monthlyPrice = plan.priceMonthly;
                    const yearlyPrice = plan.priceYearly;
                    const hasDiscount = interval === "year" && yearlyPrice > 0;
                    const discountedPrice = hasDiscount ? yearlyPrice * 0.9 : yearlyPrice;
                    const price = interval === "month" ? monthlyPrice : discountedPrice;
                    const originalYearlyPrice = interval === "year" && yearlyPrice > 0 ? yearlyPrice : null;
                    return (
                      <td key={plan.id} className="px-6 py-4 text-center text-sm">
                        {hasDiscount && originalYearlyPrice && (
                          <div className="mb-1">
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs mb-1">
                              10% OFF
                            </Badge>
                            <div>
                              <span className="text-muted-foreground text-xs line-through mr-1">
                                ${originalYearlyPrice.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                        <span className="text-2xl font-bold">
                          {price === 0 ? "Free" : `$${price.toFixed(2)}`}
                        </span>
                        {price > 0 && (
                          <span className="text-muted-foreground text-xs block">
                            /{interval === "month" ? "month" : "year"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground">Transactions</td>
                  {sortedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center text-sm">
                      {plan.features.maxTransactions === -1 ? "Unlimited" : plan.features.maxTransactions}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground">Accounts</td>
                  {sortedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center text-sm">
                      {plan.features.maxAccounts === -1 ? "Unlimited" : plan.features.maxAccounts}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground">Investments</td>
                  {sortedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center">
                      {plan.features.hasInvestments ? (
                        <Check className="h-5 w-5 text-primary mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground">Advanced Reports</td>
                  {sortedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center">
                      {plan.features.hasAdvancedReports ? (
                        <Check className="h-5 w-5 text-primary mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground">CSV Export</td>
                  {sortedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center">
                      {plan.features.hasCsvExport ? (
                        <Check className="h-5 w-5 text-primary mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground">Debts Tracking</td>
                  {sortedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center">
                      {plan.features.hasDebts ? (
                        <Check className="h-5 w-5 text-primary mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground">Goals Tracking</td>
                  {sortedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center">
                      {plan.features.hasGoals ? (
                        <Check className="h-5 w-5 text-primary mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-foreground">Household Members</td>
                  {sortedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center">
                      {plan.name !== "free" ? (
                        <Check className="h-5 w-5 text-primary mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4"></td>
                  {sortedPlans.map((plan) => {
                    const price = interval === "month" ? plan.priceMonthly : plan.priceYearly;
                    const isCurrent = plan.id === currentPlanId;
                    return (
                      <td key={plan.id} className="px-6 py-4">
                        <Button
                          className="w-full"
                          variant={plan.name === "premium" ? "default" : "outline"}
                          disabled={isCurrent || loading}
                          onClick={() => onSelectPlan(plan.id, interval)}
                        >
                          {isCurrent ? "Current Plan" : price === 0 ? "Get Started" : "Upgrade"}
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Card view
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sortedPlans.map((plan) => {
            const monthlyPrice = plan.priceMonthly;
            const yearlyPrice = plan.priceYearly;
            const hasDiscount = interval === "year" && yearlyPrice > 0;
            const discountedPrice = hasDiscount ? yearlyPrice * 0.9 : yearlyPrice;
            const price = interval === "month" ? monthlyPrice : discountedPrice;
            const originalYearlyPrice = interval === "year" && yearlyPrice > 0 ? yearlyPrice : null;
            const isCurrent = plan.id === currentPlanId;
            
            // Simplified key features only
            const keyFeatures = [];
            if (plan.features.maxTransactions === -1) {
              keyFeatures.push("Unlimited transactions");
            } else if (plan.features.maxTransactions > 0) {
              keyFeatures.push(`${plan.features.maxTransactions} transactions`);
            }
            if (plan.features.maxAccounts === -1) {
              keyFeatures.push("Unlimited accounts");
            } else if (plan.features.maxAccounts > 0) {
              keyFeatures.push(`${plan.features.maxAccounts} accounts`);
            }
            if (plan.name !== "free") {
              keyFeatures.push("All features");
            }

            const isPopular = plan.name === "basic";
            const isPremium = plan.name === "premium";
            
            return (
              <Card 
                key={plan.id} 
                className={`relative transition-all ${
                  isCurrent 
                    ? "border-primary ring-2 ring-primary/20" 
                    : isPopular 
                      ? "border-primary/50" 
                      : ""
                } ${isCurrent ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
              >
                {isCurrent && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">
                      Current
                    </Badge>
                  </div>
                )}
                {isPopular && !isCurrent && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary/10 text-primary px-2 py-0.5 text-xs flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pt-6 pb-4">
                  <CardTitle className="text-xl mb-1">
                    {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                  </CardTitle>
                  <div className="mt-4">
                    {hasDiscount && originalYearlyPrice && (
                      <div className="mb-2">
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs mb-1">
                          10% OFF
                        </Badge>
                      </div>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        {price === 0 ? "Free" : `$${price.toFixed(2)}`}
                      </span>
                      {price > 0 && (
                        <span className="text-muted-foreground text-sm">
                          /{interval === "month" ? "mo" : "yr"}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <ul className="space-y-2">
                    {keyFeatures.slice(0, 3).map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-4">
                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : isPopular ? "default" : "outline"}
                    disabled={isCurrent || loading}
                    onClick={() => onSelectPlan(plan.id, interval)}
                  >
                    {isCurrent ? "Current" : price === 0 ? "Get Started" : "Upgrade"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

