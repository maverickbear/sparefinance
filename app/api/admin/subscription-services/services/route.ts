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
 * POST /api/admin/subscription-services/services
 * Create a new subscription service
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { categoryId, name, logo, isActive } = body;

    if (!categoryId || !name) {
      return NextResponse.json(
        { error: "Category ID and service name are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const id = `svc_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

    const { data: service, error } = await supabase
      .from("SubscriptionService")
      .insert({
        id,
        categoryId,
        name: name.trim(),
        logo: logo || null,
        displayOrder: 0, // Not used anymore, services are sorted alphabetically
        isActive: isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating service:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create service" },
        { status: 500 }
      );
    }

    return NextResponse.json({ service });
  } catch (error) {
    console.error("Error in POST /api/admin/subscription-services/services:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/subscription-services/services
 * Update a subscription service
 */
export async function PUT(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, categoryId, name, logo, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Service ID is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (name !== undefined) updateData.name = name.trim();
    if (logo !== undefined) updateData.logo = logo || null;
    // displayOrder is not updated - services are sorted alphabetically
    if (isActive !== undefined) updateData.isActive = isActive;

    const { data: service, error } = await supabase
      .from("SubscriptionService")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating service:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update service" },
        { status: 500 }
      );
    }

    return NextResponse.json({ service });
  } catch (error) {
    console.error("Error in PUT /api/admin/subscription-services/services:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/subscription-services/services
 * Delete a subscription service
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
        { error: "Service ID is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Check if service is used in any user subscriptions
    const { data: userSubscriptions, error: checkError } = await supabase
      .from("UserServiceSubscription")
      .select("id")
      .eq("serviceName", (await supabase.from("SubscriptionService").select("name").eq("id", id).single()).data?.name || "")
      .limit(1);

    // Note: This is a simple check. In production, you might want to link UserServiceSubscription to SubscriptionService via a foreign key

    const { error } = await supabase
      .from("SubscriptionService")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting service:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete service" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/admin/subscription-services/services:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

