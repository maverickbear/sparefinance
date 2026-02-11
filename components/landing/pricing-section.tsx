"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setLandingPlan } from "@/lib/constants/landing-plan";
import { Badge } from "@/components/ui/badge";
import { useInView } from "@/hooks/use-in-view";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const INCLUDED = [
  "Unlimited transactions and accounts",
  "Dashboard and Spare Score",
  "Budgets, goals, and reports",
  "Receipt scanning",
  "Advanced reports",
  "CSV import and export",
  "Debt tracking",
  "Household sharing",
];

const FALLBACK_PRICE_MONTHLY = 14.99;
const FALLBACK_PRICE_YEARLY = 149.9;

type PlanInterval = "month" | "year";

interface ProPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
}

const PRO_PLAN_ID = "pro";

export function PricingSection() {
  const router = useRouter();
  const { ref, inView } = useInView();
  const [interval, setInterval] = useState<PlanInterval>("month");
  const [plan, setPlan] = useState<ProPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/plans/public")
      .then((res) => res.json())
      .then((data) => {
        const pro = (data.plans || []).find((p: ProPlan) => p.name === "pro");
        if (pro) setPlan(pro);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const priceMonthly = plan?.priceMonthly ?? FALLBACK_PRICE_MONTHLY;
  const priceYearly = plan?.priceYearly ?? FALLBACK_PRICE_YEARLY;
  const price = interval === "month" ? priceMonthly : priceYearly;
  const monthlyEquivalent = interval === "year" ? priceYearly / 12 : priceMonthly;
  const yearlySavingsPct =
    priceYearly > 0 ? Math.round((1 - priceYearly / 12 / priceMonthly) * 100) : 0;

  return (
    <section id="pricing" ref={ref} className="bg-[#f8f4f1] py-16 md:py-24 scroll-mt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className={cn("grid lg:grid-cols-2 gap-12 lg:gap-16 items-center transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Ready to take control?</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Start your 30-day free trial. You&apos;ll only be charged after the trial ends. Cancel anytime—your plan stays active until the end of your billing cycle (monthly or annual).
            </p>
            <ul className="mt-6 space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Check className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[32px] border border-border bg-card p-8 text-left">
            <p className="text-3xl font-bold text-foreground">Pro</p>

            {/* Interval toggle + price */}
            <div className="mt-6">
              <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1.5">
                <Button
                  type="button"
                  variant={interval === "month" ? "default" : "ghost"}
                  size="medium"
                  onClick={() => setInterval("month")}
                  className={interval === "month" ? "shadow-sm" : ""}
                >
                  Monthly
                </Button>
                <Button
                  type="button"
                  variant={interval === "year" ? "default" : "ghost"}
                  size="medium"
                  onClick={() => setInterval("year")}
                  className={cn("flex items-center gap-2", interval === "year" && "shadow-sm")}
                >
                  Yearly
                  {yearlySavingsPct > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
                      Save {yearlySavingsPct}%
                    </Badge>
                  )}
                </Button>
              </div>
              <div className="mt-4">
                {loading ? (
                  <div className="h-12 w-24 rounded bg-muted animate-pulse" />
                ) : (
                  <>
                    {interval === "year" ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-foreground">
                            ${monthlyEquivalent.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground">/month</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Billed annually — ${priceYearly.toFixed(2)}/year
                        </p>
                      </>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-foreground">
                          ${priceMonthly.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <Button
              size="large"
              className="mt-8 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setLandingPlan(PRO_PLAN_ID, interval);
                router.push(`/auth/signup?planId=${PRO_PLAN_ID}&interval=${interval}`);
              }}
            >
              Start 30-day free trial
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
              Encrypted. Private. Yours.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
