import { NextResponse } from "next/server";
import { acceptInvitationWithPassword } from "@/lib/api/members";
import { z } from "zod";

const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = acceptInvitationSchema.parse(body);
    const { token, password } = validatedData;

    const result = await acceptInvitationWithPassword(token, password);
    
    // If OTP verification is required, return that info instead of session
    if (result.requiresOtpVerification) {
      return NextResponse.json({
        requiresOtpVerification: true,
        email: result.email,
        invitationId: result.invitationId,
        userId: result.userId,
        message: "Please check your email for the verification code",
      });
    }
    
    // Create response with session data
    const response = NextResponse.json({
      member: result.member,
      session: result.session ? {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
        expires_in: result.session.expires_in,
      } : null,
    });

    // Set session cookies if we have a session
    if (result.session) {
      const expiresIn = result.session.expires_in || 3600;
      const maxAge = expiresIn;
      const refreshMaxAge = 7 * 24 * 60 * 60; // 7 days for refresh token

      response.cookies.set("sb-access-token", result.session.access_token, {
        path: "/",
        maxAge: maxAge,
        httpOnly: false, // Allow client-side access for Supabase client
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      response.cookies.set("sb-refresh-token", result.session.refresh_token, {
        path: "/",
        maxAge: refreshMaxAge,
        httpOnly: false, // Allow client-side access for Supabase client
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    
    return response;
  } catch (error) {
    console.error("Error accepting invitation with password:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to accept invitation";
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}

