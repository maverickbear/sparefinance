"use client";

import { useInView } from "@/hooks/use-in-view";
import { Card, CardContent } from "@/components/ui/card";
import { LandingImage } from "./landing-image";
import { LayoutDashboard, Target, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    number: "01",
    title: "Dashboard & Spare Score",
    description: "Your money in one place, plus a clear health score so you know where you stand.",
    icon: LayoutDashboard,
    image: "dashboard.jpg",
    imageAlt: "Dashboard with Spare Score and overview",
  },
  {
    number: "02",
    title: "Budgets & goals",
    description: "Set limits and targets. See progress and stay on track.",
    icon: Target,
    image: "budgets.jpg",
    imageAlt: "Budgets and savings goals",
  },
  {
    number: "03",
    title: "Reports & planning",
    description: "Understand patterns. Plan payments and cash flow with confidence.",
    icon: FileText,
    image: "planning.jpg",
    imageAlt: "Reports and planned payments",
  },
];

export function FeatureCardsSection() {
  const { ref, inView } = useInView();

  return (
    <section id="features" ref={ref} className="py-16 md:py-24 scroll-mt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {FEATURES.map(({ number, title, description, icon: Icon, image, imageAlt }, i) => (
            <Card
              key={number}
              className={cn(
                "transition-all duration-500 border-border hover:shadow-lg hover:border-primary/30 overflow-hidden",
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              )}
              style={{ transitionDelay: inView ? `${i * 100}ms` : "0ms" }}
            >
              <div className="relative aspect-video w-full bg-[#f8f4f1]">
                <LandingImage
                  src={image}
                  alt={imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <CardContent className="p-6">
                <span className="text-2xl font-bold text-primary">{number}</span>
                <div className="mt-4 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                </div>
                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
