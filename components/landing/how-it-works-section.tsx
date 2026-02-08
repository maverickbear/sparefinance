"use client";

import { useInView } from "@/hooks/use-in-view";
import { UserPlus, Wallet, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    number: "01",
    title: "Sign up",
    description: "Create your account. Start your 30-day free trial—no card required.",
    icon: UserPlus,
  },
  {
    number: "02",
    title: "Add your money",
    description: "Connect your bank or add accounts and transactions manually.",
    icon: Wallet,
  },
  {
    number: "03",
    title: "See the picture",
    description: "Dashboard, budgets, goals, and Spare Score in one place.",
    icon: LayoutDashboard,
  },
];

export function HowItWorksSection() {
  const { ref, inView } = useInView();

  return (
    <section id="how-it-works" ref={ref} className="py-16 md:py-24 bg-muted/30 scroll-mt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">How it works.</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Three simple steps to a clearer financial picture.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-8 md:gap-12">
          {STEPS.map(({ number, title, description, icon: Icon }, i) => (
            <div
              key={number}
              className={cn(
                "text-center transition-all duration-500",
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              )}
              style={{ transitionDelay: inView ? `${i * 120}ms` : "0ms" }}
            >
              <span className="text-3xl font-bold text-primary">{number}</span>
              <div className="mt-4 flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
