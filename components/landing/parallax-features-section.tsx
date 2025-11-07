"use client";

import { ParallaxFeature } from "./parallax-feature";
import { BarChart3, Wallet, TrendingUp, Shield, PieChart, Target } from "lucide-react";

export function ParallaxFeaturesSection() {
  const features = [
    {
      title: "Advanced Analytics",
      description: "Gain instant insights into your spending patterns and make smarter financial decisions. Track your expenses, income, and savings with detailed analytics and visualizations.",
      icon: <BarChart3 className="w-16 h-16 text-primary" />,
      reverse: false,
    },
    {
      title: "Real-time Expense Tracking",
      description: "Monitor your finances in real-time with automatic transaction categorization. Never miss a payment or overspend with instant notifications and budget alerts.",
      icon: <Wallet className="w-16 h-16 text-primary" />,
      reverse: true,
    },
    {
      title: "Smart Budget Management",
      description: "Create and manage budgets effortlessly with intelligent recommendations. Set spending limits, track progress, and achieve your financial goals with ease.",
      icon: <PieChart className="w-16 h-16 text-primary" />,
      reverse: false,
    },
    {
      title: "Investment Portfolio Tracking",
      description: "Keep track of all your investments in one place. Monitor stocks, bonds, and other assets with real-time prices and performance metrics.",
      icon: <TrendingUp className="w-16 h-16 text-primary" />,
      reverse: true,
    },
    {
      title: "Secure & Encrypted",
      description: "Your financial data is protected with bank-level encryption. We use industry-leading security practices to keep your information safe and private.",
      icon: <Shield className="w-16 h-16 text-primary" />,
      reverse: false,
    },
    {
      title: "Goal Setting & Tracking",
      description: "Set financial goals and track your progress. Whether it's saving for a vacation, paying off debt, or building an emergency fund, we help you stay on track.",
      icon: <Target className="w-16 h-16 text-primary" />,
      reverse: true,
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Powerful Features for Your Financial Success
          </h2>
          <p className="text-lg text-muted-foreground">
            Discover how our platform can transform the way you manage your money
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
              reverse={feature.reverse}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

