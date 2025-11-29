import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";

async function isSuperAdmin(): Promise<boolean> {
  try {
    const { createServerClient } = await import("@/src/infrastructure/database/supabase-server");
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return false;
    }

    const { data: userData } = await supabase
      .from("User")
      .select("role")
      .eq("id", user.id)
      .single();

    return userData?.role === "super_admin";
  } catch (error) {
    console.error("Error checking super_admin status:", error);
    return false;
  }
}

/**
 * GET /api/admin/seo-settings
 * Get current SEO settings
 * Only accessible by super_admin
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { error: "Unauthorized: Only super_admin can access this endpoint" },
        { status: 403 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get system settings
    const { data: settings, error } = await supabase
      .from("SystemSettings")
      .select("*")
      .eq("id", "default")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching SEO settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch SEO settings" },
        { status: 500 }
      );
    }

    // If no settings exist, return defaults
    if (!settings || !settings.seoSettings) {
      return NextResponse.json(getDefaultSEOSettings());
    }

    return NextResponse.json(settings.seoSettings);
  } catch (error: any) {
    console.error("Error fetching SEO settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch SEO settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/seo-settings
 * Update SEO settings
 * Only accessible by super_admin
 */
export async function PUT(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { error: "Unauthorized: Only super_admin can access this endpoint" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const seoSettings = body;

    // Validate required fields
    if (!seoSettings.title || !seoSettings.description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Try to update existing settings
    const { data: updatedSettings, error: updateError } = await supabase
      .from("SystemSettings")
      .update({
        seoSettings,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", "default")
      .select()
      .single();

    // If update failed because row doesn't exist, create it
    if (updateError && updateError.code === "PGRST116") {
      const { data: existingSettings } = await supabase
        .from("SystemSettings")
        .select("maintenanceMode")
        .eq("id", "default")
        .single();

      const { data: newSettings, error: insertError } = await supabase
        .from("SystemSettings")
        .insert({
          id: "default",
          maintenanceMode: existingSettings?.maintenanceMode || false,
          seoSettings,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating SEO settings:", insertError);
        return NextResponse.json(
          { error: "Failed to create SEO settings" },
          { status: 500 }
        );
      }

      return NextResponse.json(newSettings.seoSettings);
    }

    if (updateError) {
      console.error("Error updating SEO settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update SEO settings" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedSettings?.seoSettings || seoSettings);
  } catch (error: any) {
    console.error("Error updating SEO settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update SEO settings" },
      { status: 500 }
    );
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

