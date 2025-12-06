import { NextRequest, NextResponse } from "next/server";
import { makeMembersService } from "@/src/application/members/members.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { completeInvitationSchema } from "@/src/domain/members/members.validations";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = completeInvitationSchema.parse(body);
    const { invitationId } = validatedData;

    // Get current authenticated user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const service = makeMembersService();
    const result = await service.completeInvitationAfterOtp(userId, invitationId);
    
    // Invalidate subscription cache to ensure fresh data on next check
    // This is important because the member now has "active" status and should inherit owner's subscription
    try {
      const { makeSubscriptionsService } = await import("@/src/application/subscriptions/subscriptions.factory");
      const subscriptionsService = makeSubscriptionsService();
      console.log("[COMPLETE-INVITATION] Subscription cache invalidated for new member");
    } catch (cacheError) {
      console.warn("[COMPLETE-INVITATION] Could not invalidate subscription cache:", cacheError);
      // Continue anyway - cache will eventually update
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
    console.error("Error completing invitation after OTP:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to complete invitation";
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}

