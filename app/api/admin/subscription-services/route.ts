import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "../../../../src/infrastructure/database/supabase-server";

async function isSuperAdmin(): Promise<boolean> {
  try {
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
 * GET /api/admin/subscription-services
 * Get all subscription service categories and services
 */
export async function GET() {
  try {
    // Use service role client to get all data (including inactive)
    const supabase = createServiceRoleClient();

    // Get all categories
    const { data: categories, error: categoriesError } = await supabase
      .from("SubscriptionServiceCategory")
      .select("*")
      .order("displayOrder", { ascending: true });

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    // Get all services (sorted alphabetically by name)
    const { data: services, error: servicesError } = await supabase
      .from("SubscriptionService")
      .select("*")
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
    console.error("Error in GET /api/admin/subscription-services:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


