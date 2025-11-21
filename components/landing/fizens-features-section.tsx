"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Target, 
  BarChart3,
  PiggyBank,
  CreditCard,
  Calendar,
  Users,
  Shield,
  ArrowRight,
  Repeat,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExpenseTrackingMockup } from "./demo/expense-tracking-mockup";
import { SavingsGoalsMockup } from "./demo/savings-goals-mockup";
import { AnalyticsMockup } from "./demo/analytics-mockup";
import { SpareScoreMockup } from "./demo/spare-score-mockup";
import { HouseholdMockup } from "./demo/household-mockup";
import { BudgetManagementMockup } from "./demo/budget-management-mockup";
import { DebtManagementMockup } from "./demo/debt-management-mockup";
import { SubscriptionsMockup } from "./demo/subscriptions-mockup";
import { SecurityMockup } from "./demo/security-mockup";
import { ReportsAnalyticsMockup } from "./demo/reports-analytics-mockup";
import { InvestmentPortfolioMockup } from "./demo/investment-portfolio-mockup";

export function FizensFeaturesSection() {
  const mainFeatures = [
    {
      title: "Track Every Expense Automatically",
      description: "Connect your bank accounts and see where every dollar goes. No more guessing—know exactly what you're spending on groceries, bills, entertainment, and more.",
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
      tagColor: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      mockup: <BudgetManagementMockup />,
      cta: "Set Budget →",
    },
    {
      title: "Smart Debt Management",
      description: "Track all debts with payoff strategies. Use avalanche or snowball methods, monitor interest, and optimize your debt payoff plan.",
      icon: CreditCard,
      tag: "Debt Management",
      tagColor: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
      mockup: <DebtManagementMockup />,
      cta: "Track Debt →",
    },
    {
      title: "Investment Portfolio Tracking",
      description: "Sync Questrade accounts automatically. Track positions, performance, and asset allocation to see your complete investment picture.",
      icon: TrendingUp,
      tag: "Investments",
      tagColor: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
      mockup: <InvestmentPortfolioMockup />,
      cta: "View Portfolio →",
    },
    {
      title: "Comprehensive Reports & Analytics",
      description: "Generate detailed financial reports. Analyze spending by category, track cash flow trends, and export data for taxes or analysis.",
      icon: BarChart3,
      tag: "Analytics",
      tagColor: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      mockup: <ReportsAnalyticsMockup />,
      cta: "View Reports →",
    },
    {
      title: "Subscription & Planned Payments",
      description: "Track all subscriptions in one place. Schedule planned payments and never miss a bill. Identify opportunities to save on recurring expenses.",
      icon: Repeat,
      tag: "Subscriptions",
      tagColor: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
      mockup: <SubscriptionsMockup />,
      cta: "Manage →",
    },
    {
      title: "Spare Score",
      description: "Get your Spare Score to understand your financial situation. See your savings rate, spending discipline, and get personalized insights to improve.",
      icon: Target,
      tag: "Spare Score",
      tagColor: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
      mockup: <SpareScoreMockup />,
      cta: "View Score →",
    },
    {
      title: "Bank-Level Security",
      description: "256-bit encryption, Plaid's SOC 2 Type 2 certification, and Row Level Security. We never store your bank credentials—ever.",
      icon: Shield,
      tag: "Security",
      tagColor: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
      mockup: <SecurityMockup />,
      cta: "Learn More →",
    },
  ];


  return (
    <section id="features" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header - Split Layout */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-20">
          <div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              Discover the <span className="text-primary">unmatched</span> benefits
            </h2>
          </div>
          <div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Spare Finance offers families unparalleled convenience with flexible financial management tools that fit any lifestyle. Households benefit from increased savings and better financial control.
            </p>
          </div>
        </div>

        {/* Main Features - Fizens Style with Mockups */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {mainFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="flex">
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden flex flex-col w-full">
                  {/* Mockup Visual - Fixed Height */}
                  <div className="bg-muted/80 dark:bg-muted/60 p-6 h-[280px] flex items-center justify-center flex-shrink-0">
                    {feature.mockup}
                  </div>
                  {/* Content */}
                  <div className="p-6 flex-grow flex flex-col">
                    <h3 className="text-xl font-bold mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Features Section - New Layout */}
        <div className="mb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {additionalFeatures.map((feature, index) => {
              const Icon = feature.icon;
              // Create varied card sizes like in the image
              const cardSizes = [
                "md:col-span-1", // Budget - normal
                "md:col-span-1", // Debt - normal
                "md:col-span-1 lg:col-span-1", // Investment - 50%
                "md:col-span-1 lg:col-span-1", // Reports/Analytics - 50%
                "md:col-span-1", // Subscriptions - normal
                "md:col-span-1", // Spare Score - normal
                "md:col-span-1", // Security - normal
              ];
              
              return (
                <div
                  key={index}
                  className={cn(
                    "rounded-2xl border border-border/50 bg-card overflow-hidden flex flex-col",
                    cardSizes[index] || "md:col-span-1"
                  )}
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
                    <h4 className="text-xl font-bold mb-3">
                      {feature.title}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                      {feature.description}
                    </p>
                    
                    {/* Mockup */}
                    {feature.mockup && (
                      <div className="bg-muted/80 dark:bg-muted/60 rounded-xl p-4 mb-6 h-[220px] flex items-center justify-center overflow-hidden">
                        {feature.mockup}
                      </div>
                    )}
                    
                    <a
                      href="#pricing"
                      className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1.5 w-fit mt-auto"
                    >
                      {feature.cta}
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA - Fizens Style */}
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">
            A place where families learn to organize their finances together.
          </p>
          <p className="text-xl font-semibold mb-8">
            Start tracking your expenses today and learn to build wealth, not just pay bills.
          </p>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold"
          >
            Start Organizing Your Finances
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
}

