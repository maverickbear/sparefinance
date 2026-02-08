"use client";

import { useInView } from "@/hooks/use-in-view";
import { Card, CardContent } from "@/components/ui/card";
import { LandingImage } from "./landing-image";
import { LayoutDashboard, Target, BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const OFFERS = [
  { title: "Dashboard & score", description: "Your financial picture and health score.", icon: LayoutDashboard, image: "dashboard.jpg", imageAlt: "Dashboard and Spare Score" },
  { title: "Budgets & goals", description: "Spend on purpose. Save for what matters.", icon: Target, image: "budgets.jpg", imageAlt: "Budgets and goals" },
  { title: "Tracking & reports", description: "Transactions, categories, and insights.", icon: BarChart3, image: "reports.jpg", imageAlt: "Reports and insights" },
  { title: "Household", description: "Manage money together.", icon: Users, image: "family.jpg", imageAlt: "Household and family" },
];

export function OfferGridSection() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="py-16 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">What you get.</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Everything you need to see and manage your money in one place.
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {OFFERS.map(({ title, description, icon: Icon, image, imageAlt }, i) => (
            <Card
              key={title}
              className={cn(
                "transition-all duration-500 hover:shadow-lg hover:border-primary/30 overflow-hidden",
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              )}
              style={{ transitionDelay: inView ? `${i * 80}ms` : "0ms" }}
            >
              <div className="relative aspect-[4/3] w-full bg-[#f8f4f1]">
                <LandingImage
                  src={image}
                  alt={imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
              <CardContent className="p-6">
                <div className="rounded-xl bg-primary/10 w-12 h-12 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
