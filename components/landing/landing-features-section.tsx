"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  TrendingUp, 
  Target, 
  BarChart3,
  PiggyBank,
  CreditCard,
  Calendar,
  Users,
  ArrowRight,
  Repeat,
  Globe,
  Sparkles,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExpenseTrackingMockup } from "./demo/expense-tracking-mockup";
import { SavingsGoalsMockup } from "./demo/savings-goals-mockup";
import { HouseholdMockup } from "./demo/household-mockup";
import { BudgetManagementMockup } from "./demo/budget-management-mockup";
import { DebtManagementMockup } from "./demo/debt-management-mockup";
import { SubscriptionsMockup } from "./demo/subscriptions-mockup";
import { InvestmentPortfolioMockup } from "./demo/investment-portfolio-mockup";
import { CategorizationMockup } from "./demo/categorization-mockup";
import { CsvImportExportMockup } from "./demo/csv-import-export-mockup";

export function LandingFeaturesSection() {
  const mainFeatures = [
    {
      title: "Track Every Expense",
      description: "Log your daily spending effortlessly. See exactly where every dollar goes—know exactly what you're spending on groceries, bills, entertainment, and more.",
      icon: TrendingUp,
      mockup: <ExpenseTrackingMockup />,
    },
    {
      title: "Manage Finances Together as a Household",
      description: "Invite family members to your household and share accounts, budgets, and goals. Collaborate on financial decisions and track progress together in real-time.",
      icon: Users,
      mockup: <HouseholdMockup />,
    },
    {
      title: "Save Money with Clear Goals",
      description: "Set savings goals and see exactly when you'll reach them. Track progress together as a family and celebrate milestones along the way.",
      icon: BarChart3,
      mockup: <SavingsGoalsMockup />,
    },
  ];

  const additionalFeatures = [
    {
      title: "Smart Budget Management",
      description: "Set flexible budgets by category with real-time tracking. Get visual alerts when approaching limits and see progress over time.",
      icon: BarChart3,
      tag: "Budget Management",
      tagColor: "bg-primary text-black",
      mockup: <BudgetManagementMockup />,
    },
    {
      title: "Smart Debt Management",
      description: "Track all debts with payoff strategies. Use avalanche or snowball methods, monitor interest, and optimize your debt payoff plan.",
      icon: CreditCard,
      tag: "Debt Management",
      tagColor: "bg-primary text-black",
      mockup: <DebtManagementMockup />,
    },
    {
      title: "Investment Portfolio Tracking",
      description: "Track positions, performance, and asset allocation to see your complete investment picture.",
      icon: TrendingUp,
      tag: "Investments",
      tagColor: "bg-primary text-black",
      mockup: <InvestmentPortfolioMockup />,
    },
    {
      title: "Easy Transaction Categorization",
      description: "Our intelligent system helps you categorize transactions quickly. Just select or adjust—it gets smarter over time.",
      icon: Sparkles,
      tag: "AI-Powered",
      tagColor: "bg-primary text-black",
      mockup: <CategorizationMockup />,
    },
    {
      title: "Subscription & Planned Payments",
      description: "Track all subscriptions in one place. Schedule planned payments and never miss a bill. Identify opportunities to save on recurring expenses.",
      icon: Repeat,
      tag: "Subscriptions",
      tagColor: "bg-primary text-black",
      mockup: <SubscriptionsMockup />,
    },
    {
      title: "CSV Import & Export",
      description: "Import transactions from spreadsheets or export your data anytime. Full control over your financial information for taxes, analysis, or backup.",
      icon: Download,
      tag: "Data Control",
      tagColor: "bg-primary text-black",
      mockup: <CsvImportExportMockup />,
    },
  ];


  return (
    <section id="features" className="py-12 md:py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header - Split Layout */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-20">
          <div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              Everything you need to <span className="text-primary">take control</span>
            </h2>
          </div>
          <div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Spare Finance offers families unparalleled convenience with flexible financial management tools that fit any lifestyle. Households benefit from increased savings and better financial control.
            </p>
          </div>
        </div>

        {/* Main Features - Intercalated Layout: Image/Text alternating side by side */}
        {/* Mobile: text below image, MD+: text beside image (alternating) */}
        <div className="space-y-12 md:space-y-16 mb-20">
          {mainFeatures.map((feature, index) => {
            const Icon = feature.icon;
            const isReverse = index % 2 === 1; // Alternate: even = left, odd = right
            
            return (
              <div
                key={index}
                className={cn(
                  "flex flex-col md:flex-row gap-6 md:gap-8 lg:gap-12",
                  isReverse && "md:flex-row-reverse",
                  "md:items-center"
                )}
              >
                {/* Mockup Visual - Left or Right based on index (MD+) */}
                <div className="w-full md:w-1/2 flex-shrink-0">
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="p-6 md:p-8 lg:p-10 min-h-[250px] md:min-h-[350px] lg:min-h-[400px] flex items-center justify-center bg-muted">
                      {feature.mockup}
                    </div>
                  </div>
                </div>
                
                {/* Content - Right or Left based on index (MD+), below on mobile */}
                <div className="w-full md:w-1/2 min-w-0 flex items-center">
                  <div className="w-full max-w-xl mx-auto md:mx-0 px-4 md:px-0">
                    <div className="mb-3 md:mb-4">
                      <Icon className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                    </div>
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-3 md:mb-4 break-words">
                      {feature.title}
                    </h3>
                    <p className="text-sm md:text-base lg:text-lg text-muted-foreground leading-relaxed break-words">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Features Section - New Layout */}
        {/* Mobile: 1 column, MD+: 2 columns */}
        <div className="mb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-6">
            {additionalFeatures.map((feature, index) => {
              const Icon = feature.icon;
              
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-border bg-background overflow-hidden flex flex-col h-full"
                >
                  {/* Tag */}
                  <div className="px-6 pt-6 pb-4">
                    <Badge className={cn("rounded-full px-3 py-1.5 text-xs font-medium", feature.tagColor)}>
                      <Icon className="w-3.5 h-3.5 mr-1.5" />
                      {feature.tag}
                    </Badge>
                  </div>

                  {/* Content */}
                  <div className="px-6 pb-6 flex-grow flex flex-col">
                    {/* Mockup - At top */}
                    {feature.mockup && (
                      <div className="bg-card rounded-xl p-4 mb-6 h-[220px] flex items-center justify-center overflow-hidden flex-shrink-0 bg-muted">
                        {feature.mockup}
                      </div>
                    )}
                    
                    <div className="flex-shrink-0">
                      <h4 className="text-xl font-bold mb-3">
                        {feature.title}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">
            A place where families learn to organize their finances together.
          </p>
          <p className="text-xl font-semibold mb-8">
            Start tracking your expenses today and learn to build wealth, not just pay bills.
          </p>
          <Button
            asChild
            size="medium"
          >
            <Link href="/auth/signup">
              Start Organizing Your Finances
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

