import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";

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
 * POST /api/admin/subscription-services/categories
 * Create a new subscription service category
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, displayOrder, isActive } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const id = `cat_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

    const { data: category, error } = await supabase
      .from("SubscriptionServiceCategory")
      .insert({
        id,
        name: name.trim(),
        displayOrder: displayOrder ?? 0,
        isActive: isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating category:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error in POST /api/admin/subscription-services/categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/subscription-services/categories
 * Update a subscription service category
 */
export async function PUT(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, displayOrder, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const { data: category, error } = await supabase
      .from("SubscriptionServiceCategory")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating category:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error in PUT /api/admin/subscription-services/categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/subscription-services/categories
 * Delete a subscription service category
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Check if category has services
    const { data: services, error: servicesError } = await supabase
      .from("SubscriptionService")
      .select("id")
      .eq("categoryId", id)
      .limit(1);

    if (servicesError) {
      console.error("Error checking services:", servicesError);
      return NextResponse.json(
        { error: "Failed to check category services" },
        { status: 500 }
      );
    }

    if (services && services.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete category with existing services. Delete or move services first." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("SubscriptionServiceCategory")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting category:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/admin/subscription-services/categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

