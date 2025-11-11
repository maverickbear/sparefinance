import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { refreshAccessToken, decryptTokens, encryptTokens } from "@/lib/api/questrade";
import { getCurrentUserId, guardFeatureAccess, throwIfNotAllowed } from "@/lib/api/feature-guard";
import { formatTimestamp } from "@/lib/utils/timestamp";

export async function POST() {
  try {
    // Get current user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has access to investments
    const guardResult = await guardFeatureAccess(userId, "hasInvestments");
    await throwIfNotAllowed(guardResult);

    const supabase = await createServerClient();

    // Get Questrade connection
    const { data: connection, error: connectionError } = await supabase
      .from("QuestradeConnection")
      .select("*")
      .eq("userId", userId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Questrade connection not found" },
        { status: 404 }
      );
    }

    // Decrypt refresh token
    const { refreshToken } = decryptTokens(
      connection.accessToken,
      connection.refreshToken
    );

    // Refresh access token
    const tokenResponse = await refreshAccessToken(refreshToken);

    // Encrypt new tokens
    const { encryptedAccessToken, encryptedRefreshToken } = encryptTokens(
      tokenResponse.access_token,
      tokenResponse.refresh_token
    );

    // Calculate new expiration
    const now = new Date();
    const tokenExpiresAt = new Date(
      now.getTime() + tokenResponse.expires_in * 1000
    );

    // Update connection
    await supabase
      .from("QuestradeConnection")
      .update({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        apiServerUrl: tokenResponse.api_server,
        tokenExpiresAt: formatTimestamp(tokenExpiresAt),
        updatedAt: formatTimestamp(now),
      })
      .eq("id", connection.id);

    return NextResponse.json({
      success: true,
      message: "Token refreshed successfully",
      expiresAt: formatTimestamp(tokenExpiresAt),
    });
  } catch (error: any) {
    console.error("Error refreshing Questrade token:", error);

    // Check if it's a plan error
    if (error.planError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          planError: error.planError,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to refresh Questrade token" },
      { status: 500 }
    );
  }
}

