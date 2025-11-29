import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingMainFooter } from "@/components/landing/landing-main-footer";
import { LandingMobileFooter } from "@/components/landing/landing-mobile-footer";
import { getCurrentUser } from "@/lib/api/auth";
import { startServerPagePerformance } from "@/lib/utils/performance";
import { createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";

// Lazy load heavy landing page components for better initial load performance
const LandingHeroSection = nextDynamic(() => import("@/components/landing/landing-hero-section").then(m => ({ default: m.LandingHeroSection })), { ssr: true });
const StatisticsSection = nextDynamic(() => import("@/components/landing/statistics-section").then(m => ({ default: m.StatisticsSection })), { ssr: true });
const LandingFeaturesSection = nextDynamic(() => import("@/components/landing/landing-features-section").then(m => ({ default: m.LandingFeaturesSection })), { ssr: true });
const BenefitsSection = nextDynamic(() => import("@/components/landing/benefits-section").then(m => ({ default: m.BenefitsSection })), { ssr: true });
const HowItWorksSection = nextDynamic(() => import("@/components/landing/how-it-works-section").then(m => ({ default: m.HowItWorksSection })), { ssr: true });
const LandingTestimonialsSection = nextDynamic(() => import("@/components/landing/landing-testimonials-section").then(m => ({ default: m.LandingTestimonialsSection })), { ssr: true });
const PricingSection = nextDynamic(() => import("@/components/landing/pricing-section").then(m => ({ default: m.PricingSection })), { ssr: true });

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Spare Finance - Powerful Tools for Easy Money Management",
  description: "Simple, modern, and designed to put you in control of your future. Track expenses, manage budgets, and achieve your financial goals.",
};

/**
 * Landing Page
 * 
 * This page serves as the public landing page accessible to unauthenticated users only.
 * Authenticated users are automatically redirected to /dashboard.
 */
export default async function LandingPage() {
  const perf = startServerPagePerformance("Landing");
  
  // Check authentication status - redirect authenticated users to dashboard
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }
  
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
      <LandingHeader isAuthenticated={false} />
      <main className="flex-1 pb-20 md:pb-0">
        <LandingHeroSection />
        <StatisticsSection />
        <LandingFeaturesSection />
        <BenefitsSection />
        <HowItWorksSection />
        <LandingTestimonialsSection />
        {!isMaintenanceMode && <PricingSection />}
      </main>
      <LandingMainFooter />
      <LandingMobileFooter isAuthenticated={false} />
    </div>
  );
}

