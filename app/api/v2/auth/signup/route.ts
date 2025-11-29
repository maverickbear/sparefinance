import { NextRequest, NextResponse } from "next/server";
import { makeAuthService } from "@/src/application/auth/auth.factory";
import { signUpSchema } from "@/src/domain/auth/auth.validations";
import { ZodError } from "zod";

/**
 * POST /api/v2/auth/signup
 * Sign up a new user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validated = signUpSchema.parse(body);
    
    const service = makeAuthService();
    const result = await service.signUp(validated);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error in signup:", error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sign up" },
      { status: 500 }
    );
  }
}

