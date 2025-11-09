"use client";

import { ParallaxFeature } from "./parallax-feature";
import { BarChart3, Wallet, TrendingUp, CreditCard, PieChart, Target, Globe } from "lucide-react";
import { DashboardWidgetsDemo } from "./demo/dashboard-widgets-demo";
import { BankAccountsDemo } from "./demo/bank-accounts-demo";
import { BudgetsDemo } from "./demo/budgets-demo";
import { InvestmentsDemo } from "./demo/investments-demo";
import { DebtsDemo } from "./demo/debts-demo";
import { GoalsDemo } from "./demo/goals-demo";
import { CategorizationDemo } from "./demo/categorization-demo";

export function ParallaxFeaturesSection() {
  const features = [
    {
      title: "AI-Powered Categorization",
      description: "Our smart system learns your spending patterns and automatically categorizes transactions. Just approve or adjust—it gets smarter over time.",
      icon: <Globe className="w-16 h-16 text-primary" />,
      demoComponent: <CategorizationDemo />,
      reverse: false,
    },
    {
      title: "Complete Financial Dashboard",
      description: "See everything in one place: spending, income, budgets, and goals. Get instant insights with beautiful charts and visualizations that make complex data simple to understand.",
      icon: <BarChart3 className="w-16 h-16 text-primary" />,
      demoComponent: <DashboardWidgetsDemo />,
      reverse: true,
    },
    {
      title: "Automatic Bank Account Sync",
      description: "Connect your bank accounts in seconds. Transactions import automatically—no more manual entry. Your financial data stays up-to-date 24/7, so you always know where you stand.",
      icon: <Wallet className="w-16 h-16 text-primary" />,
      demoComponent: <BankAccountsDemo />,
      reverse: false,
    },
    {
      title: "Smart Budget Management",
      description: "Set budgets by category and watch your progress in real-time. Get visual alerts when you're approaching limits. Our system learns your patterns and helps you stay on track effortlessly.",
      icon: <PieChart className="w-16 h-16 text-primary" />,
      demoComponent: <BudgetsDemo />,
      reverse: true,
    },
    {
      title: "Investment Portfolio Tracking",
      description: "Track stocks, ETFs, crypto, and more. Monitor your portfolio value, calculate returns, and see how your investments are performing—all integrated with your overall financial picture.",
      icon: <TrendingUp className="w-16 h-16 text-primary" />,
      demoComponent: <InvestmentsDemo />,
      reverse: false,
    },
    {
      title: "Smart Debt Management",
      description: "Track and manage all your debts in one place. Monitor interest rates, payment schedules, and progress. Get insights on how to pay off debts faster and save on interest.",
      icon: <CreditCard className="w-16 h-16 text-primary" />,
      demoComponent: <DebtsDemo />,
      reverse: true,
    },
    {
      title: "Savings Goals That Actually Work",
      description: "Set multiple savings goals and allocate a percentage of your income to each. Watch your progress with beautiful visualizations and get accurate estimates of when you'll reach your goals.",
      icon: <Target className="w-16 h-16 text-primary" />,
      demoComponent: <GoalsDemo />,
      reverse: false,
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Stop Managing Money. Start Mastering It.
          </h2>
          <p className="text-lg text-muted-foreground">
            See how thousands of users are taking control of their finances with features that actually save time and money
          </p>
        </div>

        {/* Parallax Features */}
        <div className="space-y-8 md:space-y-0">
          {features.map((feature, index) => (
            <ParallaxFeature
              key={index}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              demoComponent={feature.demoComponent}
              reverse={feature.reverse}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

