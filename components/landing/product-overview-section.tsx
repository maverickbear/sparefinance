"use client";

import { useInView } from "@/hooks/use-in-view";
import { LandingImage } from "./landing-image";
import { cn } from "@/lib/utils";

export function ProductOverviewSection() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className={cn("py-16 md:py-24 bg-muted/30 transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Built for your whole financial picture.</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            One app for accounts, transactions, budgets, goals, debts, and insights.
          </p>
        </div>
        <div className="relative mt-12 w-full rounded-[32px] overflow-hidden aspect-video">
          {/* Dedicated background layer so color is not overridden when image loads */}
          <div
            className="absolute inset-0 rounded-[32px] z-0"
            style={{ backgroundColor: "rgb(248, 244, 241)" }}
            aria-hidden
          />
          <LandingImage
            src="clarity.jpg"
            alt="One app view: dashboard with accounts, transactions, budgets and goals"
            fill
            className="rounded-[32px] relative z-10"
            sizes="(max-width: 1152px) 100vw, 1152px"
          />
        </div>
      </div>
    </section>
  );
}
