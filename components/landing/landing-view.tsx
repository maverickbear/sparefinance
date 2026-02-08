"use client";

import { LandingHeader } from "./landing-header";
import { HeroSection } from "./hero-section";
import { ProblemSection } from "./problem-section";
import { RealitySection } from "./reality-section";
import { ProductOverviewSection } from "./product-overview-section";
import { FeaturesShowcase } from "./features-showcase";
import { IntegrationsSection } from "./integrations-section";
import { TrustSection } from "./trust-section";
import { HowItWorksSection } from "./how-it-works-section";
import { PricingSection } from "./pricing-section";
import { FAQSection } from "./faq-section";
import { CTASection } from "./cta-section";
import { LandingFooter } from "./landing-footer";

export function LandingView() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main>
        <HeroSection />
        <ProblemSection />
        <RealitySection />
        <ProductOverviewSection />
        <FeaturesShowcase />
        <IntegrationsSection />
        <TrustSection />
        <HowItWorksSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
        <LandingFooter />
      </main>
    </div>
  );
}
