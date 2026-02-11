"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const TESTIMONIALS = [
  { stars: 5, quote: "Finally, one place where I see everything. No more spreadsheets. Budgets and the Spare Score actually help me stay on track.", name: "James W.", role: "Designer" },
  { stars: 5, quote: "Simple and clear. My finances finally make sense. The dashboard is exactly what I needed.", name: "Sarah L.", role: "Teacher" },
  { stars: 4, quote: "Really solid app for tracking expenses and goals. Would be perfect if it had a mobile app—I'd use it even more on the go.", name: "Michael B.", role: "Freelancer" },
  { stars: 5, quote: "Tracking expenses used to be a chore. Now it takes seconds. Category suggestions are spot on.", name: "Emily C.", role: "Parent" },
  { stars: 4, quote: "Great for household budgeting. Would love to see PDF export for reports so I can share with my advisor.", name: "David M.", role: "Engineer" },
  { stars: 5, quote: "The goals feature kept me accountable. Hit my first savings target in years. No complaints.", name: "Jennifer K.", role: "User" },
  { stars: 5, quote: "Clean interface, does what it says. Bank-level security and no upsells. Refreshing.", name: "Christopher T.", role: "Developer" },
  { stars: 4, quote: "Works well for me and my partner. Only suggestion: dark mode on the dashboard would be easier on the eyes at night.", name: "Amanda R.", role: "Consultant" },
  { stars: 5, quote: "Worth every penny. Budgets, goals, and the Spare Score in one place. Finally stopped overspending.", name: "Daniel P.", role: "User" },
  { stars: 5, quote: "Straightforward and reliable. CSV import saved me hours. Recommended to a few friends already.", name: "Nicole G.", role: "Small business" },
];

const AUTO_ADVANCE_MS = 5000;

export function TrustSection() {
  const { ref, inView } = useInView();
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback((i: number) => {
    setIndex((prev) => {
      const next = i < 0 ? TESTIMONIALS.length - 1 : i >= TESTIMONIALS.length ? 0 : i;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!inView || isPaused) return;
    const t = setInterval(() => goTo(index + 1), AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [inView, isPaused, index, goTo]);

  const t = TESTIMONIALS[index];

  return (
    <section ref={ref} className={cn("py-16 md:py-24 bg-muted/40 text-foreground transition-all duration-700", inView ? "opacity-100" : "opacity-0")}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-center">Trusted with your money.</h2>
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous testimonial"
              className="absolute left-0 z-10 -translate-x-2 md:-translate-x-4 h-9 w-9 rounded-lg border border-border bg-background shadow-sm flex items-center justify-center text-foreground hover:bg-muted transition-colors"
              onClick={() => goTo(index - 1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <Card className="flex-1 border border-border bg-card shadow-sm overflow-hidden">
              <CardContent className="p-6 md:p-8 text-center">
                <div className="flex justify-center gap-0.5 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn("h-5 w-5", star <= t.stars ? "fill-foreground text-foreground" : "text-muted-foreground/40")}
                    />
                  ))}
                </div>
                <p className="text-foreground text-sm md:text-base leading-relaxed max-w-xl mx-auto">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="mt-4 font-semibold text-foreground">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.role}</p>
                <div className="flex justify-center gap-1.5 mt-6">
                  {TESTIMONIALS.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to testimonial ${i + 1}`}
                      className={cn(
                        "h-2 w-2 rounded-full transition-colors",
                        i === index ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                      )}
                      onClick={() => setIndex(i)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
            <button
              type="button"
              aria-label="Next testimonial"
              className="absolute right-0 z-10 translate-x-2 md:translate-x-4 h-9 w-9 rounded-lg border border-border bg-background shadow-sm flex items-center justify-center text-foreground hover:bg-muted transition-colors"
              onClick={() => goTo(index + 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
