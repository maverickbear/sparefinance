"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2, TrendingUp, Target } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      number: "1",
      title: "Add Your Accounts",
      description: "Connect bank accounts via Plaid, link Questrade for investments, or manually add accounts. Import transactions via CSV or enter them manually—your choice.",
      icon: Link2,
    },
    {
      number: "2",
      title: "AI Categorizes Everything",
      description: "Our smart system learns your spending patterns and automatically categorizes transactions. Just approve or adjust—it gets smarter over time.",
      icon: TrendingUp,
    },
    {
      number: "3",
      title: "Set Goals & Budgets",
      description: "Create budgets by category, set savings goals with deadlines, and track debt payoff. Get Spare Score insights to improve your financial health.",
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
            How Spare Finance<br />Can Help You
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="text-center group">
                <div className="p-8 rounded-2xl border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg bg-card">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                    <span className="text-4xl font-bold text-primary">{step.number}</span>
                  </div>
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-7 h-7 text-primary" />
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

