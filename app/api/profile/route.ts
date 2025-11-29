import { NextRequest, NextResponse } from "next/server";
import { getProfile, updateProfile } from "@/lib/api/profile";
import { ProfileFormData } from "@/src/domain/profile/profile.validations";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const profile = await getProfile();
    
    // Return profile even if it's null (user exists but profile might be incomplete)
    // This allows the modal to show empty fields for the user to fill in
    if (!profile) {
      // Return empty profile structure instead of 404
      return NextResponse.json({
        name: "",
        email: "",
        avatarUrl: "",
        phoneNumber: "",
      }, { status: 200 });
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
    const data: ProfileFormData = await request.json();
    
    const profile = await updateProfile(data);
    
    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error("Error updating profile:", error);
    
    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : "Failed to update profile";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

