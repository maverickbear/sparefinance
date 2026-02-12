import { NextRequest, NextResponse } from "next/server";
import { makeAuthService } from "@/src/application/auth/auth.factory";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { createServerClient, createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { AppError } from "@/src/application/shared/app-error";

/**
 * POST /api/auth/sync-session
 *
 * Syncs the client-side session with server-side cookies.
 * Supports both consumer users (users table) and portal admins (admin table only).
 */
export async function POST(request: NextRequest) {
  try {
    const service = makeAuthService();
    let result = await service.syncSession();

    if (!result.success) {
      const supabase = await createServerClient();
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!userError && authUser && session) {
        const adminService = makeAdminService();
        if (await adminService.isSuperAdmin(authUser.id)) {
          const serviceSupabase = createServiceRoleClient();
          const { data: adminRow } = await serviceSupabase
            .from("admin")
            .select("name, email")
            .eq("user_id", authUser.id)
            .maybeSingle();
          const name = adminRow?.name ?? authUser.user_metadata?.name ?? null;
          const email = adminRow?.email ?? authUser.email ?? "";
          result = {
            success: true,
            user: {
              id: authUser.id,
              email,
              name,
              avatarUrl: null,
              phoneNumber: null,
              role: "super_admin" as const,
              createdAt: authUser.created_at,
              updatedAt: authUser.updated_at ?? authUser.created_at,
            },
            session: {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_in: session.expires_in ?? 3600,
            },
          };
        }
      }
    }

    if (!result.success) {
      return NextResponse.json(
        { error: "No active session found", success: false },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      warning: result.warning,
    });

    if (result.session) {
      const expiresIn = result.session.expires_in || 3600;
      const maxAge = expiresIn;
      const refreshMaxAge = 7 * 24 * 60 * 60;
      response.cookies.set("sb-access-token", result.session.access_token, {
        path: "/",
        maxAge: maxAge,
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      response.cookies.set("sb-refresh-token", result.session.refresh_token, {
        path: "/",
        maxAge: refreshMaxAge,
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (error) {
    console.error("[SYNC-SESSION] Error syncing session:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to sync session", success: false },
      { status: 500 }
    );
  }
}

