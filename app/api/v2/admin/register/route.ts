import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * POST /api/v2/admin/register
 * Body: { token, name, password }
 * Registers a new admin (super_admin) using a valid invite token (unauthenticated).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, name, password } = body ?? {};
    if (!token || !name || !password) {
      return NextResponse.json(
        { message: "Token, name, and password are required" },
        { status: 400 }
      );
    }
    const adminService = makeAdminService();
    await adminService.registerAdminWithInvite(token, name, password);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { message: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { message: "Invalid request" },
      { status: 400 }
    );
  }
}
