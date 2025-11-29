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
 * GET /api/admin/system-settings
 * Get current system settings (maintenance mode status)
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

    // Use service role client to bypass RLS and get settings
    const supabase = createServiceRoleClient();

    // Get system settings (should only have one row with id='default')
    const { data: settings, error } = await supabase
      .from("SystemSettings")
      .select("*")
      .eq("id", "default")
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" - we'll create default if it doesn't exist
      console.error("Error fetching system settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch system settings" },
        { status: 500 }
      );
    }

    // If no settings exist, return default
    if (!settings) {
      return NextResponse.json({
        maintenanceMode: false,
      });
    }

    return NextResponse.json({
      maintenanceMode: settings.maintenanceMode || false,
    });
  } catch (error: any) {
    console.error("Error fetching system settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch system settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/system-settings
 * Update system settings (maintenance mode)
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
    const { maintenanceMode } = body;

    if (typeof maintenanceMode !== "boolean") {
      return NextResponse.json(
        { error: "maintenanceMode must be a boolean" },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS and update settings
    const supabase = createServiceRoleClient();

    // Try to update existing settings
    const { data: updatedSettings, error: updateError } = await supabase
      .from("SystemSettings")
      .update({
        maintenanceMode,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", "default")
      .select()
      .single();

    // If update failed because row doesn't exist, create it
    if (updateError && updateError.code === "PGRST116") {
      const { data: newSettings, error: insertError } = await supabase
        .from("SystemSettings")
        .insert({
          id: "default",
          maintenanceMode,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating system settings:", insertError);
        return NextResponse.json(
          { error: "Failed to create system settings" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        maintenanceMode: newSettings.maintenanceMode,
      });
    }

    if (updateError) {
      console.error("Error updating system settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update system settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      maintenanceMode: updatedSettings?.maintenanceMode || false,
    });
  } catch (error: any) {
    console.error("Error updating system settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update system settings" },
      { status: 500 }
    );
  }
}

