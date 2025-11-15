"use client";

import { ParallaxFeature } from "./parallax-feature";
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
      subtitle: "Smart. Automatic. Effortless.",
      description: "Our smart system learns your spending patterns and automatically categorizes transactions. Just approve or adjust—it gets smarter over time.",
      demoComponent: <CategorizationDemo />,
      reverse: false,
    },
    {
      title: "Complete Financial Dashboard",
      subtitle: "Everything in one place.",
      description: "See everything in one place: spending, income, budgets, and goals. Get instant insights with beautiful charts and visualizations that make complex data simple to understand.",
      demoComponent: <DashboardWidgetsDemo />,
      reverse: true,
    },
    {
      title: "Automatic Bank Account Sync",
      subtitle: "Connect once. Stay updated forever.",
      description: "Connect your bank accounts in seconds. Transactions import automatically—no more manual entry. Your financial data stays up-to-date 24/7, so you always know where you stand.",
      demoComponent: <BankAccountsDemo />,
      reverse: false,
    },
    {
      title: "Smart Budget Management",
      subtitle: "Stay on track. Automatically.",
      description: "Set budgets by category and watch your progress in real-time. Get visual alerts when you're approaching limits. Our system learns your patterns and helps you stay on track effortlessly.",
      demoComponent: <BudgetsDemo />,
      reverse: true,
    },
    {
      title: "Investment Portfolio Tracking",
      subtitle: "Track everything. Understand everything.",
      description: "Track stocks, ETFs, crypto, and more. Monitor your portfolio value, calculate returns, and see how your investments are performing—all integrated with your overall financial picture.",
      demoComponent: <InvestmentsDemo />,
      reverse: false,
    },
    {
      title: "Smart Debt Management",
      subtitle: "Pay off faster. Save more.",
      description: "Track and manage all your debts in one place. Monitor interest rates, payment schedules, and progress. Get insights on how to pay off debts faster and save on interest.",
      demoComponent: <DebtsDemo />,
      reverse: true,
    },
    {
      title: "Savings Goals That Actually Work",
      subtitle: "Set goals. Reach them.",
      description: "Set multiple savings goals and allocate a percentage of your income to each. Watch your progress with beautiful visualizations and get accurate estimates of when you'll reach your goals.",
      demoComponent: <GoalsDemo />,
      reverse: false,
    },
  ];

  return (
    <section className="bg-background">
      {/* Main Header Section */}
      <div className="pt-24 md:pt-32 pb-16 md:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold mb-6 tracking-tight">
              Stop Managing Money.<br />Start Mastering It.
            </h2>
            <p className="text-xl sm:text-2xl text-muted-foreground font-light">
              See how thousands of users are taking control of their finances with features that actually save time and money.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-0">
        {features.map((feature, index) => (
          <ParallaxFeature
            key={index}
            title={feature.title}
            subtitle={feature.subtitle}
            description={feature.description}
            demoComponent={feature.demoComponent}
            reverse={feature.reverse}
            isFirst={index === 0}
            isLast={index === features.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
