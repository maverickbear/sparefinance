"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";

export function TrustSection() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className={cn("py-16 md:py-24 bg-background-dark text-white transition-all duration-700", inView ? "opacity-100" : "opacity-0")}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Trusted with your money.</h2>
            <blockquote className="mt-6 text-lg text-white/90 italic">
              &ldquo;Finally, one place where I see everything. No more spreadsheets.&rdquo;
            </blockquote>
            <p className="mt-2 text-sm text-white/70">— User, Spare Finance</p>
          </div>
          <Card className="border-white/20 bg-white/5">
            <CardContent className="p-6 md:p-8">
              <h3 className="text-xl font-semibold">Secure by design.</h3>
              <p className="mt-2 text-white/80 text-sm leading-relaxed">
                Bank-level encryption. We don&apos;t sell your data. You stay in control.
              </p>
              <Button asChild size="medium" className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/auth/signup">Start free trial</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
