"use client";

import { useInView } from "@/hooks/use-in-view";
import { LandingImage } from "./landing-image";
import { cn } from "@/lib/utils";

export function MobileMockupSection() {
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref}
      id="mobile"
      className={cn(
        "py-16 md:py-24 scroll-mt-20 transition-all duration-700",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Take it with you.</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Your dashboard, budgets, and goals—wherever you are. Spare Finance works on any device.
            </p>
          </div>
          <div className={cn("relative w-full", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 transition-all duration-700 delay-150")}>
            <div className="relative aspect-[4/3] max-w-lg mx-auto lg:ml-auto rounded-[32px] bg-[#f8f4f1] overflow-hidden">
              <LandingImage
                src="dashboard.jpg"
                alt="Spare Finance on mobile: take your dashboard and budgets with you"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
