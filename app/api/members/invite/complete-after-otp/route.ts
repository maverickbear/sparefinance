import { NextRequest, NextResponse } from "next/server";
import { completeInvitationAfterOtp } from "@/lib/api/members";
import { z } from "zod";
import { createServerClient } from "../../../../src/infrastructure/database/supabase-server";

const completeInvitationSchema = z.object({
  invitationId: z.string().min(1, "Invitation ID is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = completeInvitationSchema.parse(body);
    const { invitationId } = validatedData;

    // Get current authenticated user
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await completeInvitationAfterOtp(authUser.id, invitationId);
    
    // Invalidate subscription cache to ensure fresh data on next check
    // This is important because the member now has "active" status and should inherit owner's subscription
    try {
      const { invalidateSubscriptionCache } = await import("@/lib/api/subscription");
      await invalidateSubscriptionCache(authUser.id);
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
    
    const errorMessage = error instanceof Error ? error.message : "Failed to complete invitation";
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}

