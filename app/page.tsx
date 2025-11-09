import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { ParallaxFeaturesSection } from "@/components/landing/parallax-features-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata = {
  title: "Spare Finance - Powerful Tools for Easy Money Management",
  description: "Simple, modern, and designed to put you in control of your future. Track expenses, manage budgets, and achieve your financial goals.",
};

/**
 * Landing Page
 * 
 * This page serves as the public landing page accessible to all users,
 * whether authenticated or not. Users can access this page at any time
 * by navigating to "/".
 * 
 * After login, users are automatically redirected to /dashboard, but they
 * can always return to this landing page if they want to see the site.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <ParallaxFeaturesSection />
        <TestimonialsSection />
        <PricingSection />
      </main>
      <LandingFooter />
    </div>
  );
}

