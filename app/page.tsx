import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingMainFooter } from "@/components/landing/landing-main-footer";
import { LandingMobileFooter } from "@/components/landing/landing-mobile-footer";
import { StructuredData } from "@/src/presentation/components/seo/structured-data";
import { makeAuthService } from "@/src/application/auth/auth.factory";
import { startServerPagePerformance } from "@/lib/utils/performance";

// Lazy load heavy landing page components for better initial load performance
const LandingHeroSection = nextDynamic(() => import("@/components/landing/landing-hero-section").then(m => ({ default: m.LandingHeroSection })), { ssr: true });
const StatisticsSection = nextDynamic(() => import("@/components/landing/statistics-section").then(m => ({ default: m.StatisticsSection })), { ssr: true });
const LandingFeaturesSection = nextDynamic(() => import("@/components/landing/landing-features-section").then(m => ({ default: m.LandingFeaturesSection })), { ssr: true });
const BenefitsSection = nextDynamic(() => import("@/components/landing/benefits-section").then(m => ({ default: m.BenefitsSection })), { ssr: true });
// const LandingTestimonialsSection = nextDynamic(() => import("@/components/landing/landing-testimonials-section").then(m => ({ default: m.LandingTestimonialsSection })), { ssr: true });
const PricingSection = nextDynamic(() => import("@/components/landing/pricing-section").then(m => ({ default: m.PricingSection })), { ssr: true });

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.sparefinance.com';

// Default SEO settings (used as fallback)
const defaultSEOSettings = {
  title: "Spare Finance - Powerful Tools for Easy Money Management",
  titleTemplate: "%s | Spare Finance",
  description: "Take control of your finances with Spare Finance. Track expenses, manage budgets, set savings goals, and build wealth together with your household. Start your 30-day free trial today.",
  keywords: [
    "personal finance",
    "expense tracking",
    "budget management",
    "financial planning",
    "money management",
    "household finance",
    "savings goals",
    "investment tracking",
    "debt management",
    "financial dashboard",
    "budget app",
    "finance software",
    "money tracker",
    "expense manager",
  ],
  author: "Spare Finance",
  publisher: "Spare Finance",
  openGraph: {
    title: "Spare Finance - Powerful Tools for Easy Money Management",
    description: "Take control of your finances with Spare Finance. Track expenses, manage budgets, set savings goals, and build wealth together with your household.",
    image: "/og-image.png",
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: "Spare Finance - Personal Finance Management Platform",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spare Finance - Powerful Tools for Easy Money Management",
    description: "Take control of your finances with Spare Finance. Track expenses, manage budgets, set savings goals, and build wealth together.",
    image: "/og-image.png",
    creator: "@sparefinance",
  },
};

// Fetch SEO settings from database
async function getSEOSettings() {
  try {
    const { makeAdminService } = await import("@/src/application/admin/admin.factory");
    const adminService = makeAdminService();
    return await adminService.getPublicSeoSettings();
  } catch (error) {
    console.error("Error fetching SEO settings:", error);
  }
  return null;
}

// Generate metadata dynamically
export async function generateMetadata() {
  const seoSettings = await getSEOSettings();
  const settings = seoSettings || defaultSEOSettings;

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: settings.title,
      template: settings.titleTemplate,
    },
    description: settings.description,
    keywords: settings.keywords,
    authors: [{ name: settings.author }],
    creator: settings.author,
    publisher: settings.publisher,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: baseUrl,
      siteName: "Spare Finance",
      title: settings.openGraph.title,
      description: settings.openGraph.description,
      images: [
        {
          url: settings.openGraph.image,
          width: settings.openGraph.imageWidth,
          height: settings.openGraph.imageHeight,
          alt: settings.openGraph.imageAlt,
        },
      ],
    },
    twitter: {
      card: settings.twitter.card as "summary" | "summary_large_image",
      title: settings.twitter.title,
      description: settings.twitter.description,
      images: [settings.twitter.image],
      creator: settings.twitter.creator,
    },
    alternates: {
      canonical: baseUrl,
    },
    category: "Finance",
    classification: "Business",
  };
}

/**
 * Landing Page
 * 
 * This page serves as the public landing page accessible to unauthenticated users only.
 * Authenticated users are automatically redirected to /dashboard.
 */
export default async function LandingPage() {
  const perf = startServerPagePerformance("Landing");
  
  // Check authentication status - redirect authenticated users to dashboard
  const authService = makeAuthService();
  const user = await authService.getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }
  
  // Check maintenance mode status
  let isMaintenanceMode = false;
  try {
    const { makeAdminService } = await import("@/src/application/admin/admin.factory");
    const adminService = makeAdminService();
    const settings = await adminService.getPublicSystemSettings();
    isMaintenanceMode = settings.maintenanceMode || false;
  } catch (error) {
    // If error, default to no maintenance mode
    console.error("Error checking maintenance mode:", error);
  }
  
  // Fetch SEO settings from database
  let seoSettings = null;
  try {
    const { makeAdminService } = await import("@/src/application/admin/admin.factory");
    const adminService = makeAdminService();
    seoSettings = await adminService.getPublicSeoSettings();
  } catch (error) {
    // If error, use defaults (handled in StructuredData component)
    console.error("Error fetching SEO settings:", error);
  }
  
  perf.end();

  return (
    <>
      <StructuredData seoSettings={seoSettings} />
      <div className="min-h-screen flex flex-col">
        <LandingHeader isAuthenticated={false} />
        <main className="flex-1 pb-20 md:pb-0">
          <LandingHeroSection />
          <StatisticsSection />
          <LandingFeaturesSection />
          <BenefitsSection />
          {/* <LandingTestimonialsSection /> */}
          {!isMaintenanceMode && <PricingSection />}
        </main>
        <LandingMainFooter />
        <LandingMobileFooter isAuthenticated={false} />
      </div>
    </>
  );
}

