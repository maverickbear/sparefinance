import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingMainFooter } from "@/components/landing/landing-main-footer";
import { StructuredData } from "@/src/presentation/components/seo/structured-data";
import { makeAuthService } from "@/src/application/auth/auth.factory";

// Lazy load heavy landing page components for better initial load performance
const LandingHeroSection = nextDynamic(() => import("@/components/landing/landing-hero-section").then(m => ({ default: m.LandingHeroSection })), { ssr: true });
const StatisticsSection = nextDynamic(() => import("@/components/landing/statistics-section").then(m => ({ default: m.StatisticsSection })), { ssr: true });
const LandingFeaturesSection = nextDynamic(() => import("@/components/landing/landing-features-section").then(m => ({ default: m.LandingFeaturesSection })), { ssr: true });
const BenefitsSection = nextDynamic(() => import("@/components/landing/benefits-section").then(m => ({ default: m.BenefitsSection })), { ssr: true });
// const LandingTestimonialsSection = nextDynamic(() => import("@/components/landing/landing-testimonials-section").then(m => ({ default: m.LandingTestimonialsSection })), { ssr: true });
const PricingSection = nextDynamic(() => import("@/components/landing/pricing-section").then(m => ({ default: m.PricingSection })), { ssr: true });
const FAQSection = nextDynamic(() => import("@/components/landing/faq-section").then(m => ({ default: m.FAQSection })), { ssr: true });

// Get base URL from environment variable, ensuring it's just the URL value
const envUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.sparefinance.com';
// Clean up the URL in case it includes the variable name (e.g., "NEXT_PUBLIC_APP_URL=http://localhost:3000")
const baseUrl = envUrl.includes('=') ? envUrl.split('=')[1] : envUrl;

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
  } catch (error: any) {
    // Silently handle prerendering errors - these are expected during build
    const errorMessage = error?.message || '';
    if (errorMessage.includes('prerender') || 
        errorMessage.includes('HANGING_PROMISE') ||
        errorMessage.includes('fetch() rejects') ||
        errorMessage.includes('Dynamic data sources')) {
      // During prerendering, return null to use defaults
      return null;
    }
    console.error("Error fetching SEO settings:", error);
  }
  return null;
}

// Generate metadata dynamically
export async function generateMetadata() {
  // Access headers() first to "unlock" Math.random() usage in createServiceRoleClient()
  // This is required by Next.js for Server Components that use Math.random()
  await headers();
  
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
 * Auth Check Component - Wrapped in Suspense to prevent blocking page render
 * Redirects authenticated users to dashboard (only when not in maintenance mode)
 * Maintenance mode check is handled by LandingPageContent
 */
async function AuthCheck() {
  try {
    const authService = makeAuthService();
    const user = await authService.getCurrentUser();
    
    // Check maintenance mode first
    await headers(); // Access headers() first to "unlock" Math.random() usage
    const { makeAdminService } = await import("@/src/application/admin/admin.factory");
    const adminService = makeAdminService();
    const settings = await adminService.getPublicSystemSettings();
    const isMaintenanceMode = settings.maintenanceMode || false;
    
    // If in maintenance mode, let LandingPageContent handle the redirect
    // (it will check if user is super_admin)
    if (isMaintenanceMode) {
      return null;
    }
    
    // If not in maintenance mode, redirect authenticated users to dashboard
    if (user) {
      redirect("/dashboard");
    }
  } catch (error: any) {
    // NEXT_REDIRECT is expected - Next.js uses exceptions for redirects
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      // Re-throw redirect exceptions - they should propagate
      throw error;
    }
    
    // Silently handle prerendering errors - these are expected during build
    const errorMessage = error?.message || '';
    if (errorMessage.includes('prerender') || 
        errorMessage.includes('HANGING_PROMISE') ||
        errorMessage.includes('cookies() rejects') ||
        errorMessage.includes('Dynamic data sources')) {
      // During prerendering, assume user is not authenticated - no redirect
      return null;
    }
    // For other errors, log but continue (don't block page render)
    console.error("Error checking authentication:", error);
  }
  
  return null;
}

/**
 * Maintenance Mode Check - Wrapped in Suspense to prevent blocking page render
 */
async function MaintenanceModeCheck() {
  // Access headers() first to "unlock" Math.random() usage in createServiceRoleClient()
  // This is required by Next.js for Server Components that use Math.random()
  await headers();
  
  try {
    const { makeAdminService } = await import("@/src/application/admin/admin.factory");
    const adminService = makeAdminService();
    const settings = await adminService.getPublicSystemSettings();
    return settings.maintenanceMode || false;
  } catch (error: any) {
    // Silently handle prerendering errors - these are expected during build
    const errorMessage = error?.message || '';
    if (errorMessage.includes('prerender') || 
        errorMessage.includes('HANGING_PROMISE') ||
        errorMessage.includes('fetch() rejects') ||
        errorMessage.includes('Dynamic data sources')) {
      // During prerendering, default to no maintenance mode
      return false;
    }
    // If error, default to no maintenance mode
    console.error("Error checking maintenance mode:", error);
    return false;
  }
}

/**
 * SEO Settings Fetch - Wrapped in Suspense to prevent blocking page render
 */
async function SEOSettingsFetch() {
  // Access headers() first to "unlock" Math.random() usage in createServiceRoleClient()
  // This is required by Next.js for Server Components that use Math.random()
  await headers();
  
  try {
    const { makeAdminService } = await import("@/src/application/admin/admin.factory");
    const adminService = makeAdminService();
    return await adminService.getPublicSeoSettings();
  } catch (error) {
    // If error, return null (handled in StructuredData component)
    console.error("Error fetching SEO settings:", error);
    return null;
  }
}

/**
 * Landing Page Content Wrapper
 * Only renders content if not in maintenance mode or if user is super_admin
 */
async function LandingPageContent() {
  // Access headers() first to "unlock" Math.random() usage in createServiceRoleClient()
  await headers();
  
  // Check maintenance mode
  const { makeAdminService } = await import("@/src/application/admin/admin.factory");
  const adminService = makeAdminService();
  const settings = await adminService.getPublicSystemSettings();
  const isMaintenanceMode = settings.maintenanceMode || false;
  
  // If maintenance mode is active, check if user is super_admin
  if (isMaintenanceMode) {
    const authService = makeAuthService();
    const user = await authService.getCurrentUser();
    
    if (user) {
      // Check if user is super_admin
      const { makeMembersService } = await import("@/src/application/members/members.factory");
      const membersService = makeMembersService();
      const userRole = await membersService.getUserRole(user.id);
      
      // If not super_admin, redirect to maintenance page
      if (userRole !== "super_admin") {
        redirect("/maintenance");
      }
      // super_admin can see landing page - continue
    } else {
      // Not authenticated - redirect to maintenance
      redirect("/maintenance");
    }
  }
  
  // Render landing page content
  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader isAuthenticated={false} />
      <main className="flex-1">
        <LandingHeroSection />
        <StatisticsSection />
        <LandingFeaturesSection />
        <BenefitsSection />
        {/* <LandingTestimonialsSection /> */}
        
        {/* Pricing Section - wrapped in Suspense to check maintenance mode */}
        <Suspense fallback={<PricingSection />}>
          <PricingSectionWrapper />
        </Suspense>
        
        {/* FAQ Section */}
        <Suspense fallback={<div className="py-20" />}>
          <FAQSection />
        </Suspense>
      </main>
      <LandingMainFooter />
    </div>
  );
}

/**
 * Landing Page
 * 
 * This page serves as the public landing page accessible to unauthenticated users only.
 * During maintenance mode, only super_admin users can access it.
 * Authenticated users are automatically redirected to /dashboard.
 * 
 * Uses Suspense boundaries to prevent blocking page render while checking auth/maintenance.
 * The main component is synchronous and renders immediately, while async operations
 * (auth check, maintenance mode, SEO settings) complete in parallel within Suspense boundaries.
 */
export default function LandingPage() {
  return (
    <>
      {/* SEO Settings - wrapped in Suspense */}
      <Suspense fallback={null}>
        <SEOSettingsWrapper />
      </Suspense>
      
      {/* Auth Check - wrapped in Suspense (will redirect if authenticated and not in maintenance) */}
      <Suspense fallback={null}>
        <AuthCheck />
      </Suspense>
      
      {/* Main page content - wrapped in Suspense to check maintenance mode */}
      <Suspense fallback={
        <div className="min-h-screen flex flex-col">
          <LandingHeader isAuthenticated={false} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          </main>
        </div>
      }>
        <LandingPageContent />
      </Suspense>
    </>
  );
}

/**
 * SEO Settings Wrapper - Fetches and renders StructuredData
 */
async function SEOSettingsWrapper() {
  const seoSettings = await SEOSettingsFetch();
  return <StructuredData seoSettings={seoSettings} />;
}

/**
 * Pricing Section Wrapper - Checks maintenance mode before rendering
 */
async function PricingSectionWrapper() {
  const isMaintenanceMode = await MaintenanceModeCheck();
  
  if (isMaintenanceMode) {
    return null;
  }
  
  return <PricingSection />;
}

