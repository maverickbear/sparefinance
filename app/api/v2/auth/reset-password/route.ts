import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { createServerClient } from "../../../../src/infrastructure/database/supabase-server";
import { resetPasswordSchema, ResetPasswordFormData } from "@/src/domain/auth/auth.validations";
import { validatePasswordAgainstHIBP } from "@/lib/utils/hibp";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import { ZodError } from "zod";

/**
 * POST /api/v2/auth/reset-password
 * Resets user password after validating with HIBP
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate input
    let data: ResetPasswordFormData;
    try {
      data = resetPasswordSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    // Validate password against HIBP
    const passwordValidation = await validatePasswordAgainstHIBP(data.password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.error || "Invalid password" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    
    // Update user password
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      const errorMessage = getAuthErrorMessage(error, "Failed to reset password");
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset password" },
      { status: 500 }
    );
  }
}

