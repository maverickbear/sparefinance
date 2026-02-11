"use client";

import { LandingHeader } from "./landing-header";
import { HeroSection } from "./hero-section";
import { ProblemSection } from "./problem-section";
import { RealitySection } from "./reality-section";
import { DebtAwarenessSection } from "./debt-awareness-section";
import { ProductOverviewSection } from "./product-overview-section";
import { FeaturesShowcase } from "./features-showcase";
import { IntegrationsSection } from "./integrations-section";
import { MobileMockupSection } from "./mobile-mockup-section";
import { TrustSection } from "./trust-section";
import { PricingSection } from "./pricing-section";
import { LandingFooter } from "./landing-footer";

export function LandingView() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main>
        <HeroSection />
        <ProblemSection />
        <ProductOverviewSection />
        <RealitySection />
        <DebtAwarenessSection />
        <FeaturesShowcase />
        <IntegrationsSection />
        <MobileMockupSection />
        <TrustSection />
        <PricingSection />
        <LandingFooter />
      </main>
    </div>
  );
}
