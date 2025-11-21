"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, TrendingUp, Shield, CheckCircle2 } from "lucide-react";
import { BenefitsActivityCard } from "./demo/benefits-activity-card";

export function BenefitsSection() {
  const benefits = [
    {
      title: "Time and Stress Reduction",
      subtitle: "Save your time and reduce financial anxiety",
      description: "AI-powered categorization learns your patterns and automatically organizes transactions. Bank integration syncs everything automatically—no more manual entry or spreadsheets.",
      features: [
        "Automatic transaction categorization saves hours monthly",
        "Bank sync eliminates manual data entry",
      ],
      icon: Clock,
    },
    {
      title: "Financial Growth",
      subtitle: "Take control of your financial future",
      description: "Spare Score provides AI-powered insights into your financial health. Track savings goals with ETA calculations, monitor investments, and optimize debt payoff strategies.",
      features: [
        "Spare Score tracks your financial health automatically",
        "Savings goals with progress tracking and deadlines",
      ],
      icon: TrendingUp,
    },
    {
      title: "Security and Privacy",
      subtitle: "Enterprise-grade security for your finances",
      description: "Bank-level encryption, secure Plaid integration with read-only access, and Row Level Security (RLS) ensure your data is protected. We never store bank credentials.",
      features: [
        "256-bit encryption and secure authentication",
        "Plaid integration with SOC 2 Type 2 certification",
      ],
      icon: Shield,
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            Benefit
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            Experience The<br />Future of Finance
          </h2>
        </div>

        {/* First Benefit with Activity Card - Fizens Style */}
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
                <p className="text-sm font-medium text-primary mb-3">• Time and Stress Reduction</p>
                <h3 className="text-3xl font-bold mb-4">
                  Save your time and reduce financial anxiety
                </h3>
                <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                  Automate tasks like budgeting, tracking, and saving, freeing up your time for more important things.
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

        {/* Other Benefits */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {benefits.slice(1).map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div key={index} className="group">
                <div className="p-8 rounded-2xl border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg bg-card h-full flex flex-col">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-7 h-7 text-primary" />
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

