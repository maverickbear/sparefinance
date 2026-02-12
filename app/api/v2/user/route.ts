import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeProfileService } from "@/src/application/profile/profile.factory";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { AppError } from "@/src/application/shared/app-error";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";

/**
 * GET /api/v2/user
 * Returns user data with plan and subscription information.
 * Portal admins (admin table only) get minimal user data without subscription.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const adminService = makeAdminService();
    if (await adminService.isSuperAdmin(userId)) {
      const supabase = createServiceRoleClient();
      const { data: adminRow } = await supabase
        .from("admin")
        .select("name, email")
        .eq("user_id", userId)
        .maybeSingle();
      const name = adminRow?.name ?? null;
      const email = adminRow?.email ?? "";
      const cacheHeaders = getCacheHeaders("semi-static");
      return NextResponse.json(
        {
          user: { id: userId, email, name, avatarUrl: null },
          plan: null,
          subscription: null,
          userRole: "super_admin" as const,
        },
        { status: 200, headers: cacheHeaders }
      );
    }

    const service = makeProfileService();
    const data = await service.getUserWithSubscription(userId);

    const cacheHeaders = getCacheHeaders("semi-static");
    return NextResponse.json(data, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

