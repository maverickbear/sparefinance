"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Repeat
} from "lucide-react";
import { ExpenseTrackingMockup } from "./demo/expense-tracking-mockup";
import { SavingsGoalsMockup } from "./demo/savings-goals-mockup";
import { AnalyticsMockup } from "./demo/analytics-mockup";
import { SpareScoreMockup } from "./demo/spare-score-mockup";

export function FizensFeaturesSection() {
  const mainFeatures = [
    {
      title: "Expense & Income Tracking",
      description: "Record and categorize expense & income automatically or manually.",
      icon: TrendingUp,
      mockup: <ExpenseTrackingMockup />,
    },
    {
      title: "Spare Score & Insights",
      description: "Get AI-powered financial health insights. Track your savings rate, spending discipline, and get personalized recommendations.",
      icon: Target,
      mockup: <SpareScoreMockup />,
    },
    {
      title: "Smart Savings Goals",
      description: "Set specific savings goals and track progress towards them.",
      icon: BarChart3,
      mockup: <SavingsGoalsMockup />,
    },
  ];

  const additionalFeatures = [
    {
      title: "Budgeting",
      description: "Track budgets for different categories.",
      icon: BarChart3,
      iconColor: "bg-blue-100 text-blue-600",
    },
    {
      title: "Debt Management",
      description: "Track debt balances, interest rates, and create plans.",
      icon: CreditCard,
      iconColor: "bg-blue-100 text-blue-600",
    },
    {
      title: "Investment Tracking",
      description: "Track investments, including stocks, bonds, and funds.",
      icon: TrendingUp,
      iconColor: "bg-blue-100 text-blue-600",
    },
    {
      title: "Financial Analytics",
      description: "Generate reports and visualizations to analyze spending habits.",
      icon: BarChart3,
      iconColor: "bg-blue-100 text-blue-600",
    },
    {
      title: "Subscription Tracking",
      description: "Track all your subscriptions in one place. See what you're paying for and identify opportunities to save.",
      icon: Repeat,
      iconColor: "bg-pink-100 text-pink-600",
    },
    {
      title: "Household Management",
      description: "Manage finances for your entire household with shared accounts.",
      icon: Users,
      iconColor: "bg-blue-100 text-blue-600",
    },
  ];

  return (
    <section id="features" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            Key Features
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            Explore Our<br />Standout Features
          </h2>
        </div>

        {/* Main Features - Fizens Style with Mockups */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {mainFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="group flex">
                <div className="rounded-2xl border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg bg-card overflow-hidden flex flex-col w-full">
                  {/* Mockup Visual - Fixed Height */}
                  <div className="bg-muted/30 p-6 h-[280px] flex items-center justify-center flex-shrink-0">
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

        {/* Additional Features Section */}
        <div className="text-center mb-12">
          <p className="text-xl text-muted-foreground font-medium">
            ...and more additional features
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {additionalFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="p-6 rounded-xl border border-border/50 hover:border-primary/20 transition-all bg-card">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${feature.iconColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold mb-1">
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

        {/* CTA - Fizens Style */}
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">
            Our app is an all-in-one solution for managing your money and financial goals.
          </p>
          <p className="text-xl font-semibold mb-8">
            Experience the peace of mind that comes with having your finances under control.
          </p>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
}

