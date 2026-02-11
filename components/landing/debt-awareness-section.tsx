"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";
import { MapPin, Globe } from "lucide-react";

// Replace with real, cited statistics (e.g. Stats Canada, US Federal Reserve, OECD).
const DEBT_STATS = [
  {
    region: "Canada",
    value: "74%",
    description: "Of Canadian households carry some form of debt.",
    icon: MapPin,
  },
  {
    region: "USA",
    value: "77%",
    description: "Of American households have debt—from credit cards to student loans.",
    icon: MapPin,
  },
  {
    region: "World",
    value: "~60%",
    description: "Of adults globally report struggling with debt or making ends meet.",
    icon: Globe,
  },
];

export function DebtAwarenessSection() {
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref}
      className={cn(
        "py-16 md:py-24 bg-muted/30 transition-all duration-700",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Research
        </p>
        <h2 className="mt-4 text-center text-2xl md:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
          Indebtedness in Canada, the USA, and the world.
        </h2>
        <p className="mt-6 text-center text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Millions of people carry debt and juggle spreadsheets to stay on top of it. You&apos;re not alone—and there&apos;s a simpler way to stay organized.
        </p>
        <div className="mt-12 grid sm:grid-cols-3 gap-6 md:gap-8">
          {DEBT_STATS.map(({ region, value, description, icon: Icon }) => (
            <div
              key={region}
              className="rounded-[32px] border border-border bg-card p-6 shadow-sm text-center"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{region}</p>
              <p className="mt-2 text-3xl md:text-4xl font-bold text-primary">{value}</p>
              <p className="mt-2 text-sm text-muted-foreground leading-snug">
                {description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-14 text-center">
          <p className="text-lg md:text-xl text-foreground max-w-2xl mx-auto leading-relaxed">
            Spare Finance is here to help—<strong>more organized</strong>, <strong>less work</strong> than spreadsheets, <strong>available anywhere</strong>.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button
              asChild
              size="large"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/auth/signup">Start 30-day free trial</Link>
            </Button>
            <Button asChild variant="outline" size="large">
              <Link href="#pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
