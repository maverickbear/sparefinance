"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Globe, Zap, TrendingUp } from "lucide-react";

export function FeaturesSection() {
  const features = [
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Gain instant insights into your spending patterns and make smarter financial decisions.",
      value: "$22,630",
      label: "Finance Management",
    },
    {
      icon: Globe,
      title: "Real-time Global Collaborations",
      description: "Gain instant insights into your spending patterns and make smarter financial decisions.",
      iconLarge: true,
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Experience blazing fast performance with real-time updates and instant synchronization.",
    },
    {
      icon: TrendingUp,
      title: "Smart Insights",
      description: "Get AI-powered recommendations to optimize your financial health and savings.",
    },
  ];

  const stats = [
    { value: "2000+", label: "Trusted Partners", icon: "↑" },
    { value: "5M+", label: "Active Users", icon: "↑" },
    { value: "98%", label: "Faster Ops", icon: "↑" },
    { value: "$10B+", label: "Financial Data", icon: "↑" },
  ];

  return (
    <section id="features" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Real-time expense tracking made simple
          </h2>
          <p className="text-lg text-muted-foreground">
            Instantly uncover spending habits and improve your financial decisions
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-primary/10 rounded-[12px]">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    {feature.value && (
                      <div className="text-right">
                        <p className="text-2xl font-bold">{feature.value}</p>
                        <p className="text-sm text-muted-foreground">{feature.label}</p>
                      </div>
                    )}
                    {feature.iconLarge && (
                      <div className="p-4 bg-primary rounded-[12px]">
                        <Zap className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-3xl md:text-4xl font-bold">{stat.value}</span>
                <span className="text-2xl text-primary">{stat.icon}</span>
              </div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

