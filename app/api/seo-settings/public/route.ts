import { NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/seo-settings/public
 * Public endpoint to get SEO settings for landing page
 * No authentication required
 */
export async function GET() {
  try {
    const service = makeAdminService();
    const seoSettings = await service.getPublicSeoSettings();

    return NextResponse.json(seoSettings);
  } catch (error: any) {
    // Handle prerendering errors gracefully
    if (error?.message?.includes('prerender') || 
        error?.message?.includes('HANGING_PROMISE') ||
        error?.message?.includes('fetch() rejects')) {
      // Return default SEO settings during prerendering
      return NextResponse.json({
        title: "Spare Finance - Powerful Tools for Easy Money Management",
        description: "Take control of your finances with Spare Finance.",
        googleTagId: null,
      });
    }
    
    console.error("Error fetching SEO settings:", error);
    // Return empty object if error (client will handle defaults)
    return NextResponse.json({ seoSettings: null });
  }
}

