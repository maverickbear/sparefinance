"use client";

import { useInView } from "@/hooks/use-in-view";
import { PenLine, FileSpreadsheet, Download, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const BULLETS = [
  "Add accounts and transactions manually.",
  "Import from CSV when you have it.",
  "Export when you need.",
];

// Icons map 1:1 to the "your data, your control" message: how you add data, import, export, and access anywhere.
const ICONS = [
  { icon: PenLine, label: "Add manually" },
  { icon: FileSpreadsheet, label: "Import CSV" },
  { icon: Download, label: "Export" },
  { icon: Smartphone, label: "Any device" },
];

export function IntegrationsSection() {
  const { ref, inView } = useInView();

  return (
    <section ref={ref} className="py-16 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className={cn("transition-all duration-700", inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Your data, your control.</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              We work the way you do. Add manually or import CSV, export when you need—you're in control.
            </p>
            <ul className="mt-6 space-y-3">
              {BULLETS.map((text) => (
                <li key={text} className="flex items-center gap-3 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className={cn("flex flex-wrap justify-center gap-6 transition-all duration-700 delay-200", inView ? "opacity-100 scale-100" : "opacity-0 scale-95")}>
            {ICONS.map(({ icon: Icon, label }, i) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-[32px] border border-border bg-card p-6 hover:border-primary/30 hover:shadow-md transition-all"
              >
                <Icon className="h-10 w-10 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
