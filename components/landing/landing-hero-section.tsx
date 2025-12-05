"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DashboardDemo } from "./demo/dashboard-demo";

export function LandingHeroSection() {
  return (
    <section id="home" className="hero-gradient relative min-h-screen flex items-center justify-center overflow-hidden pt-24 md:pt-32">
      {/* Background patterns */}
      <div className="absolute inset-0">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-25">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjMiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]"></div>
        </div>
        {/* Dot pattern overlay */}
        <div className="absolute inset-0 opacity-25">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuNCIvPjwvc3ZnPg==')]"></div>
        </div>
      </div>
      
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-scale-500/20 dark:bg-primary-scale-600/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-colors duration-1000 ease-in-out"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-scale-500/20 dark:bg-primary-scale-600/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 transition-colors duration-1000 ease-in-out"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center space-y-8 md:space-y-12">
            {/* Text Content */}
            <div className="text-center space-y-6 md:space-y-8 w-full">
              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-black dark:text-black leading-tight tracking-tight">
                Take Control of Your Money — One Step at a Time.
              </h1>

              {/* Sub-headline */}
              <p className="text-base sm:text-lg md:text-xl text-black/90 dark:text-black/90 max-w-3xl mx-auto font-light leading-relaxed">
                Spare Finance helps you understand your spending, build better habits, and plan a stronger financial future — whether you manage money alone or with your household.
              </p>

              {/* CTA */}
              <div className="pt-6 space-y-1">
                <Button
                  asChild
                  variant="secondary"
                  size="large"
                  className="shadow-lg hover:shadow-xl"
                >
                  <Link href="/auth/signup">Start your 30-day free trial</Link>
                </Button>
                <p className="text-sm text-black/80 dark:text-black/80">
                  No credit card needed.
                </p>
              </div>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="mt-24 md:mt-32 max-w-7xl mx-auto">
            {/* Glow effect wrapper */}
            <div className="relative">
              {/* Strong glow effect - Green tones */}
              <div className="absolute inset-0 -z-10 rounded-t-3xl bg-primary-scale-500/40 dark:bg-primary-scale-600/25 blur-3xl scale-110 transition-colors duration-1000 ease-in-out"></div>
              <div className="absolute inset-0 -z-10 rounded-t-3xl bg-primary-scale-400/30 dark:bg-primary-scale-900/20 blur-2xl scale-105 transition-colors duration-1000 ease-in-out"></div>
              <div className="absolute inset-0 -z-10 rounded-t-3xl bg-primary-scale-300/20 dark:bg-primary-scale-900/15 blur-xl scale-[1.02] transition-colors duration-1000 ease-in-out"></div>
              
              <div className="relative rounded-t-3xl overflow-hidden border-t border-l border-r border-white/10 backdrop-blur-sm bg-white/5 dark:bg-black/10 shadow-[0_0_80px_hsl(var(--primary-500)/0.4),0_0_120px_hsl(var(--primary-400)/0.3),0_0_200px_hsl(var(--primary-300)/0.2)] dark:shadow-[0_0_80px_hsl(var(--primary-600)/0.2),0_0_120px_hsl(var(--primary-900)/0.15),0_0_200px_hsl(var(--primary-900)/0.1)] transition-all duration-1000 ease-in-out">
                <DashboardDemo />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

