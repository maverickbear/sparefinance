"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useInView } from "@/hooks/use-in-view";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const INCLUDED = [
  "Unlimited transactions and accounts",
  "Dashboard and Spare Score",
  "Budgets, goals, and reports",
  "Receipt scanning",
  "Household sharing",
];

export function PricingSection() {
  const { ref, inView } = useInView();

  return (
    <section id="pricing" ref={ref} className="py-16 md:py-24 scroll-mt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
        <div className={cn("text-center transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Simple pricing.</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            One plan. All features. Start with a 30-day free trial.
          </p>
          <div className="mt-8 rounded-[32px] border border-border bg-card p-8 text-left">
            <p className="text-3xl font-bold text-foreground">Pro</p>
            <p className="mt-1 text-muted-foreground">Everything you need to manage your money.</p>
            <ul className="mt-6 space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Check className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="large" className="mt-8 w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/auth/signup">Start free trial</Link>
            </Button>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              No credit card required. Cancel anytime.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
