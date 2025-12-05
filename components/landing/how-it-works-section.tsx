"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2, TrendingUp, Target } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      title: "Track All Your Expenses",
      description: "Connect your bank accounts or add transactions manually. See where every dollar goes—groceries, bills, entertainment, everything. No more wondering where your money went.",
      icon: Link2,
    },
    {
      title: "Understand Your Spending",
      description: "Get insights based on your real spending. See your Spare Score, understand your savings rate, and learn where you can save more. Our AI helps you understand your finances.",
      icon: TrendingUp,
    },
    {
      title: "Learn to Save Together",
      description: "Set savings goals with your family and see when you'll reach them. Create budgets that work and track progress together. Build wealth, not just pay bills.",
      icon: Target,
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            How It Works
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            How Your Family<br />Can Get Organized
          </h2>
        </div>

        {/* Mobile: 1 column, MD: 2 columns (avoid overlap), LG+: 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="text-center group">
                <div className="p-8 rounded-2xl border border-border bg-card">
                  <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-7 h-7 text-black dark:text-black" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-base leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

