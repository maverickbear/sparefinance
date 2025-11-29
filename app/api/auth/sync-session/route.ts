import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";

/**
 * POST /api/auth/sync-session
 * 
 * Syncs the client-side session with server-side cookies.
 * This ensures that cookies are properly set on the server before redirecting.
 * 
 * This is particularly important in production where cookie settings (secure, sameSite, domain)
 * need to be consistent between client and server.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // First, try to get the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // If we have a session, use it
    if (session && session.user) {
      const response = NextResponse.json({
        success: true,
        user: {
          id: session.user.id,
          email: session.user.email,
        },
      });
      
      // Set cookies explicitly to ensure they're set correctly in production
      const expiresIn = session.expires_in || 3600;
      const maxAge = expiresIn;
      const refreshMaxAge = 7 * 24 * 60 * 60; // 7 days for refresh token
      
      response.cookies.set("sb-access-token", session.access_token, {
        path: "/",
        maxAge: maxAge,
        httpOnly: false, // Allow client-side access for Supabase client
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      
      response.cookies.set("sb-refresh-token", session.refresh_token, {
        path: "/",
        maxAge: refreshMaxAge,
        httpOnly: false, // Allow client-side access for Supabase client
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      
      return response;
    }
    
    // If no session, try to get user directly (session might be in cookies)
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !currentUser) {
      console.warn("[SYNC-SESSION] No user found:", userError?.message);
      return NextResponse.json(
        { error: "No active session found", success: false },
        { status: 401 }
      );
    }
    
    // If we have a user but no session, try to refresh
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshedSession) {
      console.warn("[SYNC-SESSION] Failed to refresh session:", refreshError?.message);
      // Even if refresh fails, return success if we have a user
      // The client-side session might still be valid
      return NextResponse.json({
        success: true,
        user: {
          id: currentUser.id,
          email: currentUser.email,
        },
        warning: "Session refresh failed, but user is authenticated",
      });
    }
    
    // Create response with success
    const response = NextResponse.json({
      success: true,
      user: {
        id: currentUser.id,
        email: currentUser.email,
      },
    });
    
    // Set cookies explicitly to ensure they're set correctly in production
    const expiresIn = refreshedSession.expires_in || 3600;
    const maxAge = expiresIn;
    const refreshMaxAge = 7 * 24 * 60 * 60; // 7 days for refresh token
    
    response.cookies.set("sb-access-token", refreshedSession.access_token, {
      path: "/",
      maxAge: maxAge,
      httpOnly: false, // Allow client-side access for Supabase client
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    
    response.cookies.set("sb-refresh-token", refreshedSession.refresh_token, {
      path: "/",
      maxAge: refreshMaxAge,
      httpOnly: false, // Allow client-side access for Supabase client
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    
    return response;
  } catch (error) {
    console.error("[SYNC-SESSION] Error syncing session:", error);
    return NextResponse.json(
      { error: "Failed to sync session", success: false },
      { status: 500 }
    );
  }
}

