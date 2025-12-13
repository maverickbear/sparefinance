"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DashboardDemo } from "./demo/dashboard-demo";

export function HeroSection() {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-scale-500 via-primary-scale-400 to-primary-scale-300 pt-24 md:pt-32">
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
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-scale-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-scale-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto text-center space-y-10 md:space-y-12">
          {/* Headline - Apple Style */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-foreground leading-tight tracking-tight">
            Take Control of Your<br />Finances. Automatically.
          </h1>

          {/* Sub-headline - Apple Style */}
          <p className="text-lg sm:text-xl md:text-2xl text-foreground/90 max-w-3xl mx-auto font-light leading-relaxed">
            Connect your bank accounts, track spending, manage budgets, and reach your financial goals—all in one powerful platform. Join thousands who've transformed their financial future.
          </p>

          {/* CTAs - Apple Style */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Button
              asChild
              size="medium"
            >
              <Link href="/auth/signup">Get Started</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="medium"
              className="backdrop-blur-sm"
            >
              <Link href="#features">
                Learn More
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Dashboard preview - Apple Style */}
        <div className="mt-24 md:mt-32 max-w-7xl mx-auto">
          {/* Glow effect wrapper */}
          <div className="relative">
            {/* Strong glow effect - Green tones */}
            <div className="absolute inset-0 -z-10 rounded-t-3xl bg-primary-scale-500/40 blur-3xl scale-110"></div>
            <div className="absolute inset-0 -z-10 rounded-t-3xl bg-primary-scale-400/30 blur-2xl scale-105"></div>
            <div className="absolute inset-0 -z-10 rounded-t-3xl bg-primary-scale-300/20 blur-xl scale-[1.02]"></div>
            
            <div className="relative rounded-t-3xl overflow-hidden border-t border-l border-r border-white/10 backdrop-blur-sm bg-white/5 shadow-[0_0_80px_hsl(var(--primary-500)/0.4),0_0_120px_hsl(var(--primary-400)/0.3),0_0_200px_hsl(var(--primary-300)/0.2)]">
              <DashboardDemo />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
