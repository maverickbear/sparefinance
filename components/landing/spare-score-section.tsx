"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingImage } from "./landing-image";
import { useInView } from "@/hooks/use-in-view";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const BULLETS = [
  "See your score on the dashboard.",
  "Understand what affects it.",
  "Get clear next steps.",
];

export function SpareScoreSection() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className={cn("order-2 lg:order-1 transition-all duration-700", inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6")}>
            <div className="relative aspect-[4/3] max-w-md mx-auto rounded-[32px] bg-[#f8f4f1] overflow-hidden">
              <LandingImage
                src="spare-score.jpg"
                alt="Spare Score: your financial health at a glance, 0–100"
                fill
                className="object-cover"
                sizes="(max-width: 448px) 100vw, 448px"
              />
            </div>
          </div>
          <div className={cn("order-1 lg:order-2 transition-all duration-700 delay-150", inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6")}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Spare Score — your financial health at a glance.</h2>
            <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
              A simple 0–100 score based on cash flow, emergency fund, debt, and savings. No punishment for missing data; it&apos;s coaching-oriented and explainable.
            </p>
            <ul className="mt-6 space-y-3">
              {BULLETS.map((text) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="shrink-0 rounded-full bg-primary/20 p-1">
                    <Check className="h-4 w-4 text-primary" />
                  </span>
                  <span className="text-muted-foreground">{text}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="medium" className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/auth/signup">Start 30-day free trial</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
