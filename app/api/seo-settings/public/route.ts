import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";

/**
 * GET /api/seo-settings/public
 * Public endpoint to get SEO settings for landing page
 * No authentication required
 */
export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Get system settings
    const { data: settings, error } = await supabase
      .from("SystemSettings")
      .select("seoSettings")
      .eq("id", "default")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching SEO settings:", error);
      // Return defaults if error
      return NextResponse.json(getDefaultSEOSettings());
    }

    // If no settings exist, return defaults
    if (!settings || !settings.seoSettings) {
      return NextResponse.json(getDefaultSEOSettings());
    }

    return NextResponse.json(settings.seoSettings);
  } catch (error: any) {
    console.error("Error fetching SEO settings:", error);
    // Return defaults if error
    return NextResponse.json(getDefaultSEOSettings());
  }
}

function getDefaultSEOSettings() {
  return {
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
    organization: {
      name: "Spare Finance",
      logo: "/icon-512x512.png",
      url: process.env.NEXT_PUBLIC_APP_URL || "https://app.sparefinance.com",
      socialLinks: {
        twitter: "",
        linkedin: "",
        facebook: "",
        instagram: "",
      },
    },
    application: {
      name: "Spare Finance",
      description: "Take control of your finances with Spare Finance. Track expenses, manage budgets, set savings goals, and build wealth together with your household.",
      category: "FinanceApplication",
      operatingSystem: "Web",
      price: "0",
      priceCurrency: "USD",
      offersUrl: "/pricing",
    },
  };
}

