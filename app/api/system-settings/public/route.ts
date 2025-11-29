import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";

/**
 * GET /api/system-settings/public
 * Public endpoint to check maintenance mode status
 * No authentication required - used by landing page and login page
 */
export async function GET() {
  try {
    // Use service role client to bypass RLS and get settings
    const supabase = createServiceRoleClient();

    // Get system settings (should only have one row with id='default')
    const { data: settings, error } = await supabase
      .from("SystemSettings")
      .select("maintenanceMode")
      .eq("id", "default")
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" - we'll return default if it doesn't exist
      console.error("Error fetching system settings:", error);
      // Return false (no maintenance) if there's an error
      return NextResponse.json({
        maintenanceMode: false,
      });
    }

    // If no settings exist, return default (no maintenance)
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
    // Return false (no maintenance) if there's an error
    return NextResponse.json({
      maintenanceMode: false,
    });
  }
}

