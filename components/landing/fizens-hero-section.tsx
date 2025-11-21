"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DashboardDemo } from "./demo/dashboard-demo";

export function FizensHeroSection() {
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
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#4A4AF2]/20 dark:bg-[#2A2AB8]/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-colors duration-1000 ease-in-out"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#4A4AF2]/20 dark:bg-[#2A2AB8]/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 transition-colors duration-1000 ease-in-out"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center space-y-8 md:space-y-12">
            {/* Text Content */}
            <div className="text-center space-y-6 md:space-y-8 w-full">
              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight">
                Stop Working Just to Pay Bills.<br />Start Building Your Future.
              </h1>

              {/* Sub-headline */}
              <p className="text-base sm:text-lg md:text-xl text-white/90 max-w-3xl mx-auto font-light leading-relaxed">
                Organize your finances, understand where your money goes, and learn to save together as a family. Get insights based on your real spending to build a healthy financial life.
              </p>

              {/* CTA */}
              <div className="pt-6">
                <Button
                  asChild
                  className="bg-white text-[#1A1A8F] hover:bg-white/90 text-lg font-semibold px-10 h-14 rounded-full transition-all shadow-lg hover:shadow-xl"
                >
                  <Link href="#pricing">Start Organizing Your Finances</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Dashboard preview - Apple Style */}
          <div className="mt-24 md:mt-32 max-w-7xl mx-auto">
            {/* Glow effect wrapper */}
            <div className="relative">
              {/* Strong glow effect - Purple tones */}
              <div className="absolute inset-0 -z-10 rounded-t-3xl bg-[#4A4AF2]/40 dark:bg-[#2A2AB8]/25 blur-3xl scale-110 transition-colors duration-1000 ease-in-out"></div>
              <div className="absolute inset-0 -z-10 rounded-t-3xl bg-[#6D6DFF]/30 dark:bg-[#1A1A7A]/20 blur-2xl scale-105 transition-colors duration-1000 ease-in-out"></div>
              <div className="absolute inset-0 -z-10 rounded-t-3xl bg-[#8B8BFF]/20 dark:bg-[#0D0D5A]/15 blur-xl scale-[1.02] transition-colors duration-1000 ease-in-out"></div>
              
              <div className="relative rounded-t-3xl overflow-hidden border-t border-l border-r border-white/10 backdrop-blur-sm bg-white/5 dark:bg-black/10 shadow-[0_0_80px_rgba(74,74,242,0.4),0_0_120px_rgba(109,109,255,0.3),0_0_200px_rgba(139,139,255,0.2)] dark:shadow-[0_0_80px_rgba(42,42,184,0.2),0_0_120px_rgba(26,26,122,0.15),0_0_200px_rgba(13,13,90,0.1)] transition-all duration-1000 ease-in-out">
                <DashboardDemo />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

