import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";

/**
 * POST /api/v2/admin/invites
 * Body: { email: string }
 * Creates an admin invite (super_admin only). Returns { id, email, token, expiresAt } for the invite link.
 */
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (!email) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      );
    }
    const adminService = makeAdminService();
    const invite = await adminService.createAdminInvite(email, userId);
    return NextResponse.json(invite);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { message: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { message: "Failed to create invite" },
      { status: 500 }
    );
  }
}
