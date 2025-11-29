import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../../src/infrastructure/database/supabase-server";

/**
 * POST /api/v2/auth/google-signin
 * Initiates Google OAuth sign-in flow
 * 
 * Note: OAuth flows typically need to happen client-side due to redirects.
 * This endpoint returns the OAuth URL for the client to redirect to.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com";
    const redirectTo = `${appUrl}/auth/callback`;

    // Get the OAuth URL from Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.error("Error initiating Google OAuth:", error);
      return NextResponse.json(
        { error: error.message || "Failed to sign in with Google" },
        { status: 400 }
      );
    }

    // Return the URL for the client to redirect to
    return NextResponse.json(
      { url: data.url },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in Google sign-in:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sign in with Google" },
      { status: 500 }
    );
  }
}

