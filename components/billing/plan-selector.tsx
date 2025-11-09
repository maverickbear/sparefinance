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
  isPublic?: boolean; // If true, shows "Get {plantype}" instead of "Get Started" or "Upgrade"
}

export function PlanSelector({ plans, currentPlanId, onSelectPlan, loading, showComparison = false, isPublic = false }: PlanSelectorProps) {
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
                  <td className="px-6 py-4 text-sm text-foreground">Bank Integration</td>
                  {sortedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center">
                      {plan.features.hasBankIntegration ? (
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
                          {isCurrent 
                            ? "Current Plan" 
                            : isPublic 
                              ? `Get ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} Plan`
                              : price === 0 
                                ? "Get Started" 
                                : "Upgrade"}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sortedPlans.map((plan) => {
            const monthlyPrice = plan.priceMonthly;
            const yearlyPrice = plan.priceYearly;
            const hasDiscount = interval === "year" && yearlyPrice > 0;
            const discountedPrice = hasDiscount ? yearlyPrice * 0.9 : yearlyPrice;
            const price = interval === "month" ? monthlyPrice : discountedPrice;
            const originalYearlyPrice = interval === "year" && yearlyPrice > 0 ? yearlyPrice : null;
            const isCurrent = plan.id === currentPlanId;
            
            // All features
            const allFeatures = [];
            
            // Transactions
            if (plan.features.maxTransactions === -1) {
              allFeatures.push("Unlimited transactions");
            } else if (plan.features.maxTransactions > 0) {
              allFeatures.push(`${plan.features.maxTransactions} transactions/month`);
            }
            
            // Accounts
            if (plan.features.maxAccounts === -1) {
              allFeatures.push("Unlimited accounts");
            } else if (plan.features.maxAccounts > 0) {
              allFeatures.push(`${plan.features.maxAccounts} accounts`);
            }
            
            // Investments
            if (plan.features.hasInvestments) {
              allFeatures.push("Investment tracking");
            }
            
            // Advanced Reports
            if (plan.features.hasAdvancedReports) {
              allFeatures.push("Advanced reports");
            }
            
            // CSV Export
            if (plan.features.hasCsvExport) {
              allFeatures.push("CSV export");
            }
            
            // Debts
            if (plan.features.hasDebts) {
              allFeatures.push("Debt tracking");
            }
            
            // Goals
            if (plan.features.hasGoals) {
              allFeatures.push("Goals tracking");
            }
            
            // Household Members
            if (plan.name !== "free") {
              allFeatures.push("Household members");
            }

            // Bank Integration
            if (plan.features.hasBankIntegration) {
              allFeatures.push("Bank account integration");
            }

            const isPopular = plan.name === "basic";
            const isPremium = plan.name === "premium";
            const isFree = plan.name === "free";
            
            return (
              <Card 
                key={plan.id} 
                className={`relative transition-all border flex flex-col h-full ${
                  isFree || isCurrent
                    ? "border-border" 
                    : isPopular 
                      ? "border-primary ring-2 ring-primary/30 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10" 
                      : "border-border"
                } ${isCurrent || isPopular ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
              >
                {isPopular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold flex items-center gap-1.5 shadow-md">
                      <Star className="h-3.5 w-3.5 fill-current" />
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
                <CardContent className="pb-4 flex-1">
                  <ul className="space-y-2">
                    {allFeatures.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-4 mt-auto">
                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : isPopular ? "default" : "outline"}
                    disabled={isCurrent || loading}
                    onClick={() => onSelectPlan(plan.id, interval)}
                  >
                    {isCurrent 
                      ? "Current" 
                      : isPublic 
                        ? `Get ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} Plan`
                        : price === 0 
                          ? "Get Started" 
                          : "Upgrade"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 pt-6 border-t">
        <div className="max-w-3xl mx-auto text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Important:</strong> All plans can be canceled at any time with no commitment. 
            You'll retain access to your plan features until the end of your current billing period. 
            No refunds are provided for partial billing periods. 
            By subscribing, you agree to our{" "}
            <a href="/terms-of-use" className="text-primary hover:underline">
              Terms of Service
            </a>
            {" "}and{" "}
            <a href="/privacy-policy" className="text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </p>
          <p className="text-xs text-muted-foreground/80">
            Subscriptions automatically renew unless canceled. You can manage or cancel your subscription at any time from your billing settings.
          </p>
        </div>
      </div>
    </div>
  );
}

