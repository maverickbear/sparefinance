"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DashboardDemo } from "./demo/dashboard-demo";

export function HeroSection() {
  return (
    <section id="home" className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#6b21a8] via-[#7c3aed] to-[#5b21b6] pt-24 md:pt-32">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]"></div>
      </div>
      
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#a78bfa]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#a78bfa]/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
            Take Control of Your Finances. Automatically.
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl md:text-2xl text-white/80 max-w-2xl mx-auto">
            Connect your bank accounts, track spending, manage budgets, and reach your financial goals—all in one powerful platform. Join thousands who've transformed their financial future.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              asChild
              className="bg-[#a78bfa] text-white hover:bg-[#a78bfa]/90 text-base font-semibold px-8 py-6 h-auto rounded-[12px] shadow-lg hover:shadow-xl transition-all"
            >
              <Link href="#pricing">Start Free Forever</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-base font-semibold px-8 py-6 h-auto rounded-[12px] backdrop-blur-sm"
            >
              <Link href="#features">
                Learn More
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="mt-16 max-w-7xl mx-auto">
          <div className="relative rounded-t-2xl rounded-bl-none rounded-br-none overflow-hidden shadow-2xl border-t border-l border-r border-white/10 backdrop-blur-sm bg-white/5">
            <DashboardDemo />
          </div>
        </div>
      </div>
    </section>
  );
}

