import { NextResponse } from "next/server";
import { createServerClient } from "../../../../src/infrastructure/database/supabase-server";

/**
 * GET /api/subscription-services
 * Get active subscription service categories and services (public endpoint)
 */
export async function GET() {
  try {
    const supabase = await createServerClient();

    // Get only active categories
    const { data: categories, error: categoriesError } = await supabase
      .from("SubscriptionServiceCategory")
      .select("*")
      .eq("isActive", true)
      .order("displayOrder", { ascending: true });

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    // Get only active services (sorted alphabetically by name)
    const { data: services, error: servicesError } = await supabase
      .from("SubscriptionService")
      .select("*")
      .eq("isActive", true)
      .order("name", { ascending: true });

    if (servicesError) {
      console.error("Error fetching services:", servicesError);
      return NextResponse.json(
        { error: "Failed to fetch services" },
        { status: 500 }
      );
    }

    // Group services by category
    const servicesByCategory = new Map<string, typeof services>();
    (services || []).forEach((service: any) => {
      if (!servicesByCategory.has(service.categoryId)) {
        servicesByCategory.set(service.categoryId, []);
      }
      servicesByCategory.get(service.categoryId)!.push(service);
    });

    // Enrich categories with their services
    const enrichedCategories = (categories || []).map((category: any) => ({
      ...category,
      services: servicesByCategory.get(category.id) || [],
    }));

    return NextResponse.json({
      categories: enrichedCategories,
      services: services || [],
    });
  } catch (error) {
    console.error("Error in GET /api/subscription-services:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

