import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";

/**
 * GET /api/v2/admin/invites/validate?token=...
 * Validates an admin invite token. Returns email if valid (unauthenticated).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { message: "Invalid or expired invite" },
      { status: 400 }
    );
  }
  const adminService = makeAdminService();
  const result = await adminService.validateAdminInvite(token);
  if (!result) {
    return NextResponse.json(
      { message: "Invalid or expired invite" },
      { status: 400 }
    );
  }
  return NextResponse.json({ email: result.email });
}
