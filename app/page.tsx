import dynamic from "next/dynamic";
import { LandingHeader } from "@/components/landing/landing-header";
import { FizensFooter } from "@/components/landing/fizens-footer";
import { LandingMobileFooter } from "@/components/landing/landing-mobile-footer";
import { getCurrentUser } from "@/lib/api/auth";
import { startServerPagePerformance } from "@/lib/utils/performance";
import { createServiceRoleClient } from "@/lib/supabase-server";

// Lazy load heavy landing page components for better initial load performance
const FizensHeroSection = dynamic(() => import("@/components/landing/fizens-hero-section").then(m => ({ default: m.FizensHeroSection })), { ssr: true });
const StatisticsSection = dynamic(() => import("@/components/landing/statistics-section").then(m => ({ default: m.StatisticsSection })), { ssr: true });
const FizensFeaturesSection = dynamic(() => import("@/components/landing/fizens-features-section").then(m => ({ default: m.FizensFeaturesSection })), { ssr: true });
const BenefitsSection = dynamic(() => import("@/components/landing/benefits-section").then(m => ({ default: m.BenefitsSection })), { ssr: true });
const HowItWorksSection = dynamic(() => import("@/components/landing/how-it-works-section").then(m => ({ default: m.HowItWorksSection })), { ssr: true });
const FizensTestimonialsSection = dynamic(() => import("@/components/landing/fizens-testimonials-section").then(m => ({ default: m.FizensTestimonialsSection })), { ssr: true });
const PricingSection = dynamic(() => import("@/components/landing/pricing-section").then(m => ({ default: m.PricingSection })), { ssr: true });
const FAQSection = dynamic(() => import("@/components/landing/faq-section").then(m => ({ default: m.FAQSection })), { ssr: true });
const PartnersSection = dynamic(() => import("@/components/landing/partners-section").then(m => ({ default: m.PartnersSection })), { ssr: true });

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
export default async function LandingPage() {
  const perf = startServerPagePerformance("Landing");
  
  // Check authentication status on server to show correct buttons immediately
  const user = await getCurrentUser();
  const isAuthenticated = !!user;
  
  // Check maintenance mode status
  let isMaintenanceMode = false;
  try {
    const supabase = createServiceRoleClient();
    const { data: settings } = await supabase
      .from("SystemSettings")
      .select("maintenanceMode")
      .eq("id", "default")
      .single();
    
    isMaintenanceMode = settings?.maintenanceMode || false;
  } catch (error) {
    // If error, default to no maintenance mode
    console.error("Error checking maintenance mode:", error);
  }
  
  perf.end();

  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader isAuthenticated={isAuthenticated} />
      <main className="flex-1 pb-20 md:pb-0">
        <FizensHeroSection />
        <StatisticsSection />
        <FizensFeaturesSection />
        <BenefitsSection />
        <HowItWorksSection />
        <FizensTestimonialsSection />
        {!isMaintenanceMode && <PricingSection />}
        <FAQSection />
        <PartnersSection />
      </main>
      <FizensFooter />
      <LandingMobileFooter isAuthenticated={isAuthenticated} />
    </div>
  );
}

