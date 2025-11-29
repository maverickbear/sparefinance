import { NextRequest, NextResponse } from "next/server";
import { makeProfileService } from "@/src/application/profile/profile.factory";
import { ProfileFormData, profileSchema } from "@/src/domain/profile/profile.validations";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const service = makeProfileService();
    const profile = await service.getProfile();
    
    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate with schema
    const validatedData = profileSchema.parse(body);
    
    const service = makeProfileService();
    const profile = await service.updateProfile(validatedData);
    
    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error("Error updating profile:", error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to update profile";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

