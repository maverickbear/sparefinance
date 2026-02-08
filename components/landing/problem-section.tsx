"use client";

import { useInView } from "@/hooks/use-in-view";
import { Wallet, TrendingUp, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const CARDS = [
  {
    icon: Wallet,
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
    title: "Everything in one place",
    description: "Accounts and info scattered across apps and spreadsheets? Spare Finance brings it all together so you see your full picture at a glance.",
  },
  {
    icon: TrendingUp,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    title: "See where money goes",
    description: "Hard to see where your money actually goes. Clear categories and reports show you spending and trends so you can decide with confidence.",
  },
  {
    icon: Target,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    title: "Goals that get started",
    description: "Goals that never get started because it feels overwhelming? Set targets, track progress, and stay on track—all in one place.",
  },
];

export function ProblemSection() {
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref}
      className={cn(
        "py-16 md:py-24 transition-all duration-700",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="text-center">
          <span className="inline-block rounded-full bg-primary/20 px-4 py-1.5 text-sm font-medium text-foreground">
            Why it matters
          </span>
          <h2 className="mt-4 text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
            Money shouldn&apos;t feel scattered.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Sound familiar? Many people juggle accounts, lose track of spending, and never get started on goals—until they have one place to see it all.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6 md:gap-8">
          {CARDS.map(({ icon: Icon, iconBg, iconColor, title, description }) => (
            <div
              key={title}
              className="rounded-[32px] border border-border bg-card p-6 shadow-sm text-center md:text-left"
            >
              <div
                className={cn(
                  "inline-flex h-12 w-12 items-center justify-center rounded-lg",
                  iconBg,
                  iconColor
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
