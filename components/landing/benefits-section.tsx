"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, TrendingUp, Shield, CheckCircle2, Target } from "lucide-react";
import { BenefitsActivityCard } from "./demo/benefits-activity-card";

export function BenefitsSection() {
  const benefits = [
    {
      title: "Know Exactly Where Your Money Goes",
      subtitle: "Complete Visibility",
      description: "Stop wondering where your money disappeared. Track every expense automatically, see spending by category, and understand your patterns. Share this view with your family so everyone knows where you stand.",
      features: [
        "See all expenses in one place, automatically categorized",
        "Understand spending patterns by category and time",
        "Share financial overview with family members",
      ],
      icon: Clock,
    },
    {
      title: "Learn to Save Money with Personalized Insights",
      subtitle: "Financial Education",
      description: "Get your Spare Score to understand your financial health. Learn your savings rate, spending discipline, and receive insights based on your actual spending. Our AI chat helps you understand your finances better.",
      features: [
        "Spare Score shows your financial health (0-100)",
        "Personalized insights based on your real spending",
        "Learn where you can save more money",
      ],
      icon: TrendingUp,
    },
    {
      title: "Build Wealth Together as a Family",
      subtitle: "Family Growth",
      description: "Set savings goals together and track progress. Manage household finances with shared accounts and budgets. Learn and grow financially as a family, not just as individuals.",
      features: [
        "Set and track savings goals with your family",
        "Shared accounts and budgets for household management",
        "Work together toward financial goals",
      ],
      icon: Target,
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            Why Families Choose Spare Finance
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Stop Living Paycheck to Paycheck.<br />Start Building Your Future.
          </h2>
        </div>

        {/* First Benefit with Activity Card */}
        <div className="max-w-5xl mx-auto mb-12">
          <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8 md:p-12 border border-primary/20 relative overflow-hidden">
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iaHNsKHZhcigtLXByaW1hcnkpKSIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMiIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')]"></div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 relative z-10">
              {/* Activity Card */}
              <div>
                <BenefitsActivityCard />
              </div>
              
              {/* Text Content */}
              <div className="flex flex-col justify-center">
                <p className="text-sm font-medium text-muted-foreground mb-3">• {benefits[0].subtitle}</p>
                <h3 className="text-3xl font-bold mb-4">
                  {benefits[0].title}
                </h3>
                <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                  {benefits[0].description}
                </p>
                <ul className="space-y-3">
                  {benefits[0].features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Other Benefits - Grid Layout */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {benefits.slice(1).map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div key={index} className="group">
                <div className="p-8 rounded-2xl border border-border bg-card h-full flex flex-col">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-7 h-7 text-black" />
                  </div>
                  <p className="text-sm font-medium text-primary/80 mb-3 uppercase tracking-wide">
                    {benefit.subtitle}
                  </p>
                  <h3 className="text-2xl font-bold mb-4">
                    {benefit.title}
                  </h3>
                  <p className="text-base text-muted-foreground mb-6 leading-relaxed flex-grow">
                    {benefit.description}
                  </p>
                  <ul className="space-y-3">
                    {benefit.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

