"use client";

import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";

const STATS = [
  { value: "73%", description: "Of families live paycheck to paycheck—you don't have to" },
  { value: "6 mos", description: "To see real change when you track and plan together" },
  { value: "2.5x", description: "More likely to reach goals when the whole family is involved" },
];

export function RealitySection() {
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref}
      className={cn(
        "py-16 md:py-24 transition-all duration-700",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          The reality
        </p>
        <h2 className="mt-4 text-center text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
          Most families are stuck.<br />You don&apos;t have to be.
        </h2>
        <p className="mt-6 text-center text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          While most families struggle to make ends meet, you can be one of the few who break the cycle. Start building wealth, not just paying bills.
        </p>
        <div className="mt-12 grid sm:grid-cols-3 gap-8 md:gap-12">
          {STATS.map(({ value, description }) => (
            <div key={value} className="text-center">
              <p className="text-4xl md:text-5xl font-bold text-primary">{value}</p>
              <p className="mt-2 text-sm md:text-base text-muted-foreground leading-snug max-w-[200px] mx-auto">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
