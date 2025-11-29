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
 * GET /api/admin/subscription-services/plans
 * Get all plans for a service
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId");

    if (!serviceId) {
      return NextResponse.json(
        { error: "Service ID is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: plans, error } = await supabase
      .from("SubscriptionServicePlan")
      .select("*")
      .eq("serviceId", serviceId)
      .order("planName", { ascending: true });

    if (error) {
      console.error("Error fetching plans:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch plans" },
        { status: 500 }
      );
    }

    return NextResponse.json({ plans: plans || [] });
  } catch (error) {
    console.error("Error in GET /api/admin/subscription-services/plans:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/subscription-services/plans
 * Create a new plan
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { serviceId, planName, price, currency, isActive } = body;

    if (!serviceId || !planName || price === undefined || !currency) {
      return NextResponse.json(
        { error: "Service ID, plan name, price, and currency are required" },
        { status: 400 }
      );
    }

    if (currency !== "USD" && currency !== "CAD") {
      return NextResponse.json(
        { error: "Currency must be USD or CAD" },
        { status: 400 }
      );
    }

    if (price < 0) {
      return NextResponse.json(
        { error: "Price must be greater than or equal to 0" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const id = `plan_${serviceId}_${planName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

    const { data: plan, error } = await supabase
      .from("SubscriptionServicePlan")
      .insert({
        id,
        serviceId,
        planName: planName.trim(),
        price: parseFloat(price),
        currency,
        isActive: isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating plan:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create plan" },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Error in POST /api/admin/subscription-services/plans:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/subscription-services/plans
 * Update a plan
 */
export async function PUT(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, planName, price, currency, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    if (currency && currency !== "USD" && currency !== "CAD") {
      return NextResponse.json(
        { error: "Currency must be USD or CAD" },
        { status: 400 }
      );
    }

    if (price !== undefined && price < 0) {
      return NextResponse.json(
        { error: "Price must be greater than or equal to 0" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (planName !== undefined) updateData.planName = planName.trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (currency !== undefined) updateData.currency = currency;
    if (isActive !== undefined) updateData.isActive = isActive;

    const { data: plan, error } = await supabase
      .from("SubscriptionServicePlan")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating plan:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update plan" },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Error in PUT /api/admin/subscription-services/plans:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/subscription-services/plans
 * Delete a plan
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
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("SubscriptionServicePlan")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting plan:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete plan" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/admin/subscription-services/plans:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

